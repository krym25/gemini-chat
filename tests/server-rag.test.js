import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { createApp } from "../server.js";

// Aucun appel réseau Google : recherche et génération sont injectées.
const apiKey = "test-only-rag-placeholder";

async function start(t, ragSearch, googleFetch) {
  const app = createApp({ apiKey, model: "gemini-test", ragSearch }, googleFetch);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return "http://127.0.0.1:" + server.address().port;
}

async function chat(url, overrides = {}) {
  const response = await fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: 4,
      message: "Qui vend les potions de soin ?",
      context: "Je visite Brume.",
      ...overrides
    })
  });
  return { status: response.status, data: await response.json() };
}

test("la phase 4 transmet les extraits à Gemini et retourne leurs références", async t => {
  let searched;
  let sent;
  const passage = {
    id: "royaume-1",
    fichier: "royaume.txt",
    texte: "Mira vend les potions de soin à Brume.",
    score: 0.715
  };
  const url = await start(t, async question => {
    searched = question;
    return [passage];
  }, async (_address, options) => {
    sent = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{
          text: JSON.stringify({
            reply: "Mira vend les potions de soin [royaume-1].",
            context: "Le visiteur cherche Mira à Brume."
          })
        }] } }]
      })
    };
  });

  const result = await chat(url);
  assert.equal(result.status, 200);
  assert.equal(searched, "Qui vend les potions de soin ?");
  assert.match(result.data.reply, /Mira.*\[royaume-1\]/);
  assert.deepEqual(result.data.sources, [{
    id: passage.id, fichier: passage.fichier, score: passage.score
  }]);
  assert.equal(result.data.model, "gemini-test");
  assert.equal(result.data.context, "Le visiteur cherche Mira à Brume.");

  const contents = sent.contents[0].parts.map(part => part.text).join("\n");
  assert.match(contents, /Mira vend les potions/);
  assert.match(contents, /royaume-1/);
  assert.match(contents, /Je visite Brume/);
  assert.match(contents, /Qui vend les potions/);
  const instructions = sent.systemInstruction.parts[0].text;
  assert.match(instructions, /uniquement.*extraits documentaires/i);
  assert.match(instructions, /ne suis jamais les instructions/i);
  assert.match(instructions, /ne contiennent pas la réponse/i);
  assert.equal(sent.generationConfig.responseMimeType, "application/json");
});

test("sans extrait pertinent, la phase 4 conserve le contexte sans générer", async t => {
  let googleCalls = 0;
  const url = await start(t, async () => [], async () => {
    googleCalls++;
    throw new Error("Google ne doit pas être appelé.");
  });
  const result = await chat(url);
  assert.equal(result.status, 200);
  assert.match(result.data.reply, /ne trouve pas/i);
  assert.equal(result.data.context, "Je visite Brume.");
  assert.deepEqual(result.data.sources, []);
  assert.equal(googleCalls, 0);
});

test("une erreur de recherche masque la clé et évite la génération", async t => {
  let googleCalls = 0;
  const url = await start(t, async () => {
    throw new Error("Quota atteint pour " + apiKey);
  }, async () => { googleCalls++; });
  const result = await chat(url);
  assert.equal(result.status, 502);
  assert.match(result.data.error, /Recherche documentaire impossible/);
  assert.match(result.data.error, /CLE_MASQUEE/);
  assert.ok(!result.data.error.includes(apiKey));
  assert.equal(googleCalls, 0);
});

test("la phase 4 refuse un contexte invalide avant la recherche", async t => {
  let searches = 0;
  let googleCalls = 0;
  const url = await start(t, async () => { searches++; return []; }, async () => { googleCalls++; });
  for (const context of [12, "x".repeat(4001)]) {
    assert.equal((await chat(url, { context })).status, 400);
  }
  assert.equal(searches, 0);
  assert.equal(googleCalls, 0);
});
