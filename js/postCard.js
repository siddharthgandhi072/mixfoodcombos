// postCard.js — renders one blog post as an HTML card. Shared by blog.js
// (the main feed) and search.js (search results) so both look identical.

import { formatDate, escapeHtml } from "./utils.js";

export function renderPostCard(post) {
  const likes = post.likedBy?.length || 0;
  const views = post.viewCount || 0;
  const statusBadge = post.status !== "approved" ? `<span class="badge badge--${post.status}">${post.status}</span>` : "";

  return `
    <a href="post.html?id=${post.id}" class="post-card card">
      <div class="post-card-body">
        <h3>${escapeHtml(post.title)} ${statusBadge}</h3>
        <p class="post-card-author">by ${escapeHtml(post.authorUsername)}</p>
        <p class="meta-dates">Posted ${formatDate(post.createdAt)}${post.editedAt ? ` &middot; Edited ${formatDate(post.editedAt)}` : ""}</p>
        <p class="post-card-stats">&#10084; ${likes} &middot; &#128065; ${views}</p>
      </div>
    </a>`;
}
