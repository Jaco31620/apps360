/*
 * Clic-Clac — e-mails (Resend, expéditeur noreply@apps360.fr). Serveur uniquement.
 * Demandes, alertes et réponses passent par CONTACT_EMAIL.
 */
import { Resend } from "resend";
import { mailHeader } from "@/lib/appIcons";

const FROM = "Clic-Clac <noreply@apps360.fr>";
// Adresse de contact unique : reçoit les demandes et alertes, sert de reply-to (redirigée par OVH vers Gmail).
export const CONTACT_EMAIL = "contact@apps360.fr";
export const SITE = "https://apps360.fr";

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function wrapHtml(title, inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:600px;margin:0 auto">
  ${mailHeader("clicclac", "Clic-Clac", "#ff5a5f", 6)}
  <h2 style="margin:0 0 14px">${esc(title)}</h2>
  ${inner}
  <p style="margin-top:22px;color:#999;font-size:12px">Clic-Clac — photo booth virtuel · apps360</p>
</div>`;
}

// Sans reply-to explicite, les réponses vont à CONTACT_EMAIL (jamais à noreply@).
export async function sendMail({ to, subject, html, text, replyTo = CONTACT_EMAIL, attachments, from = FROM }) {
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!apiKey) throw new Error("Service e-mail non configuré.");
  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text, replyTo, ...(attachments ? { attachments } : {}) });
  if (error) throw new Error(error.message || "Échec de l'envoi.");
}
