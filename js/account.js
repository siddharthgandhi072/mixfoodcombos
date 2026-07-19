// account.js — logic for account.html: change username/password, and show
// the signed-in user their own posts + chat messages with like/view stats.

import { requireAuth, reauthenticate, changePassword } from "./auth.js";
import { getUserProfile, renameUsername, listUserPosts, listUserMessages, deletePost, deleteMessage } from "./data.js";
import { formatDate, escapeHtml, showMessage, clearMessage, friendlyAuthError } from "./utils.js";

let currentUser = null;
let currentProfile = null;

requireAuth(async (user) => {
  currentUser = user;
  currentProfile = await getUserProfile(user.uid);
  document.getElementById("account-email").textContent = currentProfile.email;
  document.getElementById("account-username-display").textContent = currentProfile.username;
  document.getElementById("username-input").value = currentProfile.username;

  await loadPosts();
  await loadMessages();
});

// ---- Change username ----------------------------------------------------
document.getElementById("username-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const newUsername = document.getElementById("username-input").value.trim();
  const password = document.getElementById("username-current-password").value;

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(newUsername)) {
    showMessage("Usernames must be 3-24 characters: letters, numbers, and underscores only.");
    return;
  }

  try {
    await reauthenticate(password);
    await renameUsername(currentUser.uid, currentProfile.usernameLower, newUsername);
    currentProfile.username = newUsername;
    currentProfile.usernameLower = newUsername.toLowerCase();
    document.getElementById("account-username-display").textContent = newUsername;
    document.getElementById("username-current-password").value = "";
    clearMessage();
    showMessage("Username updated. Note: posts you already made keep your old username.", "success");
  } catch (error) {
    showMessage(error.message === "username-taken" ? "That username is already taken." : friendlyAuthError(error));
  }
});

// ---- Change password ----------------------------------------------------
document.getElementById("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const current = document.getElementById("current-password").value;
  const next = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  if (next !== confirm) {
    showMessage("New passwords don't match.");
    return;
  }

  try {
    await reauthenticate(current);
    await changePassword(next);
    document.getElementById("password-form").reset();
    clearMessage();
    showMessage("Password updated.", "success");
  } catch (error) {
    showMessage(friendlyAuthError(error));
  }
});

// ---- My posts + stats -----------------------------------------------------
async function loadPosts() {
  const posts = await listUserPosts(currentUser.uid);
  posts.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const totalLikes = posts.reduce((sum, post) => sum + (post.likedBy?.length || 0), 0);
  const totalViews = posts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
  document.getElementById("total-likes").textContent = totalLikes;
  document.getElementById("total-views").textContent = totalViews;
  document.getElementById("total-posts").textContent = posts.length;

  const list = document.getElementById("my-posts-list");
  if (posts.length === 0) {
    list.innerHTML = `<p class="empty-state">You haven't posted anything yet. <a href="write.html">Write your first post</a>.</p>`;
    return;
  }

  list.innerHTML = posts.map(renderPostRow).join("");

  list.querySelectorAll("[data-delete-post]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this post permanently? This can't be undone.")) return;
      const postId = button.dataset.deletePost;
      await deletePost(postId);
      button.closest(".account-row").remove();
    });
  });
}

function renderPostRow(post) {
  const likes = post.likedBy?.length || 0;
  const views = post.viewCount || 0;
  const viewLink = post.status === "approved" ? `<a href="post.html?id=${post.id}" class="btn btn-secondary btn-small">View</a>` : "";
  return `
    <div class="account-row card">
      <div class="account-row-main">
        <h3>${escapeHtml(post.title)}</h3>
        <span class="badge badge--${post.status}">${post.status}</span>
        <p class="meta-dates">Posted ${formatDate(post.createdAt)}${post.editedAt ? ` · Edited ${formatDate(post.editedAt)}` : ""}</p>
        <p class="account-row-stats">${likes} like${likes === 1 ? "" : "s"} &middot; ${views} view${views === 1 ? "" : "s"}</p>
      </div>
      <div class="account-row-actions">
        ${viewLink}
        <a href="write.html?edit=${post.id}" class="btn btn-outline btn-small">Edit</a>
        <button type="button" class="btn btn-danger btn-small" data-delete-post="${post.id}">Delete</button>
      </div>
    </div>`;
}

// ---- My chat messages -----------------------------------------------------
async function loadMessages() {
  const messages = await listUserMessages(currentUser.uid);
  messages.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const list = document.getElementById("my-messages-list");
  if (messages.length === 0) {
    list.innerHTML = `<p class="empty-state">You haven't posted in chat yet. <a href="chat.html">Say hello</a>.</p>`;
    return;
  }

  list.innerHTML = messages.map(renderMessageRow).join("");

  list.querySelectorAll("[data-delete-message]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this message permanently?")) return;
      await deleteMessage(button.dataset.deleteMessage);
      button.closest(".account-row").remove();
    });
  });
}

function renderMessageRow(message) {
  return `
    <div class="account-row card">
      <div class="account-row-main">
        <span class="badge badge--${message.status}">${message.status}</span>
        ${message.parentId ? '<span class="badge badge--reply">reply</span>' : ""}
        <p>${escapeHtml(message.text)}</p>
        <p class="meta-dates">Posted ${formatDate(message.createdAt)}${message.editedAt ? ` · Edited ${formatDate(message.editedAt)}` : ""}</p>
      </div>
      <div class="account-row-actions">
        <a href="chat.html" class="btn btn-secondary btn-small">View in chat</a>
        <button type="button" class="btn btn-danger btn-small" data-delete-message="${message.id}">Delete</button>
      </div>
    </div>`;
}

function toMillis(timestamp) {
  return typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : 0;
}
