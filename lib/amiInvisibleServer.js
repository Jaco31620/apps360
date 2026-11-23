/*
 * Ami Invisible — SERVEUR uniquement (route handlers).
 *  - Organisateur : compte apps360 (Supabase Auth). Le navigateur joint son
 *    jeton de session (Authorization: Bearer …), vérifié ici.
 *  - Données : tables `tirages` et `carnet` (une ligne par utilisateur,
 *    colonne data JSON), lues et écrites ici seulement (clé service_role).
 *  - Super-admin : mot de passe commun (Clic-Clac / Jukebox) → jeton signé
 *    de portée « ami:super » (en-tête x-ai-super), 3 jours.
 *  - Lien personnel d'un participant : jeton signé « ami:pair » (page
 *    /ami-invisible/r/<jeton>), créé par le super-admin pour un dépannage.
 *  - E-mails : Resend, noreply@apps360.fr, réponses vers contact@apps360.fr.
 */
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkMasterPassword, signToken, verifyToken } from "@/lib/clicclac/server";
import { CONTACT_EMAIL, SITE, esc } from "@/lib/clicclac/mail";
import { fillMessage, sendSummary } from "@/lib/amiInvisible";

const DAY = 24 * 3600 * 1000;
const SUPER = "ami:super";
const PAIR = "ami:pair";
const FROM = "Ami Invisible <noreply@apps360.fr>";

/* ── Accès ──────────────────────────────────────────────────────── */
export const checkSuperPassword = checkMasterPassword;
export const superToken = () => signToken(SUPER, 3 * DAY);
export const isAmiSuper = (req) => verifyToken(req.headers.get("x-ai-super"))?.scope === SUPER;

/* Utilisateur connecté (jeton Supabase de la session), ou null. */
export async function userOf(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(m[1]);
  return error || !data?.user ? null : data.user;
}

export const pairLink = (userId, tirageId, index) =>
  `${SITE}/ami-invisible/r/${signToken(PAIR, 120 * DAY, { u: userId, t: tirageId, i: index })}`;
export function readPairToken(token) {
  const p = verifyToken(token);
  return p?.scope === PAIR ? p : null;
}

/* ── Données ────────────────────────────────────────────────────── */
async function loadRow(table, userId) {
  const { data, error } = await getSupabaseAdmin().from(table).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}
async function saveRow(table, userId, value) {
  const { error } = await getSupabaseAdmin().from(table).upsert({ user_id: userId, data: value }, { onConflict: "user_id" });
  if (error) throw error;
}
export const loadTirages = async (userId) => {
  const t = await loadRow("tirages", userId);
  return Array.isArray(t) ? t : [];
};
export const saveTirages = (userId, list) => saveRow("tirages", userId, list);
export const loadCarnet = async (userId) => {
  const c = await loadRow("carnet", userId);
  return Array.isArray(c) ? c : [];
};
export const saveCarnet = (userId, list) => saveRow("carnet", userId, list);

/* Trace d'une action sensible dans le tirage (50 dernières). */
export function logAction(tirage, who, action, index) {
  const entry = { at: new Date().toISOString(), who, action, ...(index !== undefined ? { index } : {}) };
  tirage.journal = [...(tirage.journal || []), entry].slice(-50);
}

/* ── E-mails ────────────────────────────────────────────────────── */
function mailOf(tirage, pair) {
  const text = fillMessage(tirage.template, pair.offreur, pair.receveur);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:600px;margin:0 auto">
  <div style="font-size:22px;font-weight:800;color:#dc2626;margin-bottom:14px">🎁 Ami Invisible</div>
  <div style="font-size:15px;line-height:1.5;white-space:pre-wrap">${esc(text)}</div>
  <p style="margin-top:22px;color:#999;font-size:12px">${esc(tirage.eventName)} · Ami Invisible · apps360</p>
</div>`;
  return { from: FROM, to: pair.offreur.email, subject: `🎁 Ami Invisible : ${tirage.eventName}`, text, html, replyTo: CONTACT_EMAIL };
}

/* Envoie le résultat aux paires d'index donnés (lots de 100, API batch de
 * Resend). Met à jour sentAt / sends des paires envoyées. Renvoie
 * { sent: [index], failed: [index] }. */
export async function sendPairs(tirage, indexes) {
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!apiKey) throw new Error("Service e-mail non configuré.");
  const resend = new Resend(apiKey);
  const sent = [], failed = [];
  for (let k = 0; k < indexes.length; k += 100) {
    const chunk = indexes.slice(k, k + 100);
    const { error } = chunk.length === 1
      ? await resend.emails.send(mailOf(tirage, tirage.pairs[chunk[0]]))
      : await resend.batch.send(chunk.map((i) => mailOf(tirage, tirage.pairs[i])));
    if (error) { console.error("ami-invisible mail:", error); failed.push(...chunk); continue; }
    const now = new Date().toISOString();
    for (const i of chunk) {
      tirage.pairs[i].sentAt = now;
      tirage.pairs[i].sends = (tirage.pairs[i].sends || 0) + 1;
      sent.push(i);
    }
  }
  return { sent, failed };
}

/* ── Super-admin ────────────────────────────────────────────────── */
/* Adresse e-mail des comptes (une lecture par page de 1000 comptes). */
async function emailsById() {
  const out = {};
  const auth = getSupabaseAdmin().auth.admin;
  for (let page = 1; page < 50; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data?.users || []) out[u.id] = u.email || null;
    if (!data?.users || data.users.length < 1000) break;
  }
  return out;
}

/* Tous les tirages, sans les paires. */
export async function allTirages() {
  const { data, error } = await getSupabaseAdmin().from("tirages").select("user_id,data");
  if (error) throw error;
  const emails = await emailsById();
  const list = [];
  for (const row of data || []) {
    for (const t of Array.isArray(row.data) ? row.data : []) {
      list.push({
        userId: row.user_id,
        organizer: emails[row.user_id] || null,
        id: t.id,
        eventName: t.eventName,
        date: t.date,
        tracked: (t.v || 1) >= 2,
        ...sendSummary(t),
        reveals: (t.journal || []).filter((j) => j.action === "reveal").length,
      });
    }
  }
  return list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export const organizerEmail = async (userId) => {
  const { data } = await getSupabaseAdmin().auth.admin.getUserById(userId);
  return data?.user?.email || null;
};
