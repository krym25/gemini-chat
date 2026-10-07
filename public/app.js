// Seul ce résumé est renvoyé au serveur ; les messages affichés restent dans la page.
let context = "";
const phase = document.getElementById("phase");
const message = document.getElementById("message");
const messages = document.getElementById("messages");
const status = document.getElementById("status");
const errorBox = document.getElementById("error");
const memory = document.getElementById("context-value");
const explanations = {
  1: "Chaque question est indépendante.",
  2: "Gemini construit un résumé des informations utiles et le met à jour après chaque réponse.",
  3: "Varkhos, roi démon, utilise ce contexte pour poursuivre ton aventure isekai."
};

function showError(text) {
  errorBox.textContent = text;
  errorBox.hidden = false;
}
function busy(value) {
  document.querySelectorAll("button, select, textarea").forEach(element => element.disabled = value);
}
function reset() {
  context = "";
  memory.textContent = "Aucun contexte pour le moment.";
  messages.replaceChildren();
  message.value = "";
  errorBox.hidden = true;
}
function addMessage(role, text) {
  messages.querySelector(".welcome")?.remove();
  const box = document.createElement("article");
  box.className = "message " + role;
  const name = document.createElement("strong");
  name.textContent = role === "user" ? "Toi" : phase.value === "3" ? "Varkhos" : "Gemini";
  const content = document.createElement("p");
  content.textContent = text;
  box.append(name, content);
  messages.append(box);
}
async function ask(body) {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000)
    });
  } catch {
    throw new Error("Le serveur ne répond pas. Laisse le terminal npm start ouvert et utilise http://127.0.0.1:3000.");
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Réponse inattendue : vérifie l'adresse du site et le démarrage du serveur."); }
  if (!response.ok) throw new Error(data.error || "Erreur HTTP " + response.status);
  return data;
}

phase.addEventListener("change", () => {
  reset();
  const demon = phase.value === "3";
  document.getElementById("explanation").textContent = explanations[phase.value];
  document.getElementById("character").hidden = !demon;
  document.getElementById("memory").hidden = phase.value === "1";
  document.getElementById("title").textContent = demon ? "Varkhos, roi démon" : "Chat Gemini";
  document.body.classList.toggle("demon", demon);
  message.placeholder = demon ? "Je viens d'être invoqué dans ton royaume…" : "Bonjour !";
});
document.getElementById("reset").addEventListener("click", reset);

document.getElementById("chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  const question = message.value.trim();
  if (!question) return;
  busy(true);
  errorBox.hidden = true;
  status.textContent = "Réponse en cours…";
  try {
    const selectedPhase = Number(phase.value);
    const data = await ask({
      phase: selectedPhase,
      message: question,
      context: selectedPhase === 1 ? "" : context
    });
    // La mémoire ne change qu'après un envoi réussi.
    context = data.context;
    memory.textContent = context || "Aucun contexte pour le moment.";
    addMessage("user", question);
    addMessage("model", data.reply);
    message.value = "";
    status.textContent = "Réponse reçue — " + data.model;
  } catch (error) {
    showError(error.message);
    status.textContent = "Envoi échoué. Tu peux réessayer sans perdre le contexte.";
  } finally {
    busy(false);
    message.focus();
  }
});

document.getElementById("test").addEventListener("click", async () => {
  busy(true);
  errorBox.hidden = true;
  status.textContent = "Test de Gemini…";
  try {
    const data = await ask({ phase: 1, message: "Réponds uniquement par OK." });
    status.textContent = "Gemini répond : " + data.reply + " — " + data.model;
  } catch (error) {
    showError(error.message);
    status.textContent = "Le détail du refus est affiché ci-dessous.";
  } finally { busy(false); }
});

if (location.protocol === "file:") {
  showError("Démarre npm start, puis ouvre http://127.0.0.1:3000 dans ton navigateur.");
  busy(true);
} else {
  fetch("/api/health").then(response => {
    if (!response.ok) throw new Error("Serveur indisponible");
    return response.json();
  }).then(data => {
    status.textContent = data.keyConfigured
      ? "Serveur prêt. Clique sur « Tester Gemini » pour vérifier ta clé."
      : "Remplis GEMINI_API_KEY dans .env, puis redémarre npm start.";
  }).catch(() => showError("API introuvable : lance npm start et ouvre http://127.0.0.1:3000."));
}
