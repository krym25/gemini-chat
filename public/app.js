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
  document.querySelectorAll("[data-prompt], .new-chat, #message").forEach(element => element.disabled = value);
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

document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => {
  input.value = button.dataset.prompt;
  resizeInput();
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
    mark.textContent = "✦";
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
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, context }),
      signal: AbortSignal.timeout(60000)
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
resizeInput();
