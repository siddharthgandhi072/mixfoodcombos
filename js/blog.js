// blog.js — blog.html: lists posts magazine-style, newest first. You also
// see your own pending/rejected posts here (so you can track them);
// everyone else's posts only show up once approved.

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { listBlogFeed } from "./data.js";
import { renderPostCard } from "./postCard.js";

const list = document.getElementById("blog-list");

onAuthStateChanged(auth, async (user) => {
  const posts = await listBlogFeed(user ? user.uid : null);
  render(posts);
});

function render(posts) {
  if (posts.length === 0) {
    list.innerHTML = `<p class="empty-state">No posts yet — <a href="write.html">be the first to share a combo</a>.</p>`;
    return;
  }
  list.innerHTML = posts.map(renderPostCard).join("");
}
