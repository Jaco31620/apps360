/*
 * Formulaire de contact — serveur : table contact_messages (scripts/contact.sql) et
 * e-mails (Resend) : alerte à contact@, accusé de réception, réponse du backoffice.
 */
import { createHash } from "crypto";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { esc, para, small, quote, button, mailPage } from "@/lib/mail";
import { tooMany } from "@/lib/jukeboxRate";
import { KINDS, appTitle, refOf, safeName } from "@/lib/contact";

const CONTACT = "contact@apps360.fr";
const SITE = "https://apps360.fr";
const table = () => getSupabaseAdmin().from("contact_messages");

async function send(mail) {
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!apiKey) throw new Error("Service e-mail non configuré.");
  const { error } = await new Resend(apiKey).emails.send({ replyTo: CONTACT, ...mail });
  if (error) throw new Error(error.message || "Échec de l'envoi.");
}

/* Enregistre ; renvoi du même message (réseau coupé) : `again`, sans doublon. */
export async function saveMessage(row) {
  const { data, error } = await table().insert(row).select("num").single();
  if (!error) return { num: data.num };
  if (error.code !== "23505") throw error;
  const { data: old } = await table().select("num").eq("id", row.id).maybeSingle();
  return { num: old?.num, again: true };
}

/* Alerte : « Répondre » dans la messagerie écrit directement au visiteur. */
export async function notify(row, num) {
  const ref = refOf(num);
  const who = [row.name, row.email].filter(Boolean).join(" · ") || "sans adresse (pas de réponse possible)";
  const link = num ? `${SITE}/admin/messages?m=${num}` : "";
  await send({
    from: "apps360 · Contact <noreply@apps360.fr>", to: CONTACT, replyTo: row.email || CONTACT,
    subject: `[${appTitle(row.app)} · ${KINDS[row.kind].short}] ${ref || "message non enregistré"}`,
    text: `${who}\n\n${row.message}\n\n${row.device ? `Appareil : ${row.device}\n\n` : ""}${link ? `Répondre dans le backoffice : ${link}` : "La base était injoignable : ce message n'est PAS dans le backoffice."}`,
    html: mailPage("apps360", `${small(esc(who), "#555555")}${quote(row.message)}${row.device ? small(`Appareil : ${esc(row.device)}`) : ""}
      ${link ? button(link, "Répondre dans le backoffice") : para("La base était injoignable : ce message n'est pas dans le backoffice.")}`),
  });
}

/* Accusé de réception : jamais le message lui-même (adresse non vérifiée). */
export async function acknowledge(row, num) {
  if (!row.email) return;
  const h = createHash("sha256").update(row.email.toLowerCase()).digest("hex").slice(0, 24);
  if (await tooMany(`contact:ack:${h}`, 3, 86400)) return;
  if (await tooMany("contact:ack", 40, 86400)) return; // quota d'e-mails partagé avec les apps
  const name = safeName(row.name);
  const body = `Bonjour${name ? ` ${name}` : ""},\n\nMerci, votre message est bien arrivé. Une vraie personne va le lire, et nous revenons vers vous dès que possible.\n\nSa référence : ${refOf(num)}\n\nNotre réponse viendra de ${CONTACT} : pensez à regarder aussi vos courriers indésirables.\n\nÀ bientôt,\napps360`;
  const ignore = "Vous n'avez rien envoyé ? Ignorez simplement cet e-mail.";
  await send({ from: "apps360 <noreply@apps360.fr>", to: row.email, subject: `Votre message est bien arrivé · ${refOf(num)}`, text: `${body}\n\n${ignore}`, html: mailPage("apps360", para(body) + small(ignore)) });
}

export async function afterSave(row, num) {
  const r = await Promise.allSettled([
    (async () => { if (!(await tooMany("contact:alert", 60, 86400))) await notify(row, num); })(),
    acknowledge(row, num),
  ]);
  r.forEach((x) => x.status === "rejected" && console.error("contact mail:", x.reason?.message));
}

/* ---- backoffice ---- */
export class ContactError extends Error {}

export async function countTodo() {
  const { data, error } = await table().select("created_at,status").eq("status", "todo").limit(200);
  if (error) throw error;
  return data || [];
}

export async function listMessages() {
  const cols = "id,num,created_at,kind,app,name,email,message,device,status,answered_at,replies,note";
  // les messages à traiter d'abord : jamais évincés par la limite
  const [t, h] = await Promise.all([
    table().select(cols).eq("status", "todo").order("created_at", { ascending: false }).limit(300),
    table().select(cols).neq("status", "todo").order("created_at", { ascending: false }).limit(200),
  ]);
  if (t.error || h.error) throw t.error || h.error;
  return [...t.data, ...h.data];
}

async function load(id) {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ContactError("Message introuvable : il a peut-être été supprimé.");
  return data;
}
async function patch(id, p) {
  const { data, error } = await table().update(p).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new ContactError("Message introuvable : il a peut-être été supprimé.");
  return data;
}

/* Réponse envoyée de contact@, suivi enregistré, puis copie en e-mail SÉPARÉ (une copie
 * cachée redirigée finissait en spam chez Gmail, qui masque aussi les doublons). */
export async function replyTo(id, raw) {
  const text = String(raw || "").trim().slice(0, 8000);
  if (!text) throw new ContactError("Écrivez votre réponse.");
  const m = await load(id);
  if (!m.email) throw new ContactError("Cette personne n'a pas laissé d'adresse.");
  const ref = refOf(m.num);
  await send({
    from: `apps360 <${CONTACT}>`, to: m.email,
    subject: `Notre réponse à votre message · ${ref}`,
    text: `${text}\n\n———\nVotre message :\n${m.message}`,
    html: mailPage("apps360", `${para(text)}${small(`Votre message (${esc(ref)}) :`)}${quote(m.message)}`),
  }).catch((e) => { console.error("contact reply:", e); throw new ContactError("L'e-mail n'est pas parti. Votre texte est gardé ici : réessayez."); });
  const copy = send({
    from: "apps360 · Contact <noreply@apps360.fr>", to: CONTACT, replyTo: m.email,
    subject: `[Copie] Réponse envoyée${safeName(m.name) ? ` à ${m.name}` : ""} · ${ref}`,
    text: `Réponse envoyée à ${m.email} :\n\n${text}\n\n———\nSon message :\n${m.message}`,
    html: mailPage("apps360", `${small(`Réponse envoyée à ${esc(m.email)} :`)}${para(text)}${small(`Son message (${esc(ref)}) :`)}${quote(m.message)}`),
  }).catch((e) => console.error("contact copy:", e?.message || e)); // la réponse, elle, est partie
  const at = new Date().toISOString();
  try {
    const [saved] = await Promise.all([patch(id, { status: "answered", answered_at: at, replies: [...(m.replies || []), { at, via: "back", text }] }), copy]);
    return saved;
  } catch (e) {
    console.error("contact reply save:", e);
    throw new ContactError("La réponse EST partie, mais n'a pas pu être notée ici. Ne la renvoyez pas : utilisez « J'ai répondu par mail ».");
  }
}

/* Réponse faite hors du backoffice, à la date choisie (AAAA-MM-JJ). */
export async function markAnswered(id, day) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? new Date(`${day}T12:00:00Z`) : null;
  if (!d || isNaN(d) || d.getTime() > Date.now() + 86400e3) throw new ContactError("Date de réponse incorrecte.");
  const m = await load(id);
  return patch(id, { status: "answered", answered_at: d.toISOString(), replies: [...(m.replies || []), { at: d.toISOString(), via: "mail" }] });
}

export const setStatus = (id, status) => patch(id, { status });
export const setNote = (id, note) => patch(id, { note: String(note || "").trim().slice(0, 2000) || null });
export async function removeMessage(id) {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

/* Purge quotidienne : 12 mois après réception. */
export async function purgeContact() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  const { error } = await table().delete().lt("created_at", d.toISOString());
  if (error) throw error;
  return "ok";
}
