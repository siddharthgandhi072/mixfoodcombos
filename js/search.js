// search.js — search.html: a simple client-side keyword search over
// approved blog posts. Every word in the search box is looked for in each
// post's title and body; title matches count for more (x3) than body
// matches, and ties are broken by newest first. This is a naive full scan
// (fine at blog scale) rather than a real search engine — see
// docs/ARCHITECTURE.md for the tradeoff and a future upgrade path.

import { listAllApprovedPosts } from "./data.js";
import { renderPostCard } from "./postCard.js";
import { getQueryParam, escapeHtml } from "./utils.js";

const initialQuery = getQueryParam("q") || "";
const input = document.getElementById("search-query-input");
const heading = document.getElementById("search-heading");
const resultsEl = document.getElementById("search-results");

input.value = initialQuery;
heading.textContent = initialQuery ? `Results for "${initialQuery}"` : "Search";

if (initialQuery.trim()) {
  runSearch(initialQuery);
} else {
  resultsEl.innerHTML = `<p class="empty-state">Type something above to search the blog.</p>`;
}

document.getElementById("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const newQuery = input.value.trim();
  window.location.href = `search.html?q=${encodeURIComponent(newQuery)}`;
});

async function runSearch(rawQuery) {
  resultsEl.innerHTML = `<p class="empty-state">Searching...</p>`;

  const posts = await listAllApprovedPosts();
  const tokens = rawQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const scored = posts
    .map((post) => ({ post, score: scorePost(post, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || toMillis(b.post.createdAt) - toMillis(a.post.createdAt));

  if (scored.length === 0) {
    resultsEl.innerHTML = `<p class="empty-state">No posts match "${escapeHtml(rawQuery)}".</p>`;
    return;
  }

  resultsEl.innerHTML = scored.map((entry) => renderPostCard(entry.post)).join("");
}

function scorePost(post, tokens) {
  const title = (post.title || "").toLowerCase();
  const body = (post.body || "").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    score += countOccurrences(title, token) * 3;
    score += countOccurrences(body, token) * 1;
  }
  return score;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function toMillis(timestamp) {
  return typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : 0;
}
