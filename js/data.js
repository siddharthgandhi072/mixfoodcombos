// data.js
//
// The "data access layer": every read/write to Firestore (our database)
// goes through a function in this file. Pages never call Firestore
// directly — they call something like createPost(...) or listBlogFeed(...)
// from here. This is the same idea as a Python `models.py` or `db.py`
// that all your routes import instead of writing raw queries everywhere.
//
// Centralizing it here means: (1) the same query logic isn't copy-pasted
// across pages, and (2) if you ever need to change how something is
// stored, there's exactly one file to update.

import { db } from "./firebase-init.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy,
  serverTimestamp, increment, arrayUnion, arrayRemove, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---- Collection references -------------------------------------------
const usersCol = collection(db, "users");
const usernamesCol = collection(db, "usernames");
const adminsCol = collection(db, "admins");
const postsCol = collection(db, "posts");
const chatCol = collection(db, "chatMessages");

// ---- Users / usernames / admin role ------------------------------------

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(usersCol, uid));
  return snap.exists() ? snap.data() : null;
}

export async function checkIsAdmin(uid) {
  const snap = await getDoc(doc(adminsCol, uid));
  return snap.exists();
}

export async function isUsernameAvailable(usernameLower) {
  const snap = await getDoc(doc(usernamesCol, usernameLower));
  return !snap.exists();
}

// Called right after a brand-new Firebase Auth account is created. Claims
// the username and creates the user's profile document as one atomic
// transaction, so two people can never end up with the same username even
// if they sign up at the exact same moment.
export async function claimUsernameAndCreateProfile(uid, email, username) {
  const usernameLower = username.trim().toLowerCase();
  await runTransaction(db, async (tx) => {
    const usernameRef = doc(usernamesCol, usernameLower);
    const existing = await tx.get(usernameRef);
    if (existing.exists()) {
      throw new Error("username-taken");
    }
    tx.set(usernameRef, { uid });
    tx.set(doc(usersCol, uid), {
      uid,
      email,
      username: username.trim(),
      usernameLower,
      createdAt: serverTimestamp(),
    });
  });
}

// Changes a user's display username. Old name is released, new name is
// claimed, as one transaction.
export async function renameUsername(uid, oldUsernameLower, newUsername) {
  const newUsernameLower = newUsername.trim().toLowerCase();
  if (newUsernameLower === oldUsernameLower) return; // nothing to do

  await runTransaction(db, async (tx) => {
    const newRef = doc(usernamesCol, newUsernameLower);
    const existing = await tx.get(newRef);
    if (existing.exists()) {
      throw new Error("username-taken");
    }
    tx.delete(doc(usernamesCol, oldUsernameLower));
    tx.set(newRef, { uid });
    tx.update(doc(usersCol, uid), {
      username: newUsername.trim(),
      usernameLower: newUsernameLower,
    });
  });
}

// ---- Shared "approved + my own" query pattern --------------------------
//
// Firestore can't combine "status == approved" OR "authorUid == me" in a
// single query, so every list page that needs both runs two queries and
// merges the results here. Used for the blog feed, the chat feed, chat
// replies, and a user's own posts/messages list.
export async function fetchApprovedPlusOwn(collectionRef, currentUid, extraConstraints = []) {
  const approvedQuery = query(collectionRef, where("status", "==", "approved"), ...extraConstraints);
  const reads = [getDocs(approvedQuery)];

  if (currentUid) {
    const ownQuery = query(collectionRef, where("authorUid", "==", currentUid), ...extraConstraints);
    reads.push(getDocs(ownQuery));
  }

  const snapshots = await Promise.all(reads);
  const byId = new Map();
  snapshots.forEach((snap) => snap.forEach((docSnap) => byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })));

  return Array.from(byId.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function toMillis(timestamp) {
  return typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : 0;
}

// ---- Posts ---------------------------------------------------------------

export async function createPost({ title, body, authorUid, authorUsername }) {
  return addDoc(postsCol, {
    title, body, authorUid, authorUsername,
    status: "pending",
    createdAt: serverTimestamp(),
    editedAt: null,
    reviewedAt: null,
    viewCount: 0,
    likedBy: [],
  });
}

// Editing an already-approved post resets it to "pending" so the admin
// reviews the new version before it's public again (confirmed behavior).
export async function updatePost(postId, { title, body }) {
  await updateDoc(doc(postsCol, postId), {
    title, body,
    editedAt: serverTimestamp(),
    status: "pending",
  });
}

export async function deletePost(postId) {
  await deleteDoc(doc(postsCol, postId));
}

export async function getPost(postId) {
  const snap = await getDoc(doc(postsCol, postId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function listBlogFeed(currentUid) {
  return fetchApprovedPlusOwn(postsCol, currentUid);
}

export async function listAllApprovedPosts() {
  const snap = await getDocs(query(postsCol, where("status", "==", "approved")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function listUserPosts(uid) {
  return getDocs(query(postsCol, where("authorUid", "==", uid))).then((snap) =>
    snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  );
}

export async function toggleLike(postId, uid, isCurrentlyLiked) {
  await updateDoc(doc(postsCol, postId), {
    likedBy: isCurrentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function incrementViewCount(postId) {
  await updateDoc(doc(postsCol, postId), { viewCount: increment(1) });
}

// ---- Chat messages (flat collection; parentId === null means top-level) --

export async function createMessage({ text, authorUid, authorUsername, parentId }) {
  return addDoc(chatCol, {
    text, authorUid, authorUsername,
    parentId: parentId || null,
    status: "pending",
    createdAt: serverTimestamp(),
    editedAt: null,
    reviewedAt: null,
  });
}

export async function updateMessage(messageId, text) {
  await updateDoc(doc(chatCol, messageId), {
    text,
    editedAt: serverTimestamp(),
    status: "pending",
  });
}

export async function deleteMessage(messageId) {
  await deleteDoc(doc(chatCol, messageId));
}

export async function getMessage(messageId) {
  const snap = await getDoc(doc(chatCol, messageId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function listTopLevelMessages(currentUid) {
  return fetchApprovedPlusOwn(chatCol, currentUid, [where("parentId", "==", null)]);
}

export function listReplies(parentId, currentUid) {
  return fetchApprovedPlusOwn(chatCol, currentUid, [where("parentId", "==", parentId)]);
}

export function listUserMessages(uid) {
  return getDocs(query(chatCol, where("authorUid", "==", uid))).then((snap) =>
    snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  );
}

// ---- Admin moderation queue ------------------------------------------

export async function listPending(kind) {
  const col = kind === "posts" ? postsCol : chatCol;
  const snap = await getDocs(query(col, where("status", "==", "pending"), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function approveItem(kind, id) {
  const col = kind === "posts" ? postsCol : chatCol;
  await updateDoc(doc(col, id), { status: "approved", reviewedAt: serverTimestamp() });
}

export async function rejectItem(kind, id) {
  const col = kind === "posts" ? postsCol : chatCol;
  await updateDoc(doc(col, id), { status: "rejected", reviewedAt: serverTimestamp() });
}
