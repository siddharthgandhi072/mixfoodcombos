# MIX — How This Site Is Built, and Why

This document explains every decision behind this codebase and how the
code actually works, written for someone comfortable with Python, HTML,
and CSS but new to JavaScript. Read `docs/SETUP.md` first if you just want
to get the site running — come back here when you want to understand or
change something.

---

## 1. The constraint that shaped everything

You asked for this to run on **GitHub Pages**. GitHub Pages is a *static
file host* — it can serve HTML/CSS/JS files exactly as they are, but it
cannot run Python, cannot talk to a database, cannot hash a password, and
cannot send an email. There is no server-side code execution at all.

But the site needs: real accounts with securely-stored passwords, a
database of posts/chat/likes/views, an admin approval queue, and outgoing
emails. All of that is normally "backend" work.

The way to reconcile this without you needing to run and maintain your own
server is to use free third-party services that are *designed* to be
called directly from JavaScript running in the visitor's browser:

- **[Firebase](https://firebase.google.com)** (Google, free "Spark" plan)
  provides:
  - **Authentication** — accounts, login, password reset. Google hashes
    and stores the passwords; there is no code path, anywhere, that can
    read a plaintext password back out. Not even you can see it.
  - **Firestore** — the database. Stores users, posts, and chat messages
    as JSON-like documents.
  - **Storage** would be where uploaded post images live, but this site
    currently launches *without* image uploads — see §9 and
    `docs/SETUP.md` for why (short version: Google now requires a paid
    plan just to switch Storage on) and how to add it back later.
- **[EmailJS](https://www.emailjs.com)** (free tier) sends the
  approve/reject notification emails directly from the admin's browser
  when they click a button — no server needed for that either.

So the real shape of this project is:

```
Visitor's browser
   ├── loads static files from GitHub Pages (all the .html/.css/.js in this repo)
   ├── talks directly to Firebase for accounts/data
   └── (admin only) talks directly to EmailJS to send notification emails
```

GitHub Pages never talks to Firebase or EmailJS itself — it just hands the
browser a pile of files, and those files know how to talk to Firebase and
EmailJS on their own.

---

## 2. A JavaScript primer, for a Python reader

You don't need to become a JS expert to maintain this site, but a few
building blocks show up in every file:

| JavaScript | Python equivalent / idea |
|---|---|
| `import { x } from "./file.js"` | `from file import x` — same idea, each `.js` file is a module |
| `export function foo() {}` | making `foo` importable elsewhere, like not prefixing it `_foo` |
| `async function f() { ... }` / `await somePromise` | Python's `async def` / `await` — nearly identical syntax and meaning: "pause here until this slow thing (a network request) finishes, without freezing the whole page" |
| `const x = 5;` / `let y = 5;` | `x = 5` — `const` means never reassigned, `let` means it can be |
| `` `Hello ${name}` `` | an f-string: `` f"Hello {name}" `` |
| `array.map(fn)` / `.filter(fn)` / `.sort(fn)` | Python's `map()`/`filter()`/`sorted()`, but methods on the list itself |
| `document.getElementById("x")` | grabbing a specific HTML element by its `id="x"` attribute, so JS can read/change it |
| `element.innerHTML = "<p>hi</p>"` | replaces what's inside that element with new HTML — this is how every list of posts/messages/etc. gets drawn on screen, by building an HTML string and dropping it in |
| `element.addEventListener("click", fn)` | registers `fn` to run when that element is clicked — like a callback |

Every file in `js/` is a **module**: a separate file that explicitly
`export`s the functions other files are allowed to `import`. There's no
build step (no npm, no bundler) — the browser loads each module directly,
which is why every `<script>` tag has `type="module"` and why imports use
full relative paths like `"./utils.js"`.

---

## 3. File-by-file tour

### Pages (one `.html` file per view)
`index.html`, `blog.html`, `post.html`, `write.html`, `chat.html`,
`search.html`, `login.html`, `signup.html`, `account.html`, `admin.html`.
Every page follows the same skeleton: a `<head>` with title/meta tags and
stylesheet links, a `<div id="nav-placeholder">` that `js/nav.js` fills
in, a `<div id="page-message">` for error/success banners, the page's own
content, a footer, then `<script type="module">` tags at the bottom.

### CSS: `css/base.css` + one file per page
`base.css` holds the color palette (as CSS variables), fonts, and every
*shared* component — buttons, form fields, cards, badges, the nav bar
itself. Each page then loads one small extra stylesheet (`blog.css`,
`chat.css`, `account.css`, etc.) that only contains that page's own
layout. Change a color in `base.css` and it updates everywhere at once;
change `chat.css` and only the chat page is affected. This is why Chat,
Blog, and Account all *feel* different (different background treatment,
different card shapes, different information density) while still sharing
the same buttons/fonts/inputs.

### Shared JS "concern" modules (`js/`)
- **`firebase-init.js`** — connects to your Firebase project once; every
  other file imports the ready-made `auth`/`db` handles from here instead
  of reconnecting.
- **`utils.js`** — small pure helpers with no Firebase knowledge:
  `formatDate`, `escapeHtml` (prevents user text from being treated as
  HTML — a basic XSS defense), `countWords`, `getQueryParam`,
  `showMessage`/`clearMessage` (the banner at the top of a page).
- **`data.js`** — the data-access layer. Every Firestore read/write in the
  whole site goes through a function here (`createPost`, `toggleLike`,
  `listPending`, etc.) instead of pages calling Firestore directly. Think
  of it like a Python `models.py`.
- **`auth.js`** — every Firebase Authentication call: `signUp`, `logIn`,
  `sendReset`, `reauthenticate`, `changePassword`, plus the page guards
  `requireAuth`/`requireAdmin` that redirect visitors who shouldn't be on
  a given page.
- **`nav.js`** — builds the top nav bar and injects it into every page
  (see §5 below for why this has to be JavaScript).
- **`postCard.js`** — renders one blog post as an HTML card; shared by
  `blog.js` and `search.js` so results look identical in both places.
- **`emailjs-init.js`** — connects to EmailJS and exposes
  `sendApprovalEmail`/`sendRejectionEmail`; only `admin.js` uses it.

### Page-specific JS modules (`js/`)
`blog.js`, `post.js`, `write.js`, `chat.js`, `account.js`, `admin.js`,
`search.js` — one per page, containing only that page's own logic (event
listeners, rendering). These are the files you'll touch most often when
changing how a specific page behaves.

### `assets/`
`logo.svg` (the nav wordmark) and `favicon.svg` (browser tab icon) are
hand-drawn inline SVGs — no external image licensing to worry about, and
tiny file sizes. `assets/svg/*.svg` are the decorative food doodles
(tomato, avocado, chili, herbs, plate, fork+spoon, steam swirl) placed
around various pages via plain `<img>` tags and positioned with CSS.

### `firestore.rules` (and `storage.rules`, currently unused)
`firestore.rules` is covered in depth in §6 — this is the *real* backend
of the site. `storage.rules` is pre-written and ready for whenever image
uploads are turned on (§9), but does nothing until then.

---

## 4. The data model

Firestore is a **document database**: a "collection" is roughly like a
table, a "document" is roughly like one row — except documents in the same
collection don't need identical fields, similar to a Python `dict` where
different dicts in the same list can have different keys.

- **`users/{uid}`** — one profile per account: `email`, `username`,
  `usernameLower`, `createdAt`. The document ID is the account's Firebase
  Auth UID.
- **`usernames/{usernameLower}`** — exists purely so a username can only
  be claimed once (Firestore has no built-in "must be unique" constraint
  the way a SQL column can). The document ID *is* the lowercased username;
  its only field is the `uid` that claimed it.
- **`admins/{uid}`** — if a document exists here with your UID as the ID,
  you're an admin. Nothing else. This collection can only ever be written
  to by hand through the Firebase console (see `docs/SETUP.md` Part C) —
  no code path, anywhere, can create this document. That's intentional:
  admin status can never be granted by a bug or an exploit, only by you,
  manually, in the console.
- **`posts/{postId}`** — `title`, `body`,
  `authorUid`/`authorUsername`, `status` (`"pending"` / `"approved"` /
  `"rejected"`), `createdAt`, `editedAt`, `reviewedAt`, `viewCount`,
  `likedBy` (an array of user IDs who liked it).
- **`chatMessages/{messageId}`** — `text`, `authorUid`/`authorUsername`,
  `parentId` (`null` for a top-level message, or the ID of the message
  it's replying to), `status`, `createdAt`, `editedAt`, `reviewedAt`.
  Top-level messages and replies live in the *same* collection — a reply
  is just a message with `parentId` set. This keeps the admin's "show me
  everything pending" query simple (one query instead of hunting through
  per-message reply subcollections).
- **Storage**: not currently used (see §9). If turned on later, images
  were designed to live at `post-images/{uploader's uid}/{timestamp}.png`
  — `storage.rules` already reflects that path.

---

## 5. Why the nav bar is built in JavaScript

A plain static HTML page has no way to know whether you're logged in —
that information only exists once the browser has actually asked Firebase,
which happens *after* the page has already loaded. So the nav bar's
content (Login link vs. your username + dropdown vs. an extra Admin link)
fundamentally can't be decided at the time the HTML file is written; it
has to be filled in live.

Rather than duplicate a nav `<nav>...</nav>` block across all ten pages
(and risk them slowly drifting apart as you edit one and forget the
others), every page has a single empty
`<div id="nav-placeholder"></div>`, and `js/nav.js` builds the whole thing
and drops it in, based on Firebase's `onAuthStateChanged` callback. Want
to add a nav link or change the logo? Edit `js/nav.js` once, and it
updates on every page automatically.

---

## 6. Security rules: the *real* backend

This is the single most important file to understand:
**[firestore.rules](../firestore.rules)**.

Nothing in the JavaScript files is actually "secure" on its own — any
visitor can open their browser's developer console and call Firestore
functions directly, bypassing your UI entirely. What actually stops them
is that Firestore checks `firestore.rules` on Google's own servers before
agreeing to any read or write, no matter how the request was made. If a
rule says no, Firestore says no — full stop.

A few examples of what the rules enforce, and why:

- **Only the `admins/{uid}` doc controls admin power**, and that
  collection is `allow write: if false` — permanently. There's no
  "make yourself admin" bug possible, because no rule ever allows a write
  to that collection at all.
- **A post's `status` can only become `"approved"` or `"rejected"` via a
  write where `isAdmin()` is true** — an ordinary user's own update to
  their post is only allowed if the *new* status is forced back to
  `"pending"`, so nobody can self-approve.
- **Liking a post** is only allowed if the only thing changing is your
  *own* uid being added to or removed from the `likedBy` array — you
  can't like on someone else's behalf, and you can't edit anything else
  about the post while doing it.
- **Reading** a post/message is allowed if it's `status == "approved"`
  (public), or if you're its author, or if you're an admin — so pending
  and rejected content is invisible to everyone except the person who
  wrote it and the admin reviewing it.

Any time the UI hides a button (e.g. `nav.js` only shows the Admin link
to admins, `write.html` redirects non-logged-in visitors away), that's a
*convenience*, not security — someone could still try to call Firestore
directly. The rules file is what actually stops them.

---

## 7. How the main features work

**Sign up & usernames.** Firebase Auth already guarantees email
uniqueness for free. Usernames don't have a built-in uniqueness
mechanism, so `data.js`'s `claimUsernameAndCreateProfile` runs a Firestore
*transaction* that checks-and-claims the username atomically. If two
people somehow submit the exact same username in the same instant, one
transaction wins and the other's Firebase Auth account gets deleted again
(`auth.js`'s `signUp` catches this and shows "username taken").

**Password reset.** Uses Firebase's own built-in
`sendPasswordResetEmail` — the user gets an emailed link straight from
Firebase, clicks it, and sets a new password on a Firebase-hosted page.
No custom code, and it's more secure than anything we'd hand-roll.

**Posting & approval.** A new post/message is always created with
`status: "pending"`. It only shows up in public listings once an admin
flips it to `"approved"` (`admin.js`). Editing an already-approved item
resets its status back to `"pending"` (`data.js`'s `updatePost`/
`updateMessage`) — the rules enforce that this reset can't be skipped.

**Likes.** `likedBy` is just an array of user IDs on the post document.
The displayed like count is simply `likedBy.length` — there's no separate
counter field that could ever drift out of sync with the array, since
they're the same piece of data.

**Views.** A plain `viewCount` number, incremented by exactly 1 every time
`post.html` loads an approved post. It's not fraud-proof (refreshing the
page counts again) — that's an accepted simplification for a small
community blog, not a metrics platform.

**Chat threading.** Deliberately capped at two levels: top-level messages,
and replies to them (no replies-to-replies). `chat.js` fetches top-level
messages first, then — for each one — fetches its replies with a second
query (`where("parentId", "==", thatMessagesId)`). This keeps both the
querying and the rendering simple and bounded, at the cost of not
supporting deeper nested conversations.

**Search.** `search.js` fetches every *approved* post once, then scores
each one by how many times the search words appear in its title (×3
weight) vs. its body (×1 weight), drops anything with a score of zero,
and sorts by score then by date. This is a plain, naive scan — completely
fine at the size of a new blog, but it re-downloads every post's text on
every search and has no fuzzy matching or stemming. If the blog grows into
the thousands of posts, this is the first thing worth replacing with a
real search service (e.g. Algolia).

**Admin review & email.** `admin.js` queries for
`status == "pending"` in both `posts` and `chatMessages`. Approve/Reject
buttons update that document's status, then — separately, and without
blocking the UI if it fails — call `emailjs-init.js` to send the author a
notification email. The admin never gets emailed about new submissions;
they only find out by opening `admin.html` (reachable from their own
account dropdown) whenever they choose to.

---

## 8. Design system

- **Palette** (`css/base.css`, top of the file): peach (`--color-peach`,
  `--color-peach-deep`, `--color-peach-pale`) and forest green
  (`--color-forest`, `--color-forest-deep`, `--color-forest-light`) as
  requested, plus a warm cream page background and a near-black warm ink
  color for text.
- **Fonts**: "Fredoka" (a rounded, playful display font) for headings and
  the logo, "Nunito Sans" for body text — loaded from Google Fonts via a
  single `@import` at the top of `base.css`.
- **Doodles**: hand-drawn inline SVGs (`assets/svg/*.svg`), positioned
  with plain CSS (`position: absolute`, rotated, low opacity) around the
  home, auth, and other pages — different doodles/positions per page so
  each one feels distinct without needing separate illustration work.
- **Per-page identity**: the home page is a wide, centered marketing hero;
  the blog is a magazine-style card grid with a larger "lead" story; chat
  is a mint-tinted, bubble-and-thread layout; account is a dashboard with
  a stats strip and a settings sidebar. All four still share the exact
  same buttons, inputs, and card styling from `base.css`.

---

## 9. Known, deliberate simplifications

Every one of these trades a small amount of edge-case robustness for
noticeably simpler, more-readable code — the right call for a
community blog maintained by someone who isn't a full-time JS developer.

- **Usernames on old posts don't update** if you rename yourself later
  (the username is copied onto the post at the moment you create it).
- **Like counts are derived from the `likedBy` array**, not stored as a
  separate cached number — can never drift out of sync, and needs no
  server-side trigger to maintain.
- **View counts aren't fraud-proof** — refreshing a page counts again.
- **Chat threading is capped at two levels** — no replies-to-replies.
- **Deleting a chat message doesn't cascade-delete its replies** — an
  orphaned reply just has no parent to render under; this avoids needing
  to let users delete other people's content.
- **Username claiming is check-then-claim-then-rollback**, not a
  guaranteed atomic server-side reservation — the race window is a
  fraction of a second and is handled gracefully if it ever happens.
- **Search is a naive client-side keyword scan**, not a real search
  engine — fine at blog scale (see §7 above).
- **The sitemap only lists static pages**, not individual posts, since
  post content is loaded from Firestore rather than present in the raw
  HTML (see `docs/SETUP.md`, Part H).
- **The 200-word chat limit is precise only in the browser**; Firestore
  rules can't count words, so they enforce a generous character-length
  backstop (1500 characters) instead, purely to stop someone bypassing the
  UI entirely with a giant blob of text.
- **No rich text/markdown editor** for post bodies — plain text only, by
  design, so there's no editor library to configure, style, or keep
  updated.
- **Blog posts have no images yet.** Firebase Storage (the piece that
  would hold uploaded PNGs) now requires upgrading to a paid "Blaze" plan
  just to switch on — a genuine Google policy change, not a design
  choice — so image uploads are deferred rather than forcing a credit
  card on file before the site can even launch. `storage.rules` is
  already written for when this gets turned back on; see
  `docs/SETUP.md` Part A for the re-enable steps.

---

## 10. Common changes — a quick cookbook

- **Change the color palette**: edit the `:root { ... }` variables at the
  top of `css/base.css`. Everything site-wide follows automatically.
- **Change fonts**: edit the `@import` URL and the `--font-heading`/
  `--font-body` variables in `css/base.css`.
- **Change the chat word limit**: edit the `WORD_LIMIT` constant near the
  top of `js/chat.js`, *and* update the matching `text.size() <= 1500`
  character backstop in `firestore.rules` (roughly 7.5 characters per
  word is a safe multiplier) — then re-publish the rules per
  `docs/SETUP.md` Part B.
- **Add a nav link**: edit the `navShell()` function in `js/nav.js`.
- **Add a new decorative doodle**: drop a new `.svg` file in
  `assets/svg/`, then reference it with an `<img>` tag and a small CSS
  rule (see the existing `.hero-doodle-*`/`.auth-doodle-*` classes in
  `css/home.css`/`css/auth.css` for the pattern) on whichever page you
  want it on.
- **Change what fields a blog post has**: add the field in three places —
  where it's created (`createPost` in `js/data.js`), where it's rendered
  (`postCard.js` and/or `post.js`), and in `firestore.rules` if it needs
  its own validation rule.

---

## 11. Known limitations & possible future upgrades

- **No post images yet** — deferred because Firebase Storage now requires
  the paid Blaze plan to enable at all (§9). Adding it back is a contained
  change: re-add a file input + upload call to `write.js`/`write.html`,
  restore `imageURL`/`imagePath` handling in `data.js`, and deploy the
  already-written `storage.rules`.
- **Individual posts aren't search-engine-indexable** (§7, §9) — a future
  fix would involve pre-rendering post pages at publish time.
- **Search doesn't scale past roughly a few hundred posts** gracefully —
  a future fix would be a hosted search service like Algolia or
  Typesense.
- **No moderation history/audit log beyond `reviewedAt`** — if you want a
  record of *who* approved what over time, that would need an additional
  `moderationLog` collection.
- **Everything is on Firebase's free Spark plan**, which has daily quotas
  on reads/writes/storage/bandwidth. A small blog won't come close to
  them, but if the site grows a lot, upgrading to the pay-as-you-go
  "Blaze" plan (still free up to the same quotas, just removes the hard
  cap) is a one-click change in the Firebase console — no code changes
  needed.
