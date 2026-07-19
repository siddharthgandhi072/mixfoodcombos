// utils.js
//
// Small, reusable helper functions with no Firebase knowledge — plain
// JavaScript, the equivalent of a Python "utils.py" full of little pure
// functions that other files import.

// Turns a Firestore timestamp (or a plain JS Date) into something
// readable, e.g. "Jul 18, 2026".
export function formatDate(timestamp) {
  if (!timestamp) return "";
  // Firestore timestamps have a .toDate() method; plain Dates don't, so we
  // only call it when it exists.
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Prevents user-typed text from being interpreted as HTML when we insert
// it into the page — a basic defense against cross-site scripting.
// Anywhere we render a title/body/username/message that a user typed, we
// run it through this first.
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Counts words the same simple way everywhere (the live counter on
// chat.html and the "is this over 200 words" check both call this, so
// they can never disagree with each other).
export function countWords(text) {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

// Reads a value out of the current page's URL, e.g. post.html?id=abc123
// -> getQueryParam("id") returns "abc123". This is the JS equivalent of
// reading request.args in a Flask route.
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Shows a banner message inside <div id="page-message"> (every page that
// can produce an error/success message includes this div once, right
// after the nav). `type` is "error" or "success".
export function showMessage(text, type = "error") {
  const box = document.getElementById("page-message");
  if (!box) return;
  box.textContent = text;
  box.className = `page-message page-message--${type}`;
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function clearMessage() {
  const box = document.getElementById("page-message");
  if (!box) return;
  box.hidden = true;
}

// Turns a Firebase Auth error (e.g. "Firebase: Error (auth/wrong-password).")
// into something a visitor can actually understand.
export function friendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "That email already has an account. Try logging in instead.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/weak-password": "Please choose a password with at least 6 characters.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
    "auth/requires-recent-login": "For your security, please log out and back in before changing this.",
  };
  return messages[code] || error?.message || "Something went wrong. Please try again.";
}
