// emailjs-init.js
//
// EmailJS lets us send real emails straight from the browser, with no
// server involved -- this is how "your post was approved/rejected"
// emails get sent the moment the admin makes a decision. Only admin.js
// imports this file.
//
// SETUP: see docs/SETUP.md. Sign up for a free EmailJS account, create an
// email service plus two templates ("post-approved" and "post-rejected"),
// then paste the IDs from your EmailJS dashboard below. The public key is
// *meant* to be used from the browser -- EmailJS limits abuse through its
// own dashboard settings (allowed domains, a free-tier monthly quota),
// not by keeping this value secret.

import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

const EMAILJS_PUBLIC_KEY = "-EyBUYP2aXw-8GtT3";
const EMAILJS_SERVICE_ID = "service_vq0jvoa";
const EMAILJS_APPROVED_TEMPLATE_ID = "template_dp18yno";
const EMAILJS_REJECTED_TEMPLATE_ID = "template_3b48eq4";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// `payload` is { toEmail, toName, itemTitle, kind }. The field names
// (to_email, to_name, ...) must match the {{variables}} used inside your
// EmailJS template -- see docs/SETUP.md for the exact template text.
export async function sendApprovalEmail(payload) {
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_APPROVED_TEMPLATE_ID, toTemplateParams(payload));
}

export async function sendRejectionEmail(payload) {
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_REJECTED_TEMPLATE_ID, toTemplateParams(payload));
}

function toTemplateParams({ toEmail, toName, itemTitle, kind }) {
  return { to_email: toEmail, to_name: toName, item_title: itemTitle, item_kind: kind };
}
