import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "../server.js";

const PHASE = 2;
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
  const app = createApp({ apiKey: "test-only-placeholder", model: "gemini-test", ...options }, googleFetch);
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
    body: JSON.stringify({ phase: PHASE, ...body })
  });
  return { status: response.status, data: await response.json() };
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
  assert.match(sent.systemInstruction.parts[0].text, PHASE === 3 ? /Varkhos/ : /Nova/);
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

if (PHASE === 3) {
  test("les trois modes séparent le chat simple, la mémoire et Varkhos", async t => {
    let sent;
    const { url } = await start(t, {}, async (_address, options) => {
      sent = JSON.parse(options.body);
      const output = sent.generationConfig.responseMimeType
        ? JSON.stringify({ reply: "Bonjour Alex.", context: "Le joueur Alex est devant le trône." })
        : "Bonjour Alex.";
      return jsonResponse({ candidates: [{ content: { parts: [{ text: output }] } }] });
    });
    for (const phase of [1, 2, 3]) {
      const result = await chat(url, { phase, message: "Bonjour", context: "Je m'appelle Alex." });
      assert.equal(result.status, 200);
      assert.equal(result.data.reply, "Bonjour Alex.");
      const instructions = sent.systemInstruction.parts[0].text;
      if (phase === 1) {
        assert.equal(result.data.context, "");
        assert.deepEqual(sent.contents[0].parts, [{ text: "Bonjour" }]);
        assert.equal(sent.generationConfig.responseMimeType, undefined);
      } else {
        assert.match(sent.contents[0].parts[0].text, /Je m'appelle Alex/);
        assert.equal(sent.generationConfig.responseMimeType, "application/json");
        const followup = await chat(url, { phase, message: "Où suis-je ?", context: result.data.context });
        assert.equal(followup.status, 200);
        assert.match(sent.contents[0].parts[0].text, /Alex est devant le trône/);
      }
      if (phase === 3) assert.match(instructions, /Tu incarnes Varkhos, roi démon/);
      else assert.doesNotMatch(instructions, /Varkhos|roi démon/);
    }
    for (const phase of [0, 4, "3", "auto"]) {
      assert.equal((await chat(url, { phase, message: "Bonjour" })).status, 400);
    }
  });
}

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

async function startFromAnotherFolder(t, projectEnv, inheritedKey) {
  const folder = await mkdtemp(path.join(projectFolder, ".startup-test-"));
  const otherFolder = await mkdtemp(path.join(tmpdir(), "nova-other-folder-"));
  let child;
  let closed;
  t.after(async () => {
    if (child && child.exitCode === null) child.kill();
    if (closed) await closed;
    await rm(folder, { recursive: true, force: true });
    await rm(otherFolder, { recursive: true, force: true });
  });
  await copyFile(path.join(projectFolder, "server.js"), path.join(folder, "server.js"));
  await copyFile(path.join(projectFolder, "package.json"), path.join(folder, "package.json"));

  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  if (projectEnv !== null) await writeFile(path.join(folder, ".env"), projectEnv + "\nPORT=" + port);
  // Ce fichier ne doit jamais remplacer celui placé à côté de server.js.
  await writeFile(path.join(otherFolder, ".env"), "GEMINI_API_KEY=wrong-folder-test-key\n");
  const environment = { PORT: String(port) };
  if (inheritedKey !== undefined) environment.GEMINI_API_KEY = inheritedKey;
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;
  child = spawn(process.execPath, [path.join(folder, "server.js")], {
    cwd: otherFolder, env: environment, stdio: ["ignore", "pipe", "pipe"]
  });
  closed = once(child, "close");
  let output = "";
  let errors = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Le serveur de test ne démarre pas.")), 5000);
    child.stderr.on("data", chunk => { errors += chunk.toString(); });
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      if (output.includes("Site prêt")) { clearTimeout(timer); resolve(); }
    });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", () => { clearTimeout(timer); reject(new Error(errors || "Le serveur s'est arrêté.")); });
  });
  return { url: "http://127.0.0.1:" + port, output };
}

test("le démarrage lit le .env du projet depuis un autre dossier", async t => {
  const fakeKey = "project-startup-test-key";
  const { url, output } = await startFromAnotherFolder(t, "GEMINI_API_KEY=" + fakeKey);
  const health = await fetch(url + "/api/health");
  assert.deepEqual(await health.json(), { status: "ok", keyConfigured: true });
  assert.equal((await fetch(url + "/.env")).status, 404);
  assert.ok(!output.includes(fakeKey));
});

test("sans .env de projet, celui du dossier courant est ignoré", async t => {
  const { url } = await startFromAnotherFolder(t, null);
  assert.equal((await (await fetch(url + "/api/health")).json()).keyConfigured, false);
  const result = await chat(url, { message: "Bonjour" });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /Clé absente/);
});

test("le .env du projet préserve une clé déjà définie dans l'environnement", async t => {
  const { url } = await startFromAnotherFolder(t, "GEMINI_API_KEY=project-startup-test-key", "");
  assert.equal((await (await fetch(url + "/api/health")).json()).keyConfigured, false);
});
