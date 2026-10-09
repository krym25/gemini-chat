import { GoogleGenAI } from "@google/genai";
import { readFile, readdir, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MODELE_EMBEDDING, DIMENSION, verifierVecteur } from "./rag.js";

export function decouper(texte, taille = 1000, chevauchement = 150) {
  if (typeof texte !== "string" || !Number.isInteger(taille) || taille < 1
    || !Number.isInteger(chevauchement) || chevauchement < 0 || chevauchement >= taille) {
    throw new Error("Découpage invalide : il faut 0 <= chevauchement < taille.");
  }
  const extraits = [];
  for (let debut = 0; debut < texte.length; debut += taille - chevauchement) {
    const extrait = texte.slice(debut, debut + taille).trim();
    if (extrait) extraits.push(extrait);
    if (debut + taille >= texte.length) break;
  }
  return extraits;
}

export async function construireIndex(documents, {
  ai,
  apiKey = process.env.GEMINI_API_KEY?.trim() || "",
  onProgress = () => {}
} = {}) {
  if (!Array.isArray(documents) || !documents.length || documents.length > 10) {
    throw new Error("Place entre 1 et 10 documents .txt ou .md dans documents/.");
  }
  const noms = new Set();
  // Valider tout le corpus avant le premier appel à Google.
  for (const document of documents) {
    if (!document || typeof document.fichier !== "string" || document.fichier.length > 120
      || !/\.(txt|md)$/i.test(document.fichier) || /[\r\n\\/]/.test(document.fichier)
      || noms.has(document.fichier) || typeof document.texte !== "string"
      || !document.texte.trim() || document.texte.length > 50000) {
      throw new Error("Document invalide : nom .txt/.md unique et texte non vide limité à 50 000 caractères.");
    }
    noms.add(document.fichier);
  }
  if (!ai && !apiKey) throw new Error("GEMINI_API_KEY manque dans .env.");
  const client = ai || new GoogleGenAI({ apiKey });
  const passages = [];
  const prefixes = new Set();
  for (const [documentIndex, document] of documents.entries()) {
    let prefixe = document.fichier.replace(/\.(txt|md)$/i, "").normalize("NFD")
      .replace(/\p{M}/gu, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "document";
    while (prefixes.has(prefixe)) prefixe += "-" + (documentIndex + 1);
    prefixes.add(prefixe);
    const extraits = decouper(document.texte);
    for (const [i, extrait] of extraits.entries()) {
      const resultat = await client.models.embedContent({
        model: MODELE_EMBEDDING,
        contents: extrait,
        config: {
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: DIMENSION,
          httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } }
        }
      });
      const vecteur = resultat.embeddings?.[0]?.values;
      const norme = verifierVecteur(vecteur);
      passages.push({ id: `${prefixe}-${i + 1}`, fichier: document.fichier, texte: extrait,
        vecteur: vecteur.map(nombre => nombre / norme) });
      onProgress(document.fichier, i + 1, extraits.length);
    }
  }
  return { version: 1, modele: MODELE_EMBEDDING, dimension: DIMENSION, passages };
}

async function main() {
  const dossierDocuments = new URL("./documents/", import.meta.url);
  const fichiers = (await readdir(dossierDocuments, { withFileTypes: true }))
    .filter(entree => entree.isFile() && /\.(txt|md)$/i.test(entree.name))
    .map(entree => entree.name).sort();
  if (!fichiers.length || fichiers.length > 10) {
    throw new Error("Place entre 1 et 10 fichiers .txt ou .md dans documents/.");
  }
  const documents = await Promise.all(fichiers.map(async fichier => ({
    fichier,
    texte: await readFile(path.join(fileURLToPath(dossierDocuments), fichier), "utf8")
  })));
  const index = await construireIndex(documents, {
    onProgress: (fichier, i, total) => console.log(`${fichier} : extrait ${i}/${total} vectorisé.`)
  });
  const dossier = fileURLToPath(new URL("./data/", import.meta.url));
  await mkdir(dossier, { recursive: true });
  const destination = path.join(dossier, "rag-index.json");
  const temporaire = path.join(dossier, ".index-" + randomUUID() + ".tmp");
  try {
    await writeFile(temporaire, JSON.stringify(index, null, 2), "utf8");
    await rename(temporaire, destination);
  } finally { await rm(temporaire, { force: true }); }
  console.log(`Index sauvegardé : ${index.passages.length} extrait(s), ${documents.length} document(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  main().catch(error => {
    const cle = process.env.GEMINI_API_KEY?.trim();
    let message = String(error.message);
    if (cle) message = message.replaceAll(cle, "[CLE_MASQUEE]");
    console.error(message.replace(/AIza[\w-]{20,}/g, "[CLE_MASQUEE]"));
    process.exitCode = 1;
  });
}
