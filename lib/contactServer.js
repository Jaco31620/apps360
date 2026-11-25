/*
 * Formulaire de contact — serveur : table contact_messages (scripts/contact.sql) et
 * e-mails (Resend) : alerte à contact@, accusé de réception, réponse du backoffice.
 */
import { createHash } from "crypto";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tooMany } from "@/lib/jukeboxRate";
import { KINDS, appTitle, refOf, safeName } from "@/lib/contact";

const CONTACT = "contact@apps360.fr";
const SITE = "https://apps360.fr";
const table = () => getSupabaseAdmin().from("contact_messages");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const para = (s) => `<div style="white-space:pre-wrap;line-height:1.5">${esc(s)}</div>`;
const quote = (s) => `<div style="border-left:3px solid #F47A20;padding-left:12px;color:#555;white-space:pre-wrap;line-height:1.5">${esc(s)}</div>`;
const wrap = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:600px;margin:0 auto">
  <div style="font-size:22px;font-weight:800;color:#14306b;margin-bottom:16px"><img src="${SITE}/brand/apps360-icone-carree-192.png" width="32" height="32" alt="" style="width:32px;height:32px;border-radius:7px;vertical-align:middle;border:0"> <span style="vertical-align:middle">apps360</span></div>
  ${inner}
  <p style="margin-top:22px;color:#999;font-size:12px">apps360 · Des applis utiles, gratuites et sans publicité · <a href="${SITE}" style="color:#999">apps360.fr</a></p>
</div>`;

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
  const link = num ? `${SITE}/admin?message=${num}` : "";
  await send({
    from: "apps360 · Contact <noreply@apps360.fr>", to: CONTACT, replyTo: row.email || CONTACT,
    subject: `[${appTitle(row.app)} · ${KINDS[row.kind].short}] ${ref || "message non enregistré"}`,
    text: `${who}\n\n${row.message}\n\n${row.device ? `Appareil : ${row.device}\n\n` : ""}${link ? `Répondre dans le backoffice : ${link}` : "La base était injoignable : ce message n'est PAS dans le backoffice."}`,
    html: wrap(`<p style="color:#555">${esc(who)}</p>${quote(row.message)}${row.device ? `<p style="color:#777;font-size:13px">Appareil : ${esc(row.device)}</p>` : ""}
      ${link ? `<p style="margin-top:20px"><a href="${link}" style="background:#14306b;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px;display:inline-block">Répondre dans le backoffice</a></p>` : "<p><b>La base était injoignable : ce message n'est pas dans le backoffice.</b></p>"}`),
  });
}

/* Accusé de réception : jamais le message lui-même (adresse non vérifiée). */
export async function acknowledge(row, num) {
  if (!row.email) return;
  const h = createHash("sha256").update(row.email.toLowerCase()).digest("hex").slice(0, 24);
  if (await tooMany(`contact:ack:${h}`, 3, 86400)) return;
  if (await tooMany("contact:ack", 40, 86400)) return; // quota d'e-mails partagé avec les apps
  const name = safeName(row.name);
  const text = `Bonjour${name ? ` ${name}` : ""},\n\nMerci, votre message est bien arrivé. Une vraie personne va le lire, et nous revenons vers vous dès que possible.\n\nSa référence : ${refOf(num)}\n\nÀ bientôt,\napps360\n\nVous n'avez rien envoyé ? Ignorez simplement cet e-mail.`;
  await send({ from: "apps360 <noreply@apps360.fr>", to: row.email, subject: `Votre message est bien arrivé · ${refOf(num)}`, text, html: wrap(para(text)) });
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

/* Réponse envoyée de contact@, copie cachée dans la boîte, puis suivi enregistré. */
export async function replyTo(id, raw) {
  const text = String(raw || "").trim().slice(0, 8000);
  if (!text) throw new ContactError("Écrivez votre réponse.");
  const m = await load(id);
  if (!m.email) throw new ContactError("Cette personne n'a pas laissé d'adresse.");
  const ref = refOf(m.num);
  await send({
    from: `apps360 <${CONTACT}>`, to: m.email, bcc: CONTACT,
    subject: `Re : votre message à apps360 (${appTitle(m.app)}) · ${ref}`,
    text: `${text}\n\n———\nVotre message :\n${m.message}`,
    html: wrap(`${para(text)}<p style="margin:26px 0 8px;color:#777;font-size:13px">Votre message (${esc(ref)}) :</p>${quote(m.message)}`),
  }).catch((e) => { console.error("contact reply:", e); throw new ContactError("L'e-mail n'est pas parti. Votre texte est gardé ici : réessayez."); });
  const at = new Date().toISOString();
  try {
    return await patch(id, { status: "answered", answered_at: at, replies: [...(m.replies || []), { at, via: "back", text }] });
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
