// nav.js
//
// Builds the top navigation bar and injects it into every page, then
// decides whether to show "Login", a normal account dropdown, or an
// account dropdown with an extra "Admin" link — based on who (if anyone)
// is currently signed in.
//
// WHY THIS LIVES IN JAVASCRIPT: a static HTML page has no idea who's
// logged in until the browser actually asks Firebase, and that only
// happens after the page has already loaded. So the nav can't be plain,
// unchanging HTML — something has to fill it in at runtime. Putting that
// "something" in one shared file (this one, loaded by every page) means
// you only ever edit the nav in a single place, instead of ten separate
// copies slowly drifting apart from each other.
//
// Every page includes:
//   <div id="nav-placeholder"></div>
//   <script type="module" src="js/nav.js"></script>
// and sets <body data-page="blog"> (etc.) so the matching nav link gets
// highlighted as "active".
//
// The HTML below is written as JavaScript "template strings" (the
// backtick-quoted blocks with ${...} slots) — read them like ordinary
// HTML; the ${...} parts just get replaced with a real value before the
// string is used.

import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { escapeHtml } from "./utils.js";
import { checkIsAdmin } from "./data.js";

const placeholder = document.getElementById("nav-placeholder");
const currentPage = document.body.dataset.page || "";

function navShell(rightSideHtml) {
  return `
    <nav class="site-nav">
      <a href="index.html" class="nav-logo" aria-label="MIX home">
        <img src="assets/logo.svg" alt="MIX — Meals Invented by Xperimenting" />
      </a>
      <div class="nav-links">
        ${navLink("blog.html", "Blogs", "blog")}
        ${navLink("chat.html", "Chat", "chat")}
      </div>
      <form class="nav-search" id="nav-search-form" role="search">
        <input type="search" name="q" placeholder="Search blogs..." aria-label="Search blogs" />
      </form>
      <div class="nav-right">${rightSideHtml}</div>
    </nav>`;
}

function navLink(href, label, page) {
  const activeClass = page === currentPage ? ' class="active"' : "";
  return `<a href="${href}"${activeClass}>${label}</a>`;
}

function renderLoggedOut() {
  placeholder.innerHTML = navShell(`<a href="login.html" class="btn btn-primary btn-small nav-login-btn">Login</a>`);
  wireUpSearch();
}

function renderLoggedIn(username, isAdmin) {
  const adminItem = isAdmin ? `<a href="admin.html">Admin</a>` : "";
  const account = `
    <div class="nav-account">
      <button class="nav-account-toggle" id="nav-account-toggle" type="button">${escapeHtml(username)} ▾</button>
      <div class="nav-account-menu" id="nav-account-menu" hidden>
        <a href="account.html">Account</a>
        ${adminItem}
        <button type="button" id="nav-logout-btn">Log out</button>
      </div>
    </div>`;
  placeholder.innerHTML = navShell(account);
  wireUpSearch();

  const toggle = document.getElementById("nav-account-toggle");
  const menu = document.getElementById("nav-account-menu");

  toggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });

  // Close the dropdown if you click anywhere else on the page.
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== toggle) {
      menu.hidden = true;
    }
  });

  document.getElementById("nav-logout-btn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

function wireUpSearch() {
  const form = document.getElementById("nav-search-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = new FormData(form).get("q").trim();
    if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
  });
}

// We only need to check "is this uid an admin?" once per page load, since
// it can't change while you're sitting on the page.
let cachedIsAdmin = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    cachedIsAdmin = null;
    renderLoggedOut();
    return;
  }

  // Firebase Auth itself only really knows email/password. We keep each
  // user's chosen display name in Firestore, so fetch it here.
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  const username = profileSnap.exists() ? profileSnap.data().username : user.email;

  if (cachedIsAdmin === null) {
    cachedIsAdmin = await checkIsAdmin(user.uid);
  }

  renderLoggedIn(username, cachedIsAdmin);
});
