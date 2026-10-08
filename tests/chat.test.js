import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createApp } from "../server.js";

const realTimeout = AbortSignal.timeout.bind(AbortSignal);
const projectFolder = fileURLToPath(new URL("../", import.meta.url));

// Toutes les réponses Google sont simulées : aucune vraie clé n'est utilisée.
function googleResponse(reply = "Bonjour Alex.", context = "Alex apprend JavaScript.", phase = "auto") {
  const text = phase === 1 ? reply : JSON.stringify({ reply, context });
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function start(t, options = {}, googleFetch = async () => jsonResponse(googleResponse())) {
  const app = createApp({ apiKey: "test-only-placeholder", model: "gemini-test", serverUrl: "", ...options }, googleFetch);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

async function chat(url, body, headers = {}) {
  const response = await fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}

for (const phase of [1, 2, 3, "auto"]) {
  test("le contrat HTTP correspond au mode " + phase, async t => {
    let sent;
    const { url } = await start(t, { model: "models/gemini-test" }, async (address, options) => {
      assert.ok(address.endsWith("models/gemini-test:generateContent"));
      sent = JSON.parse(options.body);
      assert.equal(options.headers["x-goog-api-key"], "test-only-placeholder");
      return jsonResponse(googleResponse("Bonjour Alex.", "Alex apprend JavaScript.", phase));
    });
    const body = { message: " Bonjour ", context: " Alex apprend JavaScript. " };
    if (phase !== "auto") body.phase = phase;
    const result = await chat(url, body);
    assert.equal(result.status, 200);
    assert.equal(result.data.reply, "Bonjour Alex.");
    assert.equal(result.data.model, "gemini-test");
    assert.match(sent.systemInstruction.parts[0].text, /Nova/);
    if (phase === 1) {
      assert.equal(result.data.context, "");
      assert.deepEqual(sent.contents[0].parts, [{ text: "Bonjour" }]);
      assert.equal(sent.generationConfig.responseMimeType, undefined);
    } else {
      assert.equal(result.data.context, "Alex apprend JavaScript.");
      assert.equal(sent.contents[0].parts.length, 2);
      assert.match(sent.contents[0].parts[0].text, /Alex apprend JavaScript/);
      assert.equal(sent.contents[0].parts[1].text, "Bonjour");
      assert.equal(sent.generationConfig.responseMimeType, "application/json");
      assert.deepEqual(sent.generationConfig.responseJsonSchema.required, ["reply", "context"]);
      if (phase === 2) assert.doesNotMatch(sent.systemInstruction.parts[0].text, /roi démon/);
      if (phase === 3) assert.match(sent.systemInstruction.parts[0].text, /roi démon/);
      if (phase === "auto") assert.match(sent.systemInstruction.parts[0].text, /Sans demande de rôle/);
    }
  });
}

test("les messages invalides sont refusés avant l'appel Google", async t => {
  let calls = 0;
  const { url } = await start(t, {}, async () => { calls++; return jsonResponse(googleResponse()); });
  for (const body of [{}, [], { message: "   " }, { message: 12 }, { message: "x".repeat(2001) },
    { message: "Bonjour", phase: 0 }, { message: "Bonjour", phase: "3" }]) {
    assert.equal((await chat(url, body)).status, 400);
  }
  assert.equal((await chat(url, { message: "Bonjour", context: 12 })).status, 400);
  assert.equal((await chat(url, { message: "Bonjour", context: "x".repeat(4001) })).status, 400);
  const invalidJson = await fetch(url + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{"
  });
  assert.equal(invalidJson.status, 400);
  assert.equal((await chat(url, { message: "x".repeat(130 * 1024) })).status, 413);
  assert.equal(calls, 0);
});

test("seule l'origine exacte du site est acceptée", async t => {
  let calls = 0;
  const { server, url } = await start(t, {}, async () => { calls++; return jsonResponse(googleResponse()); });
  assert.equal((await chat(url, { message: "Bonjour" }, { Origin: url })).status, 200);
  const otherPort = server.address().port === 65535 ? 65534 : server.address().port + 1;
  for (const origin of ["http://127.0.0.1:" + otherPort, "null", "origine-invalide", "https://example.invalid"]) {
    assert.equal((await chat(url, { message: "Bonjour" }, { Origin: origin })).status, 403);
  }
  assert.equal((await chat(url, { message: "Bonjour" }, {
    Host: "example.invalid", Origin: "http://example.invalid"
  })).status, 403);
  assert.equal(calls, 1);
});

test("une clé absente donne 503 sans contacter Google", async t => {
  let calls = 0;
  const { url } = await start(t, { apiKey: "" }, async () => { calls++; return jsonResponse({}); });
  assert.equal((await chat(url, { message: "Bonjour" })).status, 503);
  assert.equal(calls, 0);
});

test("le catalogue automatique ignore les entrées invalides et lit les pages", async t => {
  const routes = [];
  const { url } = await start(t, { model: "auto" }, async (address, options) => {
    routes.push(address);
    if (options.method === "POST") return jsonResponse(googleResponse());
    if (address.includes("pageToken=")) {
      return jsonResponse({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
    }
    return jsonResponse({
      models: [null, { name: "models/gemini-9.0-flash", supportedGenerationMethods: "generateContent" }],
      nextPageToken: "page suivante"
    });
  });
  const result = await chat(url, { message: "Bonjour" });
  assert.equal(result.status, 200);
  assert.equal(result.data.model, "gemini-2.5-flash");
  assert.equal(routes.length, 3);
  assert.ok(routes[1].includes("pageToken=page%20suivante"));
  assert.ok(routes[2].endsWith("models/gemini-2.5-flash:generateContent"));
});

test("un catalogue inexploitable donne 502", async t => {
  for (const data of [{ models: {} }, { models: [] }]) {
    const { url } = await start(t, { model: "auto" }, async () => jsonResponse(data));
    assert.equal((await chat(url, { message: "Bonjour" })).status, 502);
  }
});

test("les réponses Google mal formées donnent 502", async t => {
  const invalidResponses = [
    {},
    { candidates: [{ content: { parts: {} } }] },
    { candidates: [{ content: { parts: [null] } }] },
    { candidates: [{ content: { parts: [{ thought: true, text: "Texte interne." }] } }] },
    { candidates: [{ content: { parts: [{ text: "Ce n'est pas du JSON." }] } }] },
    { candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "Bonjour", context: 12 }) }] } }] }
  ];
  for (const data of invalidResponses) {
    const { url } = await start(t, {}, async () => jsonResponse(data));
    assert.equal((await chat(url, { message: "Bonjour" })).status, 502);
  }
});

test("le détail d'une erreur Google masque la clé", async t => {
  const fakeKey = "test-only-placeholder";
  const { url } = await start(t, { apiKey: fakeKey }, async () => {
    return jsonResponse({ error: { message: "Quota atteint pour " + fakeKey } }, 429);
  });
  const result = await chat(url, { message: "Bonjour" });
  assert.equal(result.status, 502);
  assert.equal(result.data.googleStatus, 429);
  assert.ok(!result.data.error.includes(fakeKey));
  assert.match(result.data.error, /CLE_MASQUEE/);
});

function rejectOnAbort(signal) {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

test("l'origine LAN configurée est acceptée uniquement en mode partagé", async t => {
  const serverUrl = "http://192.168.1.18:3000";
  for (const share of [false, true]) {
    let calls = 0;
    const { url } = await start(t, { serverUrl, share }, async () => { calls++; return jsonResponse(googleResponse()); });
    const headers = { Host: "192.168.1.18:3000", Origin: serverUrl };
    assert.equal((await chat(url, { message: "Bonjour" }, headers)).status, share ? 200 : 403);
    if (share) {
      for (const origin of ["http://192.168.1.18:3001", "http://192.168.1.19:3000", "https://192.168.1.18:3000"]) {
        assert.equal((await chat(url, { message: "Bonjour" }, { ...headers, Origin: origin })).status, 403);
      }
      assert.equal((await chat(url, { message: "Bonjour" }, { Origin: url })).status, 200);
    }
    assert.equal(calls, share ? 2 : 0);
  }
});

for (const phase of [1, 2, 3, "auto"]) {
  test("un clone sans clé relaie le mode " + phase + " au propriétaire par HTTP", async t => {
    let googleCalls = 0;
    const owner = await start(t, { share: true }, async (address, options) => {
      googleCalls++;
      assert.match(address, /^https:\/\/generativelanguage\.googleapis\.com\//);
      assert.equal(options.headers["x-goog-api-key"], "test-only-placeholder");
      return jsonResponse(googleResponse("Bonjour Alex.", "Alex apprend JavaScript.", phase));
    });
    let relayed;
    const client = await start(t, { apiKey: "", serverUrl: owner.url }, async (address, options) => {
      relayed = { address: String(address), options };
      return fetch(address, options);
    });
    const body = { message: " Bonjour ", context: " Alex apprend JavaScript. ", apiKey: "ignorer", history: ["ignorer"] };
    if (phase !== "auto") body.phase = phase;
    const result = await chat(client.url, body, {
      Origin: client.url, Cookie: "session=do-not-forward", Authorization: "Bearer do-not-forward"
    });
    assert.deepEqual(result, {
      status: 200,
      data: { reply: "Bonjour Alex.", context: phase === 1 ? "" : "Alex apprend JavaScript.", model: "gemini-test" }
    });
    assert.equal(googleCalls, 1);
    assert.equal(relayed.address, owner.url + "/api/chat");
    assert.equal(relayed.options.method, "POST");
    assert.equal(relayed.options.redirect, "error");
    assert.deepEqual(JSON.parse(relayed.options.body), {
      message: "Bonjour", context: phase === 1 ? "" : "Alex apprend JavaScript.", phase
    });
    const headers = new Headers(relayed.options.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("x-nova-relay"), "1");
    for (const name of ["origin", "cookie", "authorization", "x-goog-api-key"]) assert.equal(headers.get(name), null);
    assert.ok(!JSON.stringify(result).includes("test-only-placeholder"));
    assert.ok(!relayed.options.body.includes("test-only-placeholder"));
    const health = await fetch(client.url + "/api/health").then(response => response.json());
    assert.deepEqual(health, { status: "ok", keyConfigured: false, serverConfigured: true });
  });
}

test("une clé locale a priorité sur l'URL du serveur partagé", async t => {
  let calls = 0;
  const { url } = await start(t, { serverUrl: "http://127.0.0.1:12345" }, async address => {
    calls++;
    assert.match(address, /^https:\/\/generativelanguage\.googleapis\.com\//);
    return jsonResponse(googleResponse());
  });
  assert.equal((await chat(url, { message: "Bonjour" })).status, 200);
  assert.equal(calls, 1);
});

test("un clone refuse une requête déjà relayée et évite les boucles", async t => {
  let secondCalls = 0;
  const second = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, async () => {
    secondCalls++;
    return jsonResponse({});
  });
  const first = await start(t, { apiKey: "", serverUrl: second.url }, fetch);
  assert.equal((await chat(first.url, { message: "Bonjour" })).status, 502);
  assert.equal(secondCalls, 0);
});

test("les requêtes invalides ne sont pas relayées", async t => {
  let calls = 0;
  const { url } = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, async () => {
    calls++;
    return jsonResponse({});
  });
  for (const body of [{ message: " " }, { message: "Bonjour", phase: 4 }, { message: "Bonjour", context: 12 }]) {
    assert.equal((await chat(url, body)).status, 400);
  }
  const invalidJson = await fetch(url + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{"
  });
  assert.equal(invalidJson.status, 400);
  assert.equal((await chat(url, { message: "x".repeat(130 * 1024) })).status, 413);
  assert.equal(calls, 0);
});

test("les erreurs du serveur partagé conservent leur statut sans exposer son détail", async t => {
  for (const status of [400, 429, 503, 504]) {
    const { url } = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, async () => {
      return jsonResponse({ error: "Erreur privée avec test-only-placeholder", googleStatus: 429 }, status);
    });
    const result = await chat(url, { message: "Bonjour" });
    assert.equal(result.status, status);
    assert.equal(result.data.googleStatus, 429);
    assert.equal(typeof result.data.error, "string");
    assert.ok(!result.data.error.includes("test-only-placeholder"));
    assert.ok(!result.data.error.includes("Erreur privée"));
  }
});

test("un serveur partagé inaccessible ou mal formé donne 502", async t => {
  const invalidFetches = [
    async () => { throw new TypeError("Connexion refusée avec test-only-placeholder"); },
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("JSON privé test-only-placeholder"); } }),
    ...[{}, { reply: "Bonjour" }, { reply: 12, context: "Alex", model: "gemini-test" },
      { reply: "Bonjour", context: 12, model: "gemini-test" },
      { reply: "Bonjour", context: "Alex" },
      { reply: "Bonjour", context: "x".repeat(4001), model: "gemini-test" }]
      .map(data => async () => jsonResponse(data))
  ];
  for (const requestFetch of invalidFetches) {
    const { url } = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, requestFetch);
    const result = await chat(url, { message: "Bonjour" });
    assert.equal(result.status, 502);
    assert.ok(!JSON.stringify(result).includes("test-only-placeholder"));
  }
});

test("la phase 1 accepte un propriétaire sans contexte dans sa réponse", async t => {
  const { url } = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, async () => {
    return jsonResponse({ reply: "Bonjour.", model: "gemini-test", internalKey: "test-only-placeholder" });
  });
  assert.deepEqual(await chat(url, { message: "Bonjour", phase: 1 }), {
    status: 200, data: { reply: "Bonjour.", context: "", model: "gemini-test" }
  });
});

for (const step of ["fetch", "response.json"]) {
  test("le relais expire après 60000 ms, y compris pendant " + step, async t => {
    const requestedDelays = [];
    t.mock.method(AbortSignal, "timeout", milliseconds => {
      requestedDelays.push(milliseconds);
      return realTimeout(10);
    });
    const { url } = await start(t, { apiKey: "", serverUrl: "http://127.0.0.1:12345" }, async (_address, { signal }) => {
      if (step === "fetch") return rejectOnAbort(signal);
      return { ok: true, status: 200, json: () => rejectOnAbort(signal) };
    });
    assert.equal((await chat(url, { message: "Bonjour" })).status, 504);
    assert.deepEqual(requestedDelays, [60000]);
  });
}

test("les fichiers privés et la clé ne sont jamais servis au navigateur", async t => {
  const { url } = await start(t);
  const healthResponse = await fetch(url + "/api/health");
  const health = await healthResponse.json();
  assert.deepEqual(health, { status: "ok", keyConfigured: true, serverConfigured: false });
  assert.equal(healthResponse.headers.get("cache-control"), "no-store");
  assert.ok(!JSON.stringify(health).includes("test-only-placeholder"));
  for (const pathname of ["/.env", "/server.js", "/nova.config.json", "/package.json"]) {
    const response = await fetch(url + pathname);
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes("test-only-placeholder"));
  }
});

test("le propriétaire limite tous les visiteurs à 30 messages par minute", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const { url } = await start(t, { share: true }, async () => { calls++; return jsonResponse(googleResponse()); });
  for (let index = 0; index < 30; index++) {
    const headers = index % 2 ? { "X-Nova-Relay": "1" } : {};
    assert.equal((await chat(url, { message: "Bonjour" }, headers)).status, 200);
  }
  const limited = await fetch(url + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Encore" })
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal(calls, 30);
  now += 60000;
  assert.equal((await chat(url, { message: "Bonjour après la minute" })).status, 200);
  assert.equal(calls, 31);
});

for (const step of ["fetch", "response.json"]) {
  test("le délai est de 60000 ms, y compris pendant " + step, async t => {
    const requestedDelays = [];
    t.mock.method(AbortSignal, "timeout", milliseconds => {
      requestedDelays.push(milliseconds);
      return realTimeout(10); // Le test expire vite, sans attendre une minute.
    });
    const { url } = await start(t, {}, async (_address, { signal }) => {
      if (step === "fetch") return rejectOnAbort(signal);
      return { ok: true, status: 200, json: () => rejectOnAbort(signal) };
    });
    assert.equal((await chat(url, { message: "Bonjour" })).status, 504);
    assert.deepEqual(requestedDelays, [60000]);
  });
}

test("un port occupé termine avec le code 1 sans afficher Site prêt", async t => {
  const { server } = await start(t, { apiKey: "" });
  const environment = { PORT: String(server.address().port), GEMINI_API_KEY: "", GEMINI_MODEL: "auto" };
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;
  const result = spawnSync(process.execPath, ["server.js"], {
    cwd: projectFolder, env: environment, encoding: "utf8", timeout: 5000
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Port occupé/);
  assert.doesNotMatch(result.stdout, /Site prêt/);
});
