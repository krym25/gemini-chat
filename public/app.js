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
  resizeInput();
}
function reset() {
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

function addMessage(role, text) {
  welcome.hidden = true;
  conversation.classList.remove("is-empty");
  const article = document.createElement("article");
  article.className = "message " + role;
  article.setAttribute("aria-label", role === "user" ? "Ton message" : "Réponse de Nova");
  if (role === "model") {
    const author = document.createElement("div");
    author.className = "message-author";
    const mark = document.createElement("span");
    mark.className = "message-mark";
    mark.textContent = "N";
    mark.setAttribute("aria-hidden", "true");
    author.append(mark, document.createTextNode("Nova"));
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
      body: JSON.stringify({ message: question }),
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
  if (typeof data?.reply !== "string" || !data.reply.trim()) {
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
    pending.querySelector(".message-text").textContent = data.reply;
    pending.classList.remove("thinking");
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
resizeInput();
