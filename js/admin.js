// admin.js — admin.html: review queues for pending blog posts and pending
// chat messages/replies. Approving or rejecting updates Firestore (which
// makes the item visible, or keeps it hidden forever) and emails the
// author via EmailJS. The admin is never emailed about new submissions —
// this page is checked manually, whenever the admin chooses to log in.

import { requireAdmin } from "./auth.js";
import { listPending, approveItem, rejectItem, getUserProfile } from "./data.js";
import { sendApprovalEmail, sendRejectionEmail } from "./emailjs-init.js";
import { formatDate, escapeHtml } from "./utils.js";

// Remembers the full item behind each queue card so a decision doesn't
// need to re-fetch anything to know who to email and what about.
const itemCache = new Map();

requireAdmin(() => {
  loadQueue("posts");
  loadQueue("chat");
});

async function loadQueue(kind) {
  const listEl = document.getElementById(kind === "posts" ? "pending-posts" : "pending-messages");
  const countEl = document.getElementById(kind === "posts" ? "pending-posts-count" : "pending-messages-count");

  const items = await listPending(kind);
  items.forEach((item) => itemCache.set(item.id, { item, kind }));
  countEl.textContent = items.length;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="empty-state">Nothing waiting for review.</p>`;
    return;
  }

  listEl.innerHTML = items.map((item) => renderQueueItem(item, kind)).join("");

  listEl.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => handleDecision(button.dataset.approve, kind, "approve"));
  });
  listEl.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => handleDecision(button.dataset.reject, kind, "reject"));
  });
}

function renderQueueItem(item, kind) {
  const isPost = kind === "posts";
  const title = isPost ? escapeHtml(item.title) : `Message from ${escapeHtml(item.authorUsername)}`;
  const bodyText = isPost ? item.body : item.text;
  const truncated = bodyText.length > 240 ? `${bodyText.slice(0, 240)}…` : bodyText;
  const replyNote = !isPost && item.parentId ? `<span class="badge badge--reply">reply</span>` : "";

  return `
    <div class="queue-item card" data-id="${item.id}">
      <div class="queue-item-body">
        <h3>${title} ${replyNote}</h3>
        <p>${escapeHtml(truncated)}</p>
        <p class="meta-dates">by ${escapeHtml(item.authorUsername)} &middot; Posted ${formatDate(item.createdAt)}${item.editedAt ? ` &middot; Edited ${formatDate(item.editedAt)}` : ""}</p>
      </div>
      <div class="queue-item-actions">
        <button type="button" class="btn btn-primary btn-small" data-approve="${item.id}">Approve</button>
        <button type="button" class="btn btn-danger btn-small" data-reject="${item.id}">Reject</button>
      </div>
    </div>`;
}

async function handleDecision(itemId, kind, decision) {
  const cached = itemCache.get(itemId);
  const itemEl = document.querySelector(`.queue-item[data-id="${itemId}"]`);
  itemEl.querySelectorAll("button").forEach((button) => (button.disabled = true));

  try {
    if (decision === "approve") {
      await approveItem(kind, itemId);
    } else {
      await rejectItem(kind, itemId);
    }

    // Best-effort: the moderation decision already succeeded above, so we
    // don't want a slow/misconfigured EmailJS setup to block the UI.
    notifyAuthor(cached.item, kind, decision).catch((error) => console.warn("Email notification failed:", error));

    itemEl.remove();
    refreshCount(kind);
  } catch (error) {
    alert("Something went wrong. Please try again.");
    itemEl.querySelectorAll("button").forEach((button) => (button.disabled = false));
  }
}

async function notifyAuthor(item, kind, decision) {
  const profile = await getUserProfile(item.authorUid);
  if (!profile?.email) return;

  const payload = {
    toEmail: profile.email,
    toName: item.authorUsername,
    itemTitle: kind === "posts" ? item.title : item.text.slice(0, 60),
    kind: kind === "posts" ? "blog post" : "chat message",
  };

  if (decision === "approve") await sendApprovalEmail(payload);
  else await sendRejectionEmail(payload);
}

function refreshCount(kind) {
  const listEl = document.getElementById(kind === "posts" ? "pending-posts" : "pending-messages");
  const countEl = document.getElementById(kind === "posts" ? "pending-posts-count" : "pending-messages-count");
  const remaining = listEl.querySelectorAll(".queue-item").length;
  countEl.textContent = remaining;
  if (remaining === 0) listEl.innerHTML = `<p class="empty-state">Nothing waiting for review.</p>`;
}
