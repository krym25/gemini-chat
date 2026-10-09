import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) throw new Error("GEMINI_API_KEY manque : lance node --env-file=.env test-embedding.js.");
const ai = new GoogleGenAI({ apiKey });
async function main() {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: "Les potions de soin restaurent la santé du joueur.",
    config: {
      taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768,
      httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } }
    }
  });
  const vector = response.embeddings?.[0]?.values;
  if (!vector || vector.length !== 768) throw new Error("Le vecteur reçu est invalide.");
  console.log("Embedding créé :", vector.length, "dimensions.");
}
main().catch(error => {
  console.error(String(error.message).replaceAll(apiKey, "[CLE_MASQUEE]").replace(/AIza[\w-]{20,}/g, "[CLE_MASQUEE]"));
  process.exitCode = 1;
});
