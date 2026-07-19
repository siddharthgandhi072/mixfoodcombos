// auth.js
//
// All the Firebase Authentication calls (sign up, log in, password reset,
// and the "confirm your current password" step Firebase requires before
// sensitive changes) live here. Firestore-specific work — claiming a
// username, creating a profile document — is delegated to data.js, so
// this file stays focused on just the login/account side of things.

import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { claimUsernameAndCreateProfile, isUsernameAvailable, checkIsAdmin } from "./data.js";

// Creates the Firebase Auth account, then claims the chosen username and
// creates the Firestore profile document. If someone else claims that
// exact username in the split second between these two steps, we roll
// back by deleting the Auth account we just made, so we never end up
// with an account that has no matching profile.
export async function signUp(email, username, password) {
  const available = await isUsernameAvailable(username.trim().toLowerCase());
  if (!available) throw new Error("username-taken");

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await claimUsernameAndCreateProfile(credential.user.uid, email, username);
  } catch (error) {
    await deleteUser(credential.user);
    throw error;
  }
  return credential.user;
}

export async function logIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function sendReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// Firebase requires proving you still know the current password before
// changing the password (or, here, the username) — this re-enters it and
// re-authenticates the current session.
export async function reauthenticate(currentPassword) {
  const user = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
}

export async function changePassword(newPassword) {
  await updatePassword(auth.currentUser, newPassword);
}

// Waits for Firebase to report whether anyone is signed in (this is
// asynchronous — it isn't known the instant the page loads), then either
// runs onReady(user) or sends the visitor to the login page. Used by any
// page that requires an account, e.g. write.html and account.html.
export function requireAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    onReady(user);
  });
}

// Same idea, but also checks the admins/{uid} Firestore document and
// bounces non-admins back to the homepage. This redirect is a UX
// convenience only — the real access control is in firestore.rules,
// which would refuse an ordinary user's writes regardless.
export function requireAdmin(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const isAdmin = await checkIsAdmin(user.uid);
    if (!isAdmin) {
      window.location.href = "index.html";
      return;
    }
    onReady(user);
  });
}
