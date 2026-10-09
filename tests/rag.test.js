import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { rechercher } from "../rag.js";
import { construireIndex, decouper } from "../indexer.js";

const dimension = 768;
const apiKey = "test-only-embedding-placeholder";

function vecteur(x = 1, y = 0) {
  return [x, y, ...Array(dimension - 2).fill(0)];
}

function passage(id, score, longueur = 1) {
  return {
    id,
    fichier: "royaume.txt",
    texte: "Passage " + id,
    vecteur: vecteur(score * longueur, Math.sqrt(1 - score ** 2) * longueur)
  };
}

function index(passages = [passage("royaume-1", 1)]) {
  return { version: 1, modele: "gemini-embedding-001", dimension, passages };
}

async function fichierIndex(t, contenu) {
  const dossier = await mkdtemp(path.join(tmpdir(), "nova-rag-index-"));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const indexPath = path.join(dossier, "rag-index.json");
  await writeFile(indexPath, JSON.stringify(contenu), "utf8");
  return indexPath;
}

test("la recherche classe par cosinus, filtre et limite à trois extraits", async t => {
  const indexPath = await fichierIndex(t, index([
    passage("faible", 0.4, 100),
    passage("troisieme", 0.6, 20),
    passage("premier", 1, 2),
    passage("oppose", -1, 100),
    passage("quatrieme", 0.55, 50),
    passage("deuxieme", 0.8, 3)
  ]));
  let appel;
  const ai = { models: { embedContent: async request => {
    appel = request;
    return { embeddings: [{ values: vecteur(10) }] };
  } } };

  const resultats = await rechercher("  Où acheter une potion ?  ", { apiKey, indexPath, ai });
  assert.deepEqual(resultats.map(resultat => resultat.id), ["premier", "deuxieme", "troisieme"]);
  assert.equal(resultats[0].fichier, "royaume.txt");
  assert.equal(resultats[0].texte, "Passage premier");
  assert.ok(Math.abs(resultats[1].score - 0.8) < 1e-10);
  assert.equal(resultats[0].vecteur, undefined);
  assert.equal(appel.model, "gemini-embedding-001");
  assert.equal(appel.contents, "Où acheter une potion ?");
  assert.equal(appel.config.taskType, "RETRIEVAL_QUERY");
  assert.equal(appel.config.outputDimensionality, dimension);
});

test("la recherche retourne une liste vide sans passage assez proche", async t => {
  const indexPath = await fichierIndex(t, index([passage("faible", 0.2)]));
  const ai = { models: { embedContent: async () => ({ embeddings: [{ values: vecteur() }] }) } };
  assert.deepEqual(await rechercher("Une question", { apiKey, indexPath, ai }), []);
});

test("un index incompatible est refusé avant de vectoriser la question", async t => {
  let calls = 0;
  const ai = { models: { embedContent: async () => { calls++; } } };
  for (const metadata of [
    { version: 2 },
    { modele: "un-autre-modele" },
    { dimension: 3072 }
  ]) {
    const indexPath = await fichierIndex(t, { ...index(), ...metadata });
    await assert.rejects(rechercher("Une question", { apiKey, indexPath, ai }));
  }
  assert.equal(calls, 0);
});

test("un vecteur documentaire invalide est refusé avant l'appel Google", async t => {
  let calls = 0;
  const ai = { models: { embedContent: async () => { calls++; } } };
  for (const values of [Array(767).fill(1), Array(768).fill(0), vecteur().map((v, i) => i === 0 ? null : v)]) {
    const contenu = index();
    contenu.passages[0].vecteur = values;
    const indexPath = await fichierIndex(t, contenu);
    await assert.rejects(rechercher("Une question", { apiKey, indexPath, ai }));
  }
  assert.equal(calls, 0);
});

test("un index sans provenance ou texte exploitable est refusé avant l'appel Google", async t => {
  let calls = 0;
  const ai = { models: { embedContent: async () => { calls++; } } };
  for (const invalidSource of [{ id: null }, { fichier: "" }, { texte: 12 }]) {
    const contenu = index();
    Object.assign(contenu.passages[0], invalidSource);
    const indexPath = await fichierIndex(t, contenu);
    await assert.rejects(rechercher("Une question", { apiKey, indexPath, ai }));
  }
  assert.equal(calls, 0);
});

test("une réponse d'embedding vide ou de dimension différente est refusée", async t => {
  const indexPath = await fichierIndex(t, index());
  for (const reponse of [
    {},
    { embeddings: [{ values: Array(767).fill(1) }] },
    { embeddings: [{ values: Array(768).fill(0) }] },
    { embeddings: [{ values: vecteur().map((v, i) => i === 0 ? Infinity : v) }] }
  ]) {
    const ai = { models: { embedContent: async () => reponse } };
    await assert.rejects(rechercher("Une question", { apiKey, indexPath, ai }));
  }
});

test("le découpage conserve les frontières des longs documents", () => {
  const texte = "a".repeat(850) + "frontiere" + "b".repeat(850);
  const extraits = decouper(texte);
  assert.equal(extraits.length, 2);
  assert.ok(extraits.every(extrait => extrait.length <= 1000));
  assert.equal(extraits[0].slice(850), extraits[1].slice(0, 150));
  assert.equal(extraits[0] + extraits[1].slice(150), texte);
});

test("l'indexation associe les sources et normalise les embeddings documentaires", async () => {
  const documents = [
    { fichier: "royaume.txt", texte: "Mira vend les potions de soin." },
    { fichier: "chateau.md", texte: "La clé argentée ouvre la porte nord." }
  ];
  const appels = [];
  const ai = { models: { embedContent: async request => {
    appels.push(request);
    return { embeddings: [{ values: vecteur(3, 4) }] };
  } } };
  const resultat = await construireIndex(documents, { ai });
  assert.equal(resultat.version, 1);
  assert.equal(resultat.modele, "gemini-embedding-001");
  assert.equal(resultat.dimension, dimension);
  assert.equal(resultat.passages.length, 2);
  assert.equal(new Set(resultat.passages.map(p => p.id)).size, 2);
  assert.deepEqual(resultat.passages.map(p => p.fichier), documents.map(d => d.fichier));
  assert.deepEqual(resultat.passages.map(p => p.texte), documents.map(d => d.texte));
  for (const p of resultat.passages) {
    assert.equal(p.vecteur.length, dimension);
    assert.ok(Math.abs(Math.hypot(...p.vecteur) - 1) < 1e-10);
    assert.ok(Math.abs(p.vecteur[0] - 0.6) < 1e-10);
  }
  assert.equal(appels.length, 2);
  for (const appel of appels) {
    assert.equal(appel.model, "gemini-embedding-001");
    assert.equal(appel.config.taskType, "RETRIEVAL_DOCUMENT");
    assert.equal(appel.config.outputDimensionality, dimension);
  }
});

test("un corpus vide ou trop volumineux est refusé avant tout appel Google", async () => {
  let calls = 0;
  const ai = { models: { embedContent: async () => { calls++; } } };
  const valide = { fichier: "valide.txt", texte: "Un document valide." };
  const corpusInvalides = [
    [],
    [{ fichier: "vide.txt", texte: "   " }],
    Array.from({ length: 11 }, (_, i) => ({ fichier: `doc${i}.txt`, texte: "Texte" })),
    [valide, { fichier: "trop-long.txt", texte: "x".repeat(50001) }]
  ];
  for (const documents of corpusInvalides) {
    await assert.rejects(construireIndex(documents, { ai }));
  }
  assert.equal(calls, 0);
});
