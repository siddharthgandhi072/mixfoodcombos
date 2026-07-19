// chat.js — chat.html: post short messages (200-word limit) and reply to
// others in a simple two-level thread (replies can't themselves be
// replied to). Every message and reply needs admin approval before the
// rest of the community can see it, exactly like blog posts.

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  listTopLevelMessages, listReplies, createMessage, updateMessage, deleteMessage, getUserProfile,
} from "./data.js";
import { formatDate, escapeHtml, countWords } from "./utils.js";

const WORD_LIMIT = 200;

const feed = document.getElementById("chat-feed");
const composerForm = document.getElementById("composer-form");
const composerText = document.getElementById("composer-text");
const composerCount = document.getElementById("composer-count");
const composerSubmit = document.getElementById("composer-submit");
const loggedOutNotice = document.getElementById("composer-logged-out");

let currentUser = null;
let currentProfile = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    currentProfile = await getUserProfile(user.uid);
    composerForm.hidden = false;
    loggedOutNotice.hidden = true;
  } else {
    composerForm.hidden = true;
    loggedOutNotice.hidden = false;
  }
  await loadFeed();
});

wireWordCounter(composerText, composerCount, composerSubmit);

composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await postMessage(composerText.value, null);
  composerText.value = "";
  composerText.dispatchEvent(new Event("input"));
  await loadFeed();
});

async function postMessage(text, parentId) {
  const trimmed = text.trim();
  if (!trimmed || countWords(trimmed) > WORD_LIMIT) return;
  await createMessage({
    text: trimmed,
    authorUid: currentUser.uid,
    authorUsername: currentProfile.username,
    parentId,
  });
}

// Keeps a "N / 200 words" counter in sync with a textarea, and disables
// the matching submit button once you're over the limit or empty. Used
// for the main composer, every reply box, and every edit box.
function wireWordCounter(textarea, counterEl, submitBtn) {
  const update = () => {
    const words = countWords(textarea.value);
    counterEl.textContent = `${words} / ${WORD_LIMIT} words`;
    counterEl.classList.toggle("word-count--over", words > WORD_LIMIT);
    submitBtn.disabled = words === 0 || words > WORD_LIMIT;
  };
  textarea.addEventListener("input", update);
  update();
}

async function loadFeed() {
  const uid = currentUser ? currentUser.uid : null;
  const topLevel = await listTopLevelMessages(uid);

  if (topLevel.length === 0) {
    feed.innerHTML = `<p class="empty-state">No messages yet — say hello!</p>`;
    return;
  }

  feed.innerHTML = topLevel.map((message) => renderMessage(message, false)).join("");
  wireMessageActions(feed);

  for (const message of topLevel) {
    const replies = await listReplies(message.id, uid);
    if (replies.length === 0) continue;
    const container = feed.querySelector(`[data-replies-for="${message.id}"]`);
    if (!container) continue;
    container.innerHTML = replies.map((reply) => renderMessage(reply, true)).join("");
    wireMessageActions(container);
  }
}

function renderMessage(message, isReply) {
  const isOwner = currentUser && message.authorUid === currentUser.uid;
  const statusBadge = message.status !== "approved" ? `<span class="badge badge--${message.status}">${message.status}</span>` : "";
  const editedNote = message.editedAt ? ` &middot; Edited ${formatDate(message.editedAt)}` : "";

  const replyAction = !isReply && currentUser ? `<button type="button" class="link-button" data-reply="${message.id}">Reply</button>` : "";
  const ownerActions = isOwner ? `
      <button type="button" class="link-button" data-edit="${message.id}">Edit</button>
      <button type="button" class="link-button link-button--danger" data-delete="${message.id}">Delete</button>` : "";

  return `
    <div class="chat-message card ${isReply ? "chat-message--reply" : ""}" data-message-id="${message.id}">
      <p class="chat-message-meta">
        <strong>${escapeHtml(message.authorUsername)}</strong> ${statusBadge}
        <span class="meta-dates">Posted ${formatDate(message.createdAt)}${editedNote}</span>
      </p>
      <p class="chat-message-text" data-text>${escapeHtml(message.text)}</p>
      <div class="chat-message-actions">${replyAction}${ownerActions}</div>
      <div class="chat-reply-composer" data-reply-composer hidden></div>
      ${!isReply ? `<div class="chat-replies" data-replies-for="${message.id}"></div>` : ""}
    </div>`;
}

function wireMessageActions(scope) {
  scope.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => toggleReplyComposer(button));
  });
  scope.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => startEdit(button));
  });
  scope.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this message permanently?")) return;
      await deleteMessage(button.dataset.delete);
      await loadFeed();
    });
  });
}

function toggleReplyComposer(button) {
  const messageEl = button.closest(".chat-message");
  const composer = messageEl.querySelector(":scope > [data-reply-composer]");

  if (!composer.hidden) {
    composer.hidden = true;
    composer.innerHTML = "";
    return;
  }

  composer.hidden = false;
  composer.innerHTML = `
    <textarea class="reply-textarea" placeholder="Write a reply..."></textarea>
    <div class="reply-composer-footer">
      <span class="word-count">0 / ${WORD_LIMIT} words</span>
      <button type="button" class="btn btn-primary btn-small" disabled>Reply</button>
    </div>`;

  const textarea = composer.querySelector("textarea");
  const counter = composer.querySelector(".word-count");
  const submit = composer.querySelector("button");
  wireWordCounter(textarea, counter, submit);

  submit.addEventListener("click", async () => {
    await postMessage(textarea.value, button.dataset.reply);
    await loadFeed();
  });
}

function startEdit(button) {
  const messageId = button.dataset.edit;
  const messageEl = button.closest(".chat-message");
  const textEl = messageEl.querySelector("[data-text]");
  const currentText = textEl.textContent;

  messageEl.querySelector(".chat-message-actions").hidden = true;
  textEl.hidden = true;

  const editBox = document.createElement("div");
  editBox.className = "chat-edit-box";
  editBox.innerHTML = `
    <textarea class="reply-textarea"></textarea>
    <div class="reply-composer-footer">
      <span class="word-count"></span>
      <button type="button" class="btn btn-primary btn-small">Save</button>
      <button type="button" class="btn btn-outline btn-small">Cancel</button>
    </div>`;
  textEl.insertAdjacentElement("afterend", editBox);

  const textarea = editBox.querySelector("textarea");
  textarea.value = currentText;
  const counter = editBox.querySelector(".word-count");
  const [saveBtn, cancelBtn] = editBox.querySelectorAll("button");
  wireWordCounter(textarea, counter, saveBtn);

  saveBtn.addEventListener("click", async () => {
    const trimmed = textarea.value.trim();
    if (!trimmed || countWords(trimmed) > WORD_LIMIT) return;
    await updateMessage(messageId, trimmed);
    await loadFeed();
  });
  cancelBtn.addEventListener("click", () => loadFeed());
}
