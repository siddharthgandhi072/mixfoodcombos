// firebase-init.js
//
// This file connects our site to Firebase, the free service that acts as
// our "backend": it stores accounts (Authentication) and all our data
// like posts and chat messages (Firestore). GitHub Pages can only serve
// plain files, so Firebase is what gives us a real database and login
// system without needing our own server.
//
// Note: Firebase Storage (for image uploads) is NOT wired up here. Google
// now requires the paid "Blaze" plan just to turn Storage on (even though
// its free quota is still $0 for a small blog), and we're launching
// without that for now. See docs/ARCHITECTURE.md, "Known limitations" for
// how to add image uploads back later.
//
// Every other JS file that needs to talk to Firebase imports `auth` or
// `db` from here — similar to how a Python module might do
// `from db import connection` instead of opening a new connection itself.
//
// SETUP: see docs/SETUP.md. The values below come from YOUR OWN Firebase
// project (Project settings > General > Your apps, in the Firebase
// console). They are safe to commit to a public repo — they are not
// secret. Firebase's real security boundary is firestore.rules (see that
// file), not hiding these values.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyATlz7uvvyIG8aFIcI4XWJmtkQZBsGyUC8",
  authDomain: "mix-food-combo-blog.firebaseapp.com",
  projectId: "mix-food-combo-blog",
  storageBucket: "mix-food-combo-blog.firebasestorage.app",
  messagingSenderId: "968282545690",
  appId: "1:968282545690:web:4c8d1012f538f58a527ba3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
