import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createApp } from "../server.js";

const PHASE = 3;
const realTimeout = AbortSignal.timeout.bind(AbortSignal);
const projectFolder = fileURLToPath(new URL("../", import.meta.url));

// Toutes les réponses Google sont simulées : aucune vraie clé n'est utilisée.
function googleResponse(reply = "Bonjour Alex.", context = "Alex apprend JavaScript.") {
  const text = PHASE === 1 ? reply : JSON.stringify({ reply, context });
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function start(t, options = {}, googleFetch = async () => jsonResponse(googleResponse())) {
  const app = createApp({ apiKey: "test-only-placeholder", model: "gemini-test", publicOrigin: "", ...options }, googleFetch);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

async function chat(url, body, headers = {}, signal) {
  const response = await fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal
  });
  return { status: response.status, data: await response.json(), retryAfter: response.headers.get("Retry-After") };
}

test("le contrat HTTP correspond à la phase " + PHASE, async t => {
  let sent;
  const { url } = await start(t, { model: "models/gemini-test" }, async (address, options) => {
    assert.ok(address.endsWith("models/gemini-test:generateContent"));
    sent = JSON.parse(options.body);
    return jsonResponse(googleResponse());
  });
  const result = await chat(url, { message: "Bonjour", context: "Alex apprend JavaScript." });
  assert.equal(result.status, 200);
  assert.equal(result.data.reply, "Bonjour Alex.");
  assert.equal(result.data.model, "gemini-test");
  assert.match(sent.systemInstruction.parts[0].text, /Nova/);
  if (PHASE === 1) {
    assert.equal(result.data.context, undefined);
    assert.deepEqual(sent.contents[0].parts, [{ text: "Bonjour" }]);
    assert.equal(sent.generationConfig.responseMimeType, undefined);
  } else {
    assert.equal(result.data.context, "Alex apprend JavaScript.");
    assert.equal(sent.contents[0].parts.length, 2);
    assert.match(sent.contents[0].parts[0].text, /Alex apprend JavaScript/);
    assert.equal(sent.contents[0].parts[1].text, "Bonjour");
    assert.equal(sent.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(sent.generationConfig.responseJsonSchema.required, ["reply", "context"]);
    if (PHASE === 2) assert.doesNotMatch(sent.systemInstruction.parts[0].text, /roi démon/);
    if (PHASE === 3) assert.match(sent.systemInstruction.parts[0].text, /roi démon/);
  }
});

test("les messages invalides sont refusés avant l'appel Google", async t => {
  let calls = 0;
  const { url } = await start(t, {}, async () => { calls++; return jsonResponse(googleResponse()); });
  for (const body of [{}, [], { message: "   " }, { message: 12 }, { message: "x".repeat(2001) }]) {
    assert.equal((await chat(url, body)).status, 400);
  }
  if (PHASE !== 1) {
    assert.equal((await chat(url, { message: "Bonjour", context: 12 })).status, 400);
    assert.equal((await chat(url, { message: "Bonjour", context: "x".repeat(4001) })).status, 400);
  }
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
  assert.equal(calls, 1);
});

test("l'origine HTTPS publique reste fixe derrière le proxy", async t => {
  let calls = 0;
  const publicOrigin = "https://nova.example";
  const { url } = await start(t, { publicOrigin }, async () => { calls++; return jsonResponse(googleResponse()); });
  const result = await chat(url, { message: "Bonjour" }, {
    Origin: publicOrigin, Host: "serveur-interne:3000", "X-Forwarded-Host": "autre.example", "X-Forwarded-Proto": "http"
  });
  assert.equal(result.status, 200);
  for (const origin of ["https://autre.example", "null", "origine-invalide"]) {
    const blocked = await chat(url, { message: "Bonjour" }, {
      Origin: origin, Host: "autre.example", "X-Forwarded-Host": "nova.example", "X-Forwarded-Proto": "https"
    });
    assert.equal(blocked.status, 403);
  }
  assert.equal(calls, 1);
});

test("la limite globale de 30 messages ne se contourne pas avec une fausse IP", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const { url } = await start(t, {}, async () => { calls++; return jsonResponse(googleResponse()); });
  for (let i = 0; i < 30; i++) {
    const result = await chat(url, { message: "Bonjour" }, { "X-Forwarded-For": "198.51.100." + (i + 1) });
    assert.equal(result.status, 200);
  }
  const blocked = await chat(url, { message: "Bonjour" }, { "X-Forwarded-For": "203.0.113.1" });
  assert.equal(blocked.status, 429);
  assert.equal(Number(blocked.retryAfter), 60);
  assert.equal(calls, 30);

  now += 60000; // Une nouvelle fenêtre permet de discuter à nouveau.
  assert.equal((await chat(url, { message: "Bonjour" })).status, 200);
  assert.equal(calls, 31);
});

test("les 5 places simultanées se libèrent après succès, erreur et déconnexion", { timeout: 5000 }, async t => {
  const events = new EventEmitter();
  const pending = [];
  const responses = [];
  const controllers = [];
  const { url } = await start(t, {}, async (_address, { signal }) => new Promise((resolve, reject) => {
    pending.push({ resolve, reject, signal });
    signal.addEventListener("abort", () => {
      reject(signal.reason);
      events.emit("cancelled");
    }, { once: true });
    events.emit("started");
  }));

  async function beginRequest() {
    const started = once(events, "started");
    const controller = new AbortController();
    controllers.push(controller);
    responses.push(chat(url, { message: "Bonjour" }, {}, controller.signal).catch(error => ({ error })));
    await started;
  }

  for (let i = 0; i < 5; i++) await beginRequest();
  assert.equal((await chat(url, { message: "Bonjour" })).status, 429);
  assert.equal(pending.length, 5);

  pending[0].resolve(jsonResponse(googleResponse()));
  assert.equal((await responses[0]).status, 200);
  assert.equal(pending[0].signal.aborted, false);
  await beginRequest();

  pending[1].reject(new Error("Connexion Google simulée interrompue."));
  assert.equal((await responses[1]).status, 502);
  await beginRequest();

  const cancelled = once(events, "cancelled");
  controllers[2].abort();
  assert.equal((await responses[2]).error.name, "AbortError");
  await cancelled;
  assert.equal(pending[2].signal.aborted, true);
  await beginRequest();

  assert.equal(pending.length, 8);
  assert.equal((await chat(url, { message: "Bonjour" })).status, 429);
  assert.equal(pending.length, 8);
  for (const request of pending) request.resolve(jsonResponse(googleResponse()));
  const results = await Promise.all(responses);
  assert.deepEqual(results.map(result => result.status), [200, 502, undefined, 200, 200, 200, 200, 200]);
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
    { candidates: [{ content: { parts: [{ thought: true, text: "Texte interne." }] } }] }
  ];
  if (PHASE !== 1) {
    invalidResponses.push(
      { candidates: [{ content: { parts: [{ text: "Ce n'est pas du JSON." }] } }] },
      { candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "Bonjour", context: 12 }) }] } }] }
    );
  }
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
