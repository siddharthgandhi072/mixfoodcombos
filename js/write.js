// write.js — write.html: create a new post, or (when opened as
// write.html?edit=<postId>) edit one of your own existing posts. Editing
// an already-approved post resets it to "pending" so it's reviewed again.

import { requireAuth } from "./auth.js";
import { createPost, updatePost, getPost, getUserProfile } from "./data.js";
import { getQueryParam, showMessage } from "./utils.js";

const editingPostId = getQueryParam("edit");

const form = document.getElementById("write-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("write-submit");
const heading = document.getElementById("write-heading");

let currentUser = null;
let currentProfile = null;

requireAuth(async (user) => {
  currentUser = user;
  currentProfile = await getUserProfile(user.uid);

  if (editingPostId) {
    heading.textContent = "Edit your post";
    submitBtn.textContent = "Save changes";

    const post = await getPost(editingPostId);
    if (!post || post.authorUid !== user.uid) {
      showMessage("You can only edit your own posts.");
      form.hidden = true;
      return;
    }
    titleInput.value = post.title;
    bodyInput.value = post.body;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) {
    showMessage("Please fill in a title and a write-up.");
    return;
  }

  submitBtn.disabled = true;
  try {
    if (editingPostId) {
      await updatePost(editingPostId, { title, body });
    } else {
      await createPost({
        title, body,
        authorUid: currentUser.uid,
        authorUsername: currentProfile.username,
      });
    }
    window.location.href = "account.html";
  } catch (error) {
    showMessage("Something went wrong saving your post. Please try again.");
    submitBtn.disabled = false;
  }
});
