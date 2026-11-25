/*
 * Clic-Clac — e-mails (Resend, expéditeur noreply@apps360.fr). Serveur uniquement.
 * Demandes, alertes et réponses passent par CONTACT_EMAIL.
 */
import { Resend } from "resend";
import { mailPage, title } from "@/lib/mail";

const FROM = "Clic-Clac <noreply@apps360.fr>";
// Adresse de contact unique : reçoit les demandes et alertes, sert de reply-to (redirigée par OVH vers Gmail).
export const CONTACT_EMAIL = "contact@apps360.fr";
export const SITE = "https://apps360.fr";

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());

/* inner : briques de lib/mail.js (para, rich, button…). */
export const wrapHtml = (heading, inner) => mailPage("clicclac", title(heading) + inner);

// Sans reply-to explicite, les réponses vont à CONTACT_EMAIL (jamais à noreply@).
export async function sendMail({ to, subject, html, text, replyTo = CONTACT_EMAIL, attachments, from = FROM }) {
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!apiKey) throw new Error("Service e-mail non configuré.");
  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text, replyTo, ...(attachments ? { attachments } : {}) });
  if (error) throw new Error(error.message || "Échec de l'envoi.");
}
