/*
 * Nuage de mots — helpers SERVEUR (à n'importer que depuis les route handlers).
 * Accès présentateur (en-tête x-nuage-admin) : jeton signé « nuage:<id> »,
 * 30 jours par appareil, obtenu avec le code présentateur (8 caractères), le QR
 * à usage unique ou le compte propriétaire. Il porte l'empreinte du code :
 * changer le code déconnecte tous les appareils. Super-admin : jeton signé
 * « nuage:super » (3 jours, remis par /api/admin), accepté partout.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidCode } from "@/lib/nuage";
import { normalizeStyle } from "@/lib/nuageThemes";
import { signToken, verifyToken } from "@/lib/clicclac/server";
import { sendMail, esc, SITE } from "@/lib/clicclac/mail";
import { mailHeader } from "@/lib/appIcons";

const DAY = 24 * 3600 * 1000;
const SUPER = "nuage:super";
const FROM = "apps360 — Nuage de mots <noreply@apps360.fr>";
const TOKEN_TTL = 30 * DAY;
const PASS_TTL = 10 * 60 * 1000;
const sha = (t) => createHash("sha256").update(String(t)).digest("hex");

export const superToken = () => signToken(SUPER, 3 * DAY);
export const isSuperToken = (token) => verifyToken(token)?.scope === SUPER;
export const isNuageSuper = (req) => isSuperToken(req.headers.get("x-nuage-super"));

/* ── Accès présentateur ─────────────────────────────────────────── */
const stamp = (s) => sha(`${s.id}|${s.presenter_code}`).slice(0, 16);
export const presenterToken = (s) => signToken(`nuage:${s.id}`, TOKEN_TTL, { h: stamp(s) });

const presenterOf = (token, s) => {
  const p = verifyToken(token);
  return p?.scope === `nuage:${s.id}` && p.h === stamp(s) ? p : null;
};

/* Droit de piloter un nuage : un de ses présentateurs, ou le super-admin. */
export const canManage = (token, s) => isSuperToken(token) || !!presenterOf(token, s);

/* Jeton de présentateur bientôt expiré (moins de 15 jours) : un neuf, sinon null. */
export function renewToken(token, s) {
  const p = presenterOf(token, s);
  return p && p.exp - Date.now() < 15 * DAY ? presenterToken(s) : null;
}

export function checkPresenterCode(input, s) {
  const given = Buffer.from(sha(String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "")));
  return timingSafeEqual(given, Buffer.from(sha(s.presenter_code)));
}

/* Passe à usage unique (QR « Continuer sur mon téléphone », 10 min). */
export async function createPass(s) {
  const pass = randomBytes(18).toString("base64url");
  const { error } = await getSupabaseAdmin().from("jukebox_config")
    .insert({ key: `nuage:join:${pass}`, value: JSON.stringify({ id: s.id, h: stamp(s), exp: Date.now() + PASS_TTL }) });
  if (error) throw error;
  return pass;
}
export async function usePass(s, pass) {
  if (!/^[\w-]{24}$/.test(String(pass || ""))) return false;
  // lu et effacé d'un coup : un passe ne sert qu'une fois
  const { data, error } = await getSupabaseAdmin().from("jukebox_config").delete().eq("key", `nuage:join:${pass}`).select("value");
  if (error) throw error;
  try {
    const v = JSON.parse(data?.[0]?.value);
    return v.id === s.id && v.h === stamp(s) && v.exp > Date.now();
  } catch (e) { return false; }
}

/* Compteur anti-abus (jukebox_hit) pour les actions sensibles : en cas de
 * panne du compteur, la limite est considérée atteinte. */
export async function overLimit(key, max, windowSec) {
  const { data, error } = await getSupabaseAdmin().rpc("jukebox_hit", { p_key: key, p_window_s: windowSec });
  if (error) { console.error("nuage limite:", error.message); return true; }
  return Number(data) > max;
}

/* ── Nuages ─────────────────────────────────────────────────────── */
export const COLS = "id,code,question,status,max_per_participant,hidden,style,rev,del_rev,presenter_code,owner_id,note,keep,mail_ok,created_at,active_at,warned_at";

export async function loadSession(code) {
  if (!isValidCode(code)) return null;
  const { data, error } = await getSupabaseAdmin().from("nuage_sessions").select(COLS).eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

/* Nouveau nuage (code participant libre ; code présentateur donné par la base). */
export async function createNuage(fields) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await getSupabaseAdmin().from("nuage_sessions")
      .insert({ ...fields, code: String(randomInt(100000, 1000000)) }).select(COLS).single();
    if (!error) return data;
    if (error.code !== "23505") throw error; // 23505 = code déjà pris → on retente
  }
  throw new Error("Aucun code libre.");
}

/* Nouveau code présentateur : tous les appareils sont déconnectés. */
export async function resetPresenterCode(s) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("nuage_new_code");
  if (error) throw error;
  const { error: e2 } = await sb.from("nuage_sessions").update({ presenter_code: data }).eq("id", s.id);
  if (e2) throw e2;
  return { ...s, presenter_code: data };
}

/* Suppression d'un nuage : mots (cascade) et images de titre. */
export async function deleteNuage(s) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("nuage_sessions").delete().eq("id", s.id);
  if (error) throw error;
  const { data: files } = await sb.storage.from("nuage-assets").list(s.code);
  if (files?.length) await sb.storage.from("nuage-assets").remove(files.map((f) => `${s.code}/${f.name}`));
}

export const publicSession = (s) => ({
  code: s.code,
  question: s.question,
  status: s.status,
  maxPerParticipant: s.max_per_participant,
  style: normalizeStyle(s.style),
  rev: s.rev,
  delRev: s.del_rev, // change quand des mots sont supprimés
});

/* ── E-mails ────────────────────────────────────────────────────── */
export async function mailText({ to, subject, text }) {
  const body = esc(text)
    .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`)
    .replace(/\n/g, "<br>");
  await sendMail({
    from: FROM, to, subject: subject.replace(/[\r\n]+/g, " "), text,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:600px;margin:0 auto">
  ${mailHeader("nuage", "Nuage de mots", "#0284c7", 6)}
  <p style="font-size:15px;line-height:1.6">${body}</p>
</div>`,
  });
}

/* Adresse du compte propriétaire (null si aucun). */
export async function ownerEmail(s) {
  if (!s.owner_id) return null;
  const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(s.owner_id);
  if (error) throw error;
  return data?.user?.email || null;
}

/* ── Purge (cron quotidien /api/keep-alive) ─────────────────────────
 * Nuages sans modification depuis 6 mois, sauf « Conserver ». Rattaché à un
 * compte : e-mail 7 jours avant, avec un lien « Conserver 6 mois de plus » ;
 * supprimé seulement si l'alerte est partie depuis 7 jours. */
export const PURGE_DAYS = 183;
const WARN_DAYS = 7;
const KEEP = "nuage:keep";
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const longDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/* Date de suppression prévue (null : jamais). */
export function purgeDate(s) {
  if (s.keep) return null;
  const end = Date.parse(s.active_at) + PURGE_DAYS * DAY;
  return new Date(s.owner_id && s.warned_at ? Math.max(end, Date.parse(s.warned_at) + WARN_DAYS * DAY) : end).toISOString();
}

export async function prolong(token) {
  const p = verifyToken(token);
  if (p?.scope !== KEEP || !p.id) return null;
  const now = new Date();
  const { data, error } = await getSupabaseAdmin().from("nuage_sessions")
    .update({ active_at: now.toISOString(), warned_at: null }).eq("id", p.id).select("id");
  if (error) throw error;
  return data?.length ? { until: new Date(now.getTime() + PURGE_DAYS * DAY).toISOString() } : { gone: true };
}

export async function purgeNuage() {
  const sb = getSupabaseAdmin();
  const report = { warned: 0, deleted: 0 };
  const old = (days) => sb.from("nuage_sessions").select(COLS).eq("keep", false).lt("active_at", ago(days)).limit(200);

  // 1. alertes (nuages rattachés à un compte)
  const { data: soon, error } = await old(PURGE_DAYS - WARN_DAYS).not("owner_id", "is", null).is("warned_at", null);
  if (error) throw error;
  for (const s of soon || []) {
    try {
      const to = await ownerEmail(s);
      const warned_at = new Date().toISOString();
      if (to) await mailText({
        to,
        subject: `Nuage de mots « ${s.question} » : le conserver ?`.slice(0, 150),
        text: [
          "Bonjour,", "",
          `Votre nuage de mots « ${s.question} » n'a pas été modifié depuis près de 6 mois. Il sera supprimé le ${longDate(purgeDate({ ...s, warned_at }))}.`, "",
          "Pour le conserver 6 mois de plus :",
          `${SITE}/nuage/prolonger?t=${encodeURIComponent(signToken(KEEP, 30 * DAY, { id: s.id }))}`, "",
          "Si vous n'en avez plus besoin, ne faites rien.",
        ].join("\n"),
      });
      const { error: e } = await sb.from("nuage_sessions").update({ warned_at }).eq("id", s.id);
      if (e) throw e;
      report.warned++;
    } catch (e) { console.error("nuage alerte:", e); }
  }

  // 2. suppressions
  const free = await old(PURGE_DAYS).is("owner_id", null);
  const owned = await old(PURGE_DAYS).not("owner_id", "is", null).lt("warned_at", ago(WARN_DAYS));
  if (free.error || owned.error) throw free.error || owned.error;
  for (const s of [...free.data, ...owned.data]) {
    try { await deleteNuage(s); report.deleted++; } catch (e) { console.error("nuage purge:", e); }
  }

  // 3. passes QR expirés
  const { data: passes } = await sb.from("jukebox_config").select("key,value").like("key", "nuage:join:%");
  const dead = (passes || []).filter((r) => { try { return JSON.parse(r.value).exp < Date.now(); } catch (e) { return true; } }).map((r) => r.key);
  if (dead.length) await sb.from("jukebox_config").delete().in("key", dead);
  return report;
}
