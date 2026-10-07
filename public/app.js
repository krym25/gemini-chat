let phase = 1;
let context = "";
let working = false;
const input = document.getElementById("message");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const conversation = document.getElementById("conversation");
const welcome = document.getElementById("welcome");
const errorBox = document.getElementById("error");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const shade = document.getElementById("shade");
const modes = {
  1: {
    label: "Chat simple", kicker: "Un peu de curiosité ?", title: "Qu’as-tu en tête ?",
    description: "Une question, une idée, ou simplement l’envie de discuter.",
    hint: "Une question, une réponse. La curiosité fait le reste.",
    prompts: [
      ["Apprendre", "Comprendre quelque chose", "Explique-moi un concept intéressant simplement, avec un exemple."],
      ["Écrire", "Trouver les bons mots", "Aide-moi à trouver une idée pour écrire une courte histoire."],
      ["Imaginer", "Faire naître une idée", "Propose-moi trois idées créatives pour un petit projet."]
    ]
  },
  2: {
    label: "Conversation suivie", kicker: "Prenons le temps d’en parler", title: "On réfléchit ensemble ?",
    description: "Un espace pour échanger, creuser une idée et garder le fil.",
    hint: "Une discussion qui avance avec toi, d’une question à l’autre.",
    prompts: [
      ["Faire connaissance", "Commencer la discussion", "J’aimerais faire connaissance. Pose-moi une question pour commencer."],
      ["Réfléchir", "Construire une idée ensemble", "J’ai une idée de projet. Aide-moi à la préciser en me posant des questions."],
      ["Apprendre", "Avancer à mon rythme", "J’aimerais apprendre quelque chose de nouveau. Aide-moi à choisir un sujet."]
    ]
  },
  3: {
    label: "Roi démon", kicker: "Le royaume des Cendres", title: "Entre, mortel.",
    description: "Le trône de Varkhos t’attend. À toi de choisir ton destin.",
    hint: "Un autre monde. Un roi démon. Ton histoire à inventer.",
    prompts: [
      ["L’invocation", "Découvrir ce nouveau monde", "Je viens d’être invoqué devant ton trône. Où suis-je ?"],
      ["Le pacte", "Négocier avec le roi", "Je souhaite conclure un pacte avec toi. Quel en serait le prix ?"],
      ["La quête", "Partir à l’aventure", "Donne-moi une première quête pour prouver ma valeur dans ton royaume."]
    ]
  }
};

function menu(open) {
  sidebar.classList.toggle("open", open);
  shade.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  if (open) sidebar.querySelector(".new-chat").focus();
}
menuToggle.addEventListener("click", () => menu(!sidebar.classList.contains("open")));
shade.addEventListener("click", () => menu(false));
document.addEventListener("keydown", event => { if (event.key === "Escape") menu(false); });
window.addEventListener("resize", () => { if (window.innerWidth > 760) menu(false); resizeInput(); });

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(Math.max(input.scrollHeight, 42), 160) + "px";
  send.disabled = working || !input.value.trim();
}
input.addEventListener("input", resizeInput);
function busy(value) {
  working = value;
  document.querySelectorAll("[data-phase], [data-suggestion], .new-chat, #message").forEach(element => element.disabled = value);
  resizeInput();
}
function reset() {
  context = "";
  messages.replaceChildren();
  input.value = "";
  welcome.hidden = false;
  conversation.classList.add("is-empty");
  errorBox.hidden = true;
  document.getElementById("status").textContent = "";
  resizeInput();
  menu(false);
}
document.querySelectorAll(".new-chat").forEach(button => button.addEventListener("click", () => { reset(); input.focus(); }));

function chooseMode(value) {
  phase = value;
  reset();
  const mode = modes[phase];
  document.body.classList.toggle("demon", phase === 3);
  document.getElementById("current-mode").textContent = mode.label;
  document.getElementById("assistant-label").textContent = phase === 3 ? "Varkhos" : "Nova";
  document.getElementById("welcome-kicker").textContent = mode.kicker;
  document.getElementById("welcome-title").textContent = mode.title;
  document.getElementById("welcome-description").textContent = mode.description;
  document.getElementById("mode-hint").textContent = mode.hint;
  input.placeholder = phase === 3 ? "Message à Varkhos…" : "Message à Nova…";
  document.querySelectorAll("[data-phase]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.phase) === phase)));
  document.querySelectorAll("[data-suggestion]").forEach((button, index) => {
    button.querySelector("strong").textContent = mode.prompts[index][0];
    button.querySelector("small").textContent = mode.prompts[index][1];
  });
}
document.querySelectorAll("[data-phase]").forEach(button => button.addEventListener("click", () => {
  if (Number(button.dataset.phase) !== phase) chooseMode(Number(button.dataset.phase));
}));
document.querySelectorAll("[data-suggestion]").forEach(button => button.addEventListener("click", () => {
  input.value = modes[phase].prompts[Number(button.dataset.suggestion)][2];
  resizeInput();
  input.focus();
}));

function addMessage(role, text) {
  welcome.hidden = true;
  conversation.classList.remove("is-empty");
  const article = document.createElement("article");
  article.className = "message " + role;
  article.setAttribute("aria-label", role === "user" ? "Ton message" : phase === 3 ? "Réponse de Varkhos" : "Réponse de Nova");
  if (role === "model") {
    const author = document.createElement("div");
    author.className = "message-author";
    const mark = document.createElement("span");
    mark.className = "message-mark";
    mark.textContent = "✦";
    mark.setAttribute("aria-hidden", "true");
    author.append(mark, document.createTextNode(phase === 3 ? "Varkhos" : "Nova"));
    article.append(author);
  }
  const content = document.createElement("p");
  content.className = "message-text";
  content.textContent = text;
  article.append(content);
  messages.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}

async function ask(question) {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, message: question, context: phase === 1 ? "" : context }),
      signal: AbortSignal.timeout(40000)
    });
  } catch { throw new Error("La connexion a été interrompue. Réessaie dans un instant."); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("L’assistant est momentanément indisponible. Réessaie dans un instant."); }
  if (!data || typeof data !== "object") throw new Error("L’assistant est momentanément indisponible. Réessaie dans un instant.");
  if (!response.ok) {
    if (data.googleStatus === 429) throw new Error("L’assistant reçoit beaucoup de demandes. Patiente un moment, puis réessaie.");
    if (response.status === 400) throw new Error("Ce message n’a pas pu être envoyé. Essaie avec un message plus court.");
    throw new Error("L’assistant est momentanément indisponible. Réessaie dans un instant.");
  }
  if (typeof data.reply !== "string" || typeof data.context !== "string") throw new Error("La réponse n’a pas pu être affichée. Réessaie.");
  return data;
}
document.getElementById("chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || working) return;
  errorBox.hidden = true;
  const userMessage = addMessage("user", question);
  const pending = addMessage("model", "Un instant…");
  pending.classList.add("thinking");
  input.value = "";
  busy(true);
  document.getElementById("status").textContent = "Réponse en cours.";
  try {
    const data = await ask(question);
    context = data.context;
    pending.querySelector(".message-text").textContent = data.reply;
    pending.classList.remove("thinking");
    document.getElementById("status").textContent = "Réponse reçue.";
  } catch (error) {
    userMessage.remove();
    pending.remove();
    input.value = question;
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    if (!messages.children.length) { welcome.hidden = false; conversation.classList.add("is-empty"); }
    document.getElementById("status").textContent = "Le message n’a pas été envoyé.";
  } finally {
    busy(false);
    conversation.scrollTop = conversation.scrollHeight;
    input.focus();
  }
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!send.disabled) document.getElementById("chat-form").requestSubmit();
  }
});
chooseMode(1);
