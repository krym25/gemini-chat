const TIMEOUT_MS = 60000;

const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const conversation = document.getElementById("conversation");
const welcome = document.getElementById("welcome");
const errorBox = document.getElementById("error");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const shade = document.getElementById("shade");
const closeMenu = document.getElementById("menu-close");
const chat = document.querySelector("main.chat");
const status = document.getElementById("status");
const newChatButtons = document.querySelectorAll(".new-chat");
const modeButtons = document.querySelectorAll("[data-phase]");
const modes = {
  1: { label: "Chat simple", title: "Qu’as-tu en tête ?", assistant: "Nova" },
  2: { label: "Conversation suivie", title: "On réfléchit ensemble ?", assistant: "Nova" },
  3: { label: "Roi démon", title: "Entre, mortel.", assistant: "Varkhos" },
  4: { label: "Documents · RAG", title: "Que veux-tu savoir sur tes documents ?", assistant: "Nova" }
};

let phase = 1;
let context = "";
let working = false;
let menuFocus = null;

function menu(open, restoreFocus = true) {
  if (open && window.innerWidth > 760) return;
  const wasOpen = sidebar.classList.contains("open");
  if (open && !wasOpen) menuFocus = document.activeElement;
  sidebar.classList.toggle("open", open);
  shade.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  chat.inert = open;
  if (open) {
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    (sidebar.querySelector(".new-chat:not(:disabled)") || closeMenu).focus();
  } else {
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    if (wasOpen && restoreFocus && menuFocus?.getClientRects().length) menuFocus.focus();
    menuFocus = null;
  }
}
menuToggle.addEventListener("click", () => menu(!sidebar.classList.contains("open")));
shade.addEventListener("click", () => menu(false));
closeMenu.addEventListener("click", () => menu(false));
document.addEventListener("keydown", event => {
  if (!sidebar.classList.contains("open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    menu(false);
  } else if (event.key === "Tab") {
    const buttons = [...sidebar.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 760 && sidebar.classList.contains("open")) menu(false, false);
  resizeInput();
});

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(Math.max(input.scrollHeight, 42), 160) + "px";
  send.disabled = working || !input.value.trim();
}
input.addEventListener("input", resizeInput);
function busy(value) {
  working = value;
  input.disabled = value;
  newChatButtons.forEach(button => button.disabled = value);
  modeButtons.forEach(button => button.disabled = value);
  resizeInput();
}
function reset() {
  context = "";
  messages.replaceChildren();
  input.value = "";
  welcome.hidden = false;
  conversation.classList.add("is-empty");
  errorBox.hidden = true;
  status.textContent = "";
  resizeInput();
  menu(false, false);
}
newChatButtons.forEach(button => button.addEventListener("click", () => {
  reset();
  input.focus();
}));

function chooseMode(value) {
  phase = value;
  reset();
  const mode = modes[phase];
  document.body.classList.toggle("demon", phase === 3);
  document.getElementById("current-mode").textContent = mode.label;
  document.getElementById("assistant-label").textContent = mode.assistant;
  document.getElementById("welcome-title").textContent = mode.title;
  input.placeholder = "Message à " + mode.assistant + "…";
  modeButtons.forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.phase) === phase)));
  input.focus();
}
modeButtons.forEach(button => button.addEventListener("click", () => {
  const value = Number(button.dataset.phase);
  if (!working && value !== phase) chooseMode(value);
}));

function addMessage(role, text) {
  welcome.hidden = true;
  conversation.classList.remove("is-empty");
  const article = document.createElement("article");
  article.className = "message " + role;
  const assistant = modes[phase].assistant;
  article.setAttribute("aria-label", role === "user" ? "Ton message" : "Réponse de " + assistant);
  if (role === "model") {
    const author = document.createElement("div");
    author.className = "message-author";
    const mark = document.createElement("span");
    mark.className = "message-mark";
    mark.textContent = "✦";
    mark.setAttribute("aria-hidden", "true");
    author.append(mark, document.createTextNode(assistant));
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
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response;
  let data;
  try {
    response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, message: question, context: phase === 1 ? "" : context }),
      signal
    });
    data = await response.json();
  } catch {
    throw new Error(signal.aborted ? "Délai dépassé. Réessaie." : "Nova est indisponible. Réessaie.");
  }
  if (!response.ok) {
    if (response.status === 429 || data?.googleStatus === 429) throw new Error("Trop de demandes. Réessaie dans un instant.");
    if (response.status === 400) throw new Error("Ce message est trop long ou invalide.");
    if (typeof data?.error === "string" && data.error.trim()) throw new Error(data.error);
    throw new Error("Nova est indisponible. Réessaie.");
  }
  if (typeof data?.reply !== "string" || !data.reply.trim() || typeof data.context !== "string") {
    throw new Error("La réponse n’a pas pu être affichée. Réessaie.");
  }
  return data;
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  const draft = input.value;
  const question = draft.trim();
  if (!question || working) return;
  errorBox.hidden = true;
  const userMessage = addMessage("user", question);
  const pending = addMessage("model", "Un instant…");
  pending.classList.add("thinking");
  input.value = "";
  busy(true);
  status.textContent = "Réponse en cours.";
  try {
    const data = await ask(question);
    context = data.context;
    pending.querySelector(".message-text").textContent = data.reply;
    pending.classList.remove("thinking");
    if (Array.isArray(data.sources) && data.sources.length) {
      const references = document.createElement("p");
      references.textContent = "Extraits retrouvés : " + data.sources
        .map(source => `[${source.id}] ${source.fichier}`)
        .join(" · ");
      pending.append(references);
    }
    status.textContent = "Réponse reçue.";
  } catch (error) {
    userMessage.remove();
    pending.remove();
    input.value = draft;
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    if (!messages.children.length) {
      welcome.hidden = false;
      conversation.classList.add("is-empty");
    }
    status.textContent = "Le message n’a pas été envoyé.";
  } finally {
    busy(false);
    conversation.scrollTop = conversation.scrollHeight;
    input.focus();
  }
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!send.disabled) form.requestSubmit();
  }
});
chooseMode(phase);
