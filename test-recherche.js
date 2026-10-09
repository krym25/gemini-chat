import { rechercher } from "./rag.js";

async function main() {
  const question = process.argv.slice(2).join(" ") || "Qui vend les potions de soin ?";
  const passages = await rechercher(question);
  if (!passages.length) { console.log("Aucun extrait suffisamment proche."); return; }
  for (const passage of passages) {
    console.log(`\nSource : ${passage.id}\nScore : ${passage.score.toFixed(3)}\n${passage.texte}`);
  }
}
main().catch(error => {
  const cle = process.env.GEMINI_API_KEY?.trim();
  let message = String(error.message);
  if (cle) message = message.replaceAll(cle, "[CLE_MASQUEE]");
  console.error(message.replace(/AIza[\w-]{20,}/g, "[CLE_MASQUEE]"));
  process.exitCode = 1;
});
