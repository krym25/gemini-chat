import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";

export const MODELE_EMBEDDING = "gemini-embedding-001";
export const DIMENSION = 768;

export function verifierVecteur(vecteur) {
  if (!Array.isArray(vecteur) || vecteur.length !== DIMENSION || !vecteur.every(Number.isFinite)) {
    throw new Error("Un vecteur est invalide ou sa dimension est incompatible.");
  }
  const norme = Math.hypot(...vecteur);
  if (!Number.isFinite(norme) || norme === 0) throw new Error("Un vecteur est nul ou invalide.");
  return norme;
}

function similariteCosinus(a, b) {
  const normeA = verifierVecteur(a);
  const normeB = verifierVecteur(b);
  return a.reduce((somme, valeur, i) => somme + (valeur / normeA) * (b[i] / normeB), 0);
}

export async function rechercher(question, {
  apiKey = process.env.GEMINI_API_KEY?.trim() || "",
  indexPath = new URL("./data/rag-index.json", import.meta.url),
  ai,
  signal
} = {}) {
  if (typeof question !== "string" || !question.trim() || question.length > 2000) {
    throw new Error("La question doit contenir entre 1 et 2000 caractères.");
  }
  let contenu;
  try { contenu = await readFile(indexPath, "utf8"); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const absent = new Error("Index absent : lance indexer.cmd ou npm run index pour le créer.");
    absent.code = "RAG_INDEX_MISSING";
    throw absent;
  }
  const index = JSON.parse(contenu);
  if (!index || index.version !== 1 || index.modele !== MODELE_EMBEDDING || index.dimension !== DIMENSION
    || !Array.isArray(index.passages) || !index.passages.length || index.passages.length > 600) {
    throw new Error("Index incompatible : relance indexer.js avec le même modèle et la même dimension.");
  }
  const ids = new Set();
  for (const passage of index.passages) {
    if (!passage || typeof passage.id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(passage.id)
      || ids.has(passage.id) || typeof passage.fichier !== "string" || passage.fichier.length > 120
      || !/\.(txt|md)$/i.test(passage.fichier) || /[\r\n\\/]/.test(passage.fichier)
      || typeof passage.texte !== "string" || !passage.texte.trim() || passage.texte.length > 1000) {
      throw new Error("Un passage de l'index est invalide : reconstruis l'index.");
    }
    ids.add(passage.id);
    verifierVecteur(passage.vecteur);
  }
  if (!ai && !apiKey) throw new Error("GEMINI_API_KEY manque dans .env.");
  const client = ai || new GoogleGenAI({ apiKey });
  const resultat = await client.models.embedContent({
    model: MODELE_EMBEDDING,
    contents: question.trim(),
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: DIMENSION,
      abortSignal: signal,
      httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } }
    }
  });
  const vecteurQuestion = resultat.embeddings?.[0]?.values;
  verifierVecteur(vecteurQuestion);
  return index.passages.map(passage => ({
    id: passage.id, fichier: passage.fichier, texte: passage.texte,
    score: similariteCosinus(vecteurQuestion, passage.vecteur)
  }))
    .filter(passage => passage.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
