# MIX — Setup, Deployment, SEO & Domain Guide

This is the practical, step-by-step guide to taking this code from "files on
your computer" to "live at mixfoodcombos.org." Do the sections in order —
each one depends on the last.

**Security rule for this whole guide:** never commit a real password,
private key, or service-account JSON file to the GitHub repository — this
repo will be public. The Firebase config and EmailJS public key you'll
paste into the code below are safe to commit (they're not secret; see
`docs/ARCHITECTURE.md` for why). Your admin password is never typed into
any file — you'll create that account through the live signup form, just
like anyone else.

---

## Part A — Create your Firebase project

Firebase is the free service that stores accounts, posts, and chat
messages for this site, since GitHub Pages itself can't run a database.

1. Go to <https://console.firebase.google.com>, sign in with a Google
   account, and click **Add project**. Name it anything (e.g. "mix-food").
   You can decline Google Analytics — it's not used here.
2. In your new project, click the **Authentication** section in the left
   sidebar → **Get started** → under "Sign-in method," enable
   **Email/Password**.
3. Click **Firestore Database** in the sidebar → **Create database** →
   choose **Production mode** → pick any nearby region → **Enable**.
4. Click the gear icon next to "Project Overview" → **Project settings**.
   Under "Your apps," click the **</>** (web) icon to register a new web
   app. Give it any nickname and click **Register app**. Firebase shows you
   a `firebaseConfig` object — copy it.
5. Open [js/firebase-init.js](../js/firebase-init.js) in this project and
   replace the placeholder `firebaseConfig` values with the real ones you
   just copied.

**About Storage (image uploads):** this site currently launches *without*
image uploads on blog posts. Google now requires upgrading to Firebase's
paid "Blaze" plan just to turn on Cloud Storage at all (even though its
free monthly quota is still $0 for a small blog) — we skipped it to avoid
needing a credit card on file before launch. Auth and Firestore (accounts,
posts, chat, likes, views) are entirely unaffected and stay on the free
plan. If you want images back later: Firebase console → **Upgrade
project** → Blaze (optionally set a budget alert under Billing first for
peace of mind) → **Storage** → Get started, then re-add a file upload
field to `write.html`/`write.js` and deploy `storage.rules` (Part B
below) — that file is already written and ready to go.

## Part B — Deploy the security rules

The `firestore.rules` file in this repo is the actual access-control
logic (see `docs/ARCHITECTURE.md` for why this matters more than anything
in the JavaScript). It only takes effect once pasted into the Firebase
console. (`storage.rules` also exists in the repo, pre-written for
whenever you turn on image uploads per Part A above — nothing to do with
it until then.)

1. Firestore Database → **Rules** tab → delete the placeholder content →
   paste in the entire contents of [firestore.rules](../firestore.rules)
   → **Publish**.
2. *(Skip for now)* Once you've upgraded to Blaze and turned on Storage,
   come back here: Storage → **Rules** tab → paste in the entire contents
   of [storage.rules](../storage.rules) → **Publish**.

Any time you edit either `.rules` file in this repo, repeat the matching
step above — editing the file locally does nothing on its own; it has to
be pasted into the console.

## Part C — Create your own admin account

Do this *after* Parts A and B, and after you can run the site (see "Run it
locally," below).

1. Open the site and go to **Sign Up**. Create your own account the
   normal way — real email, your chosen username, your chosen password.
   (Don't put these values in any file; just type them into the form.)
2. In the Firebase console, go to **Authentication → Users** and find the
   account you just created. Copy its **User UID** (a long string of
   letters/numbers).
3. Go to **Firestore Database → Data** → **Start collection** → Collection
   ID: `admins` → Document ID: paste the UID you copied → add any field,
   e.g. field name `note`, type `string`, value `admin` → **Save**.
4. Log out and back in on the site (or just refresh). Your account's nav
   dropdown now has an **Admin** link.

This is deliberately a manual, console-only step — no code path in this
repository is ever allowed to grant admin access, so nobody can grant it
to themselves.

## Part D — Set up EmailJS (approval/rejection emails)

EmailJS sends the "your post was approved/rejected" email directly from
the browser when you click Approve/Reject — no server needed.

1. Sign up free at <https://www.emailjs.com>.
2. **Email Services** → add a service (e.g. connect a Gmail account) →
   note the **Service ID**.
3. **Email Templates** → create a template named `post-approved`. Use
   these variables anywhere in the subject/body — EmailJS fills them in
   automatically:
   - `{{to_name}}` — the author's username
   - `{{item_title}}` — the post title or chat message preview
   - `{{item_kind}}` — "blog post" or "chat message"

   Set the template's **To Email** field to `{{to_email}}`. Example body:

   ```
   Hi {{to_name}},

   Good news — your {{item_kind}} "{{item_title}}" has been approved and
   is now live on MIX!
   ```

   Note the **Template ID**.
4. Create a second template named `post-rejected` the same way, with
   wording appropriate for a rejection. Note its **Template ID** too.
5. **Account → General** → copy your **Public Key**.
6. Open [js/emailjs-init.js](../js/emailjs-init.js) and fill in the
   `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`,
   `EMAILJS_APPROVED_TEMPLATE_ID`, and `EMAILJS_REJECTED_TEMPLATE_ID`
   constants with the real values.
7. In EmailJS under **Account → Security**, add your GitHub Pages domain
   (and `mixfoodcombos.org` once connected) to the allowed origins, so
   only your site can trigger emails with your key.

The free EmailJS tier sends up to 200 emails/month — plenty for a
starting blog's approval notifications.

## Run it locally (before you deploy)

You already have Python, so this is the easiest way to preview the site
on your own computer:

```
cd "Mix-food combo blog"
python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html> in a browser. Do all your
testing here first (see the Verification checklist in the project plan)
before pushing anything live.

## Part E — Push the code to GitHub

1. Create a new, empty repository on GitHub (don't initialize it with a
   README — you already have files locally). Note its URL.
2. From inside this project folder:
   ```
   git init
   git add .
   git commit -m "Initial MIX site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

## Part F — Turn on GitHub Pages

1. On GitHub, open your repo → **Settings → Pages**.
2. Under "Build and deployment," set **Source** to "Deploy from a
   branch," **Branch** to `main` and folder `/ (root)` → **Save**.
3. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`
   to confirm the site loads. Fix anything broken here *before* moving to
   the custom domain — it's much easier to debug on the default GitHub URL.

## Part G — Connect mixfoodcombos.org

1. Log into wherever you registered `mixfoodcombos.org` (your DNS
   provider/registrar) and add these records:

   | Type | Host/Name | Value |
   |---|---|---|
   | A | @ (or blank, meaning the bare domain) | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME (optional) | www | `<your-username>.github.io` |

   These four IPs are GitHub's Pages servers — they don't change based on
   your repo.

2. Back on GitHub, **Settings → Pages → Custom domain**, type
   `mixfoodcombos.org`, and **Save**. (This project's repo already
   contains a `CNAME` file with that domain in it — GitHub will confirm it
   matches what you typed.)
3. DNS changes can take anywhere from a few minutes to ~48 hours to
   propagate. GitHub shows a "DNS check in progress" then "DNS check
   successful" message on the Pages settings page.
4. Once it's successful, check the **Enforce HTTPS** box. Now
   `https://mixfoodcombos.org` serves the site with a free, automatically
   renewed certificate.

## Part H — Managing SEO

What's already built in (see `docs/ARCHITECTURE.md` for the reasoning):

- Every static page has a `<title>` and a `<meta name="description">` —
  edit these directly in each `.html` file's `<head>` if you want to
  change how a page's title/snippet reads in search results.
- `robots.txt` and `sitemap.xml` (in the repo root) tell search engines
  which pages exist and are allowed to be indexed.
- Open Graph tags (`og:title`, `og:description`) control how links look
  when shared on social media/Slack/iMessage previews.

To actually get indexed by Google:

1. Go to [Google Search Console](https://search.google.com/search-console),
   add `mixfoodcombos.org` as a property, and verify ownership (Search
   Console will give you a DNS TXT record to add at your registrar — same
   place as Part G).
2. Under **Sitemaps**, submit `sitemap.xml`.
3. Be patient — indexing new sites typically takes days to weeks.

**Known limitation, on purpose:** individual blog posts
(`post.html?id=...`) are not in the sitemap and won't be easily indexed
by search engines, because their content is loaded from Firestore by
JavaScript *after* the page loads — a crawler that doesn't execute
JavaScript only sees an empty shell. This is an accepted tradeoff for
keeping the whole site as simple, framework-free static files (see
`docs/ARCHITECTURE.md`, "Known, deliberate simplifications"). If this
matters more later, the fix is pre-rendering post pages at publish time
(e.g. with a static-site generator) — a bigger project, not needed to
launch.

Ongoing SEO habits worth keeping: descriptive post titles (they become
part of the browser tab title), and updating a page's `<meta
name="description">` if you substantially rewrite its content.

## Making a change after launch

Any time you edit a file in this repo:

```
git add .
git commit -m "describe what changed"
git push
```

GitHub Pages automatically rebuilds and republishes within about a minute
of every push to `main`.
