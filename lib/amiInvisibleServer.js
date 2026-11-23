/*
 * Ami Invisible — SERVEUR uniquement (route handlers).
 *  - Organisateur : compte apps360 (Supabase Auth). Le navigateur joint son
 *    jeton de session (Authorization: Bearer …), vérifié ici. Chaque appel
 *    met à jour sa dernière activité (ai_organizers.last_active_at).
 *  - Données : tables ai_organizers, ai_tirages, ai_participants
 *    (scripts/ami-invisible-v2.sql), lues et écrites ici seulement.
 *  - Participant : lien personnel /ami-invisible/p/<token> (jeton aléatoire
 *    rangé en base). Les e-mails ne contiennent que ce lien.
 *  - Super-admin : mot de passe commun (Clic-Clac / Jukebox) → jeton signé
 *    « ami:super » (en-tête x-ai-super), 3 jours.
 *  - E-mails : Resend, noreply@apps360.fr, réponses vers contact@apps360.fr.
 */
import crypto from "node:crypto";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkMasterPassword, signToken, verifyToken } from "@/lib/clicclac/server";
import { CONTACT_EMAIL, SITE } from "@/lib/clicclac/mail";
import { bannedEdges, buildLinkMail, cleanPerson, drawPairs, esc, identityOf, mailShell, nameIdentity, wishlistEnd } from "@/lib/amiInvisible";

const DAY = 24 * 3600 * 1000;
const SUPER = "ami:super";
const FROM = "Ami Invisible <noreply@apps360.fr>";
const db = () => getSupabaseAdmin();

/* ── Accès ──────────────────────────────────────────────────────── */
export const checkSuperPassword = checkMasterPassword;
export const superToken = () => signToken(SUPER, 3 * DAY);
export const isAmiSuper = (req) => verifyToken(req.headers.get("x-ai-super"))?.scope === SUPER;

export async function userOf(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const { data, error } = await db().auth.getUser(m[1]);
  return error || !data?.user ? null : data.user;
}

/* Organisateur : crée sa ligne au besoin, note son activité. Renvoie la ligne. */
export async function touchOrganizer(user) {
  const { data, error } = await db().from("ai_organizers")
    .upsert({ user_id: user.id, email: user.email || null, last_active_at: new Date().toISOString(), warned_at: null }, { onConflict: "user_id" })
    .select("user_id,email,carnet").single();
  if (error) throw error;
  return data;
}

export async function saveCarnet(userId, carnet) {
  const { error } = await db().from("ai_organizers").update({ carnet }).eq("user_id", userId);
  if (error) throw error;
}

export const newToken = () => crypto.randomBytes(18).toString("base64url");
export const personalLink = (token) => `${SITE}/ami-invisible/p/${token}`;

/* ── Tirages ────────────────────────────────────────────────────── */
const TIRAGE_COLS = "id,user_id,name,status,options,template,draft,exclusions,avoid,journal,drawn_at,created_at,updated_at";
const PART_COLS = "id,tirage_id,position,prenom,nom,email,receiver_id,token,sent_at,sends,opened_at,wishlist,wishlist_at,erased_at";

export async function getTirage(id, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  let q = db().from("ai_tirages").select(TIRAGE_COLS).eq("id", id);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

export async function participantsOf(tirageId) {
  const { data, error } = await db().from("ai_participants").select(PART_COLS).eq("tirage_id", tirageId).order("position");
  if (error) throw error;
  return data || [];
}

export async function updateTirage(id, patch) {
  const { data, error } = await db().from("ai_tirages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(TIRAGE_COLS).single();
  if (error) throw error;
  return data;
}

export function withLog(tirage, who, action, extra = {}) {
  return [...(tirage.journal || []), { at: new Date().toISOString(), who, action, ...extra }].slice(-100);
}

/* Liste d'un organisateur (ou de tous : userId null), avec compteurs. */
export async function tirageSummaries(userId) {
  let q = db().from("ai_tirages").select("id,user_id,name,status,options,draft,journal,drawn_at,created_at,updated_at").order("updated_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data: rows, error } = await q;
  if (error) throw error;
  const ids = (rows || []).filter((t) => t.status === "drawn").map((t) => t.id);
  const stats = {};
  for (let k = 0; k < ids.length; k += 200) {
    const { data, error: e2 } = await db().from("ai_participants").select("tirage_id,sent_at,opened_at,erased_at").in("tirage_id", ids.slice(k, k + 200));
    if (e2) throw e2;
    for (const p of data || []) {
      const s = (stats[p.tirage_id] ||= { total: 0, sent: 0, opened: 0, erased: 0 });
      s.total++; if (p.sent_at) s.sent++; if (p.opened_at) s.opened++; if (p.erased_at) s.erased++;
    }
  }
  return (rows || []).map((t) => ({
    id: t.id,
    userId: t.user_id,
    name: t.name,
    status: t.status,
    date: t.options?.date || "",
    drawnAt: t.drawn_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    total: t.status === "drawn" ? stats[t.id]?.total || 0 : (t.draft || []).length,
    sent: stats[t.id]?.sent || 0,
    opened: stats[t.id]?.opened || 0,
    erased: stats[t.id]?.erased || 0,
    reveals: (t.journal || []).filter((j) => j.action === "reveal").length,
  }));
}

/* Vue organisateur / super-admin d'un tirage : jamais les receveurs. */
export function tirageView(t, parts = []) {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    options: t.options || {},
    template: t.template,
    draft: t.draft || [],
    exclusions: t.exclusions || [],
    avoid: t.avoid || [],
    drawnAt: t.drawn_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    participants: parts.map((p) => ({
      id: p.id, prenom: p.prenom, nom: p.nom, email: p.email, erased: !!p.erased_at,
      sentAt: p.sent_at, sends: p.sends, openedAt: p.opened_at, link: personalLink(p.token),
    })),
  };
}

/* Paires des tirages à éviter (du même organisateur), en identités. */
async function avoidPairsOf(userId, ids) {
  const list = (ids || []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 20);
  if (!list.length) return [];
  const { data: own } = await db().from("ai_tirages").select("id").eq("user_id", userId).in("id", list);
  const okIds = (own || []).map((r) => r.id);
  if (!okIds.length) return [];
  const { data, error } = await db().from("ai_participants").select("id,prenom,nom,email,receiver_id").in("tirage_id", okIds);
  if (error) throw error;
  const byId = new Map((data || []).map((p) => [p.id, p]));
  const ids2 = (p) => [...(p.email ? [identityOf(p)] : []), nameIdentity(p)];
  return (data || []).filter((p) => byId.has(p.receiver_id)).map((p) => ({ giver: ids2(p), receiver: ids2(byId.get(p.receiver_id)) }));
}

/* Tirage d'un brouillon : renvoie { error } ou { tirage, participants }. */
export async function drawTirage(t) {
  const people = (t.draft || []).map(cleanPerson);
  const avoid = await avoidPairsOf(t.user_id, t.avoid);
  const result = drawPairs(people.length, bannedEdges(people, t.exclusions || [], avoid));
  if (!result) {
    return { error: avoid.length
      ? "Impossible de faire le tirage en évitant toutes ces paires. Décochez un ancien tirage ou retirez une exclusion."
      : "Impossible de trouver une combinaison valide. Retirez une exclusion." };
  }
  const ids = people.map(() => crypto.randomUUID());
  const rows = people.map((p, i) => ({
    id: ids[i], tirage_id: t.id, position: i, prenom: p.prenom, nom: p.nom, email: p.email,
    receiver_id: ids[result[i]], token: newToken(),
  }));
  await db().from("ai_participants").delete().eq("tirage_id", t.id);
  const { error } = await db().from("ai_participants").insert(rows);
  if (error) throw error;
  const tirage = await updateTirage(t.id, { status: "drawn", drawn_at: new Date().toISOString() });
  return { tirage, participants: await participantsOf(t.id) };
}

/* Retour au brouillon (« Refaire », rien n'a été envoyé). */
export async function undrawTirage(t) {
  await db().from("ai_participants").delete().eq("tirage_id", t.id);
  return updateTirage(t.id, { status: "draft", drawn_at: null });
}

/* ── E-mails ────────────────────────────────────────────────────── */
const linkMail = (t, p) => ({ from: FROM, to: p.email, replyTo: CONTACT_EMAIL, ...buildLinkMail(t, p, personalLink(p.token)) });

/* Envoie le lien personnel aux participants donnés (lots de 100 via l'API
 * batch). Met à jour sent_at / sends. Renvoie { sent: [id], failed: [id] }. */
export async function sendLinks(t, parts) {
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!apiKey) throw new Error("Service e-mail non configuré.");
  const resend = new Resend(apiKey);
  const sent = [], failed = [];
  const list = parts.filter((p) => p.email && !p.erased_at);
  for (let k = 0; k < list.length; k += 100) {
    const chunk = list.slice(k, k + 100);
    const { error } = chunk.length === 1
      ? await resend.emails.send(linkMail(t, chunk[0]))
      : await resend.batch.send(chunk.map((p) => linkMail(t, p)));
    if (error) { console.error("ami-invisible mail:", error); failed.push(...chunk.map((p) => p.id)); continue; }
    const now = new Date().toISOString();
    for (const p of chunk) {
      await db().from("ai_participants").update({ sent_at: now, sends: (p.sends || 0) + 1 }).eq("id", p.id);
      sent.push(p.id);
    }
  }
  return { sent, failed };
}

/* L'organisateur est prévenu qu'un participant a supprimé ses coordonnées. */
export async function notifyErase(t, person) {
  const { data: org } = await db().from("ai_organizers").select("email").eq("user_id", t.user_id).maybeSingle();
  const apiKey = process.env.RESEND_FFBB_KEY;
  if (!org?.email || !apiKey) return;
  const who = `${person.prenom} ${person.nom}`.trim();
  const text = [
    "Bonjour,",
    "",
    `${who}, participant(e) de votre tirage « ${t.name} », a demandé à ce que ses coordonnées soient supprimées.`,
    "Son adresse e-mail a été effacée d'Ami Invisible : cette personne ne recevra plus aucun message de notre part.",
    "",
    "Son nom reste dans vos tirages en cours, pour que la personne qui doit lui offrir un cadeau sache toujours à qui elle l'offre.",
    "Pour l'inclure à nouveau dans un prochain tirage, demandez-lui son accord avant de ressaisir son adresse.",
    "",
    `👉 Vos tirages : ${SITE}/ami-invisible`,
  ].join("\n");
  const html = mailShell(`<div style="font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(text)}</div>`);
  const { error } = await new Resend(apiKey).emails.send({
    from: FROM, to: org.email, subject: `Ami Invisible : ${who} a supprimé ses coordonnées`, text, html, replyTo: CONTACT_EMAIL,
  });
  if (error) console.error("ami-invisible notify:", error);
}

/* ── Participant (lien personnel) ───────────────────────────────── */
export async function byToken(token) {
  if (!/^[\w-]{20,40}$/.test(String(token || ""))) return null;
  const { data: p, error } = await db().from("ai_participants").select(PART_COLS).eq("token", token).maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const t = await getTirage(p.tirage_id);
  return t && t.status === "drawn" ? { p, t } : null;
}

export async function participantById(id) {
  const { data, error } = await db().from("ai_participants").select(PART_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateParticipant(id, patch) {
  const { error } = await db().from("ai_participants").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Super-admin ────────────────────────────────────────────────── */
export async function organizersById() {
  const { data, error } = await db().from("ai_organizers").select("user_id,email,last_active_at");
  if (error) throw error;
  return Object.fromEntries((data || []).map((o) => [o.user_id, o]));
}

export async function deleteTirage(id) {
  const { error } = await db().from("ai_tirages").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteOrganizerData(userId) {
  const { error } = await db().from("ai_organizers").delete().eq("user_id", userId); // tirages et participants en cascade
  if (error) throw error;
}

export async function createTirage(userId, fields) {
  const { data, error } = await db().from("ai_tirages").insert({ user_id: userId, ...fields }).select(TIRAGE_COLS).single();
  if (error) throw error;
  return data;
}

/* Suppression des coordonnées d'un participant, partout chez cet
 * organisateur : tirages faits (e-mail effacé, nom gardé), brouillons
 * (personne retirée) et carnet. */
export async function eraseEverywhere(userId, email) {
  const mail = String(email || "").toLowerCase();
  if (!mail) return;
  const now = new Date().toISOString();
  const { data: tirages, error } = await db().from("ai_tirages").select("id,status,draft,exclusions").eq("user_id", userId);
  if (error) throw error;
  const ids = (tirages || []).map((t) => t.id);
  if (ids.length) {
    const { error: e2 } = await db().from("ai_participants").update({ email: null, erased_at: now }).in("tirage_id", ids).eq("email", mail);
    if (e2) throw e2;
  }
  for (const t of tirages || []) {
    if (t.status !== "draft" || !(t.draft || []).some((p) => p.email === mail)) continue;
    const gone = new Set(t.draft.filter((p) => p.email === mail).map((p) => p.key));
    await db().from("ai_tirages").update({
      draft: t.draft.filter((p) => !gone.has(p.key)),
      exclusions: (t.exclusions || []).filter((e) => !gone.has(e.from) && !gone.has(e.to)),
    }).eq("id", t.id);
  }
  const { data: org } = await db().from("ai_organizers").select("carnet").eq("user_id", userId).maybeSingle();
  const carnet = (org?.carnet || []).filter((c) => String(c.email).toLowerCase() !== mail);
  if (org && carnet.length !== (org.carnet || []).length) await db().from("ai_organizers").update({ carnet }).eq("user_id", userId);
}

/* ── Conservation (cron quotidien /api/keep-alive) ──────────────────
 *  1. Listes de souhaits effacées 1 mois après l'échange (3 mois après le
 *     tirage sans date).
 *  2. Organisateur inactif depuis 11 mois : e-mail avec un lien « conserver
 *     12 mois de plus » (un clic, sans connexion).
 *  3. Inactif depuis 12 mois et prévenu depuis au moins 30 jours : toutes
 *     ses données sont supprimées (tirages, participants, carnet). Un compte
 *     sans tirage ni carnet est supprimé sans e-mail.
 * Toute utilisation d'Ami Invisible (touchOrganizer) remet le compteur à zéro. */
const KEEP = "ami:keep";
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const deleteDate = (o) => new Date(Math.max(addMonths(o.last_active_at, 12).getTime(), new Date(o.warned_at || Date.now()).getTime() + 30 * DAY));
const fmtLong = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
export const keepLink = (userId) => `${SITE}/ami-invisible/prolonger?t=${encodeURIComponent(signToken(KEEP, 90 * DAY, { uid: userId }))}`;

/* Lien « conserver » : renvoie la nouvelle date limite, ou null si lien invalide. */
export async function keepOrganizer(token) {
  const p = verifyToken(token);
  if (p?.scope !== KEEP || !p.uid) return null;
  const now = new Date();
  const { data, error } = await db().from("ai_organizers").update({ last_active_at: now.toISOString(), warned_at: null }).eq("user_id", p.uid).select("user_id");
  if (error) throw error;
  if (!data?.length) return { gone: true };
  return { until: addMonths(now, 12).toISOString() };
}

async function warnMail(o, count) {
  const del = fmtLong(deleteDate(o));
  const keep = keepLink(o.user_id);
  const text = [
    "Bonjour,",
    "",
    `Vous n'avez pas utilisé Ami Invisible depuis près d'un an. Sans action de votre part, vos données seront supprimées le ${del} : ${count.tirages} tirage(s), leurs participants et votre carnet d'adresses.`,
    "",
    `Pour les garder 12 mois de plus, un clic suffit : ${keep}`,
    "(Se connecter à Ami Invisible les prolonge aussi.)",
    "",
    "Si vous n'en avez plus besoin, ne faites rien : tout sera effacé automatiquement.",
  ].join("\n");
  const html = mailShell(`<p style="font-size:15px;margin:0 0 10px">Bonjour,</p>
  <p style="font-size:15px;line-height:1.55;margin:0 0 16px">Vous n'avez pas utilisé Ami Invisible depuis près d'un an. Sans action de votre part, vos données seront <b>supprimées le ${esc(del)}</b> : ${count.tirages} tirage(s), leurs participants et votre carnet d'adresses.</p>
  <p style="margin:0 0 16px"><a href="${esc(keep)}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 26px;border-radius:999px">Conserver 12 mois de plus</a></p>
  <p style="font-size:14px;color:#444;line-height:1.55;margin:0">Un clic suffit, sans mot de passe. Se connecter à <a href="${SITE}/ami-invisible" style="color:#444">Ami Invisible</a> les prolonge aussi.<br>Si vous n'en avez plus besoin, ne faites rien : tout sera effacé automatiquement.</p>`);
  const { error } = await new Resend(process.env.RESEND_FFBB_KEY).emails.send({
    from: FROM, to: o.email, subject: "Ami Invisible : conserver vos tirages ?", text, html, replyTo: CONTACT_EMAIL,
  });
  if (error) throw new Error(error.message || "envoi");
}

export async function purgeAmiInvisible(now = new Date()) {
  const out = { wishlists: 0, warned: 0, deleted: 0 };
  // 1. listes de souhaits
  const { data: drawn, error } = await db().from("ai_tirages").select("id,options,drawn_at").eq("status", "drawn");
  if (error) throw error;
  const expired = (drawn || []).filter((t) => { const e = wishlistEnd(t.options, t.drawn_at); return e && e < now; }).map((t) => t.id);
  for (let k = 0; k < expired.length; k += 200) {
    const { data, error: e } = await db().from("ai_participants").update({ wishlist: null, wishlist_at: null })
      .in("tirage_id", expired.slice(k, k + 200)).not("wishlist", "is", null).select("id");
    if (e) throw e;
    out.wishlists += data?.length || 0;
  }
  // 2 et 3. organisateurs inactifs
  const { data: idle, error: e2 } = await db().from("ai_organizers").select("user_id,email,carnet,last_active_at,warned_at")
    .lt("last_active_at", addMonths(now, -11).toISOString()).limit(200);
  if (e2) throw e2;
  for (const o of idle || []) {
    try {
      const { count } = await db().from("ai_tirages").select("id", { count: "exact", head: true }).eq("user_id", o.user_id);
      const empty = !count && !(o.carnet || []).length;
      const due = addMonths(o.last_active_at, 12) < now;
      if (due && (empty || (o.warned_at && deleteDate(o) <= now))) {
        await deleteOrganizerData(o.user_id);
        out.deleted++;
      } else if (!o.warned_at && !empty && o.email && out.warned < 50 && process.env.RESEND_FFBB_KEY) {
        await warnMail(o, { tirages: count || 0 });
        await db().from("ai_organizers").update({ warned_at: now.toISOString() }).eq("user_id", o.user_id);
        out.warned++;
      }
    } catch (e) {
      console.error("ami-invisible purge:", e);
    }
  }
  return out;
}
