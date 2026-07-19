// post.js — post.html: shows one blog post in full, with a like button,
// a view counter, and edit/delete controls visible only to its author.

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getPost, toggleLike, incrementViewCount, deletePost } from "./data.js";
import { formatDate, escapeHtml, getQueryParam } from "./utils.js";

const postId = getQueryParam("id");
const container = document.getElementById("post-container");

let currentUser = null;
let post = null;
let hasCountedView = false;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadPost();
});

async function loadPost() {
  if (!postId) {
    container.innerHTML = `<p class="empty-state">No post specified.</p>`;
    return;
  }

  try {
    post = await getPost(postId);
  } catch (error) {
    // Firestore denies the read (e.g. it's someone else's pending post) --
    // treated the same as "not found" from the visitor's point of view.
    post = null;
  }

  if (!post) {
    container.innerHTML = `<p class="empty-state">This post isn't available. It may have been removed, or is still awaiting approval.</p>`;
    return;
  }

  render();

  if (post.status === "approved" && !hasCountedView) {
    hasCountedView = true;
    incrementViewCount(postId).then(() => {
      post.viewCount = (post.viewCount || 0) + 1;
      const viewEl = document.getElementById("view-count");
      if (viewEl) viewEl.textContent = `\u{1F441} ${post.viewCount} views`;
    });
  }
}

function render() {
  // Progressive enhancement only: the browser tab title/description update
  // once the post has loaded. This does NOT make individual posts
  // crawlable by search engines, since the content still only exists in
  // Firestore, not in the static HTML a crawler first sees — see
  // docs/ARCHITECTURE.md for that tradeoff.
  document.title = `${post.title} — MIX`;
  const descriptionTag = document.querySelector('meta[name="description"]');
  if (descriptionTag) descriptionTag.setAttribute("content", post.body.slice(0, 160));

  const isOwner = currentUser && post.authorUid === currentUser.uid;
  const statusBadge = post.status !== "approved" ? `<span class="badge badge--${post.status}">${post.status}</span>` : "";
  const liked = Boolean(currentUser && post.likedBy?.includes(currentUser.uid));

  container.innerHTML = `
    <article class="post-detail card">
      ${statusBadge}
      <h1>${escapeHtml(post.title)}</h1>
      <p class="post-detail-meta">
        by <strong>${escapeHtml(post.authorUsername)}</strong> &middot;
        <span class="meta-dates">Posted ${formatDate(post.createdAt)}${post.editedAt ? ` &middot; Edited ${formatDate(post.editedAt)}` : ""}</span>
      </p>
      <p class="post-detail-body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>

      <div class="post-detail-actions">
        <button type="button" id="like-btn" class="btn ${liked ? "btn-primary" : "btn-outline"}" ${currentUser ? "" : "disabled title=\"Log in to like posts\""}>
          ${liked ? "❤ Liked" : "\u{1F90D} Like"} (<span id="like-count">${post.likedBy?.length || 0}</span>)
        </button>
        <span id="view-count" class="post-detail-views">\u{1F441} ${post.viewCount || 0} views</span>
      </div>

      ${isOwner ? `
        <div class="post-detail-owner-actions">
          <a href="write.html?edit=${post.id}" class="btn btn-outline btn-small">Edit</a>
          <button type="button" id="delete-btn" class="btn btn-danger btn-small">Delete</button>
        </div>` : ""}
    </article>`;

  if (currentUser) {
    document.getElementById("like-btn").addEventListener("click", async () => {
      const wasLiked = post.likedBy.includes(currentUser.uid);
      await toggleLike(post.id, currentUser.uid, wasLiked);
      post.likedBy = wasLiked
        ? post.likedBy.filter((uid) => uid !== currentUser.uid)
        : [...post.likedBy, currentUser.uid];
      render();
    });
  }

  if (isOwner) {
    document.getElementById("delete-btn").addEventListener("click", async () => {
      if (!confirm("Delete this post permanently? This can't be undone.")) return;
      await deletePost(post.id);
      window.location.href = "blog.html";
    });
  }
}
