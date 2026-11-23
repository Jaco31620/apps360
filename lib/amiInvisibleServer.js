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
import { CONTACT_EMAIL, SITE, esc } from "@/lib/clicclac/mail";
import { bannedEdges, cleanPerson, drawPairs, fmtDay, identityOf, nameIdentity, texts } from "@/lib/amiInvisible";

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
function mailShell(inner, footer = "") {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:8px">
  <div style="font-size:22px;font-weight:800;color:#dc2626;margin-bottom:16px">🎁 Ami Invisible</div>
  ${inner}
  ${footer}
  <p style="margin-top:18px;color:#999;font-size:12px">Ami Invisible · <a href="${SITE}" style="color:#999">apps360.fr</a></p>
</div>`;
}

function eventLines(o) {
  return [
    o.date ? `📅 ${fmtDay(o.date)}` : "",
    o.place ? `📍 ${o.place}` : "",
    o.budget ? `💶 Budget : ${o.budget}` : "",
  ].filter(Boolean);
}

function linkMail(t, p) {
  const o = t.options || {};
  const T = texts(o.tone);
  const link = personalLink(p.token);
  const erase = `${link}?supprimer=1`;
  const org = o.organizerName || "";
  const lines = eventLines(o);
  const text = [
    T.hello(p.prenom), "", T.drawn(t.name, org), T.discover, "", `👉 ${link}`, "",
    ...(lines.length ? [...lines, ""] : []),
    T.keepSecret, T.linkNote, "", "—", T.privacy(org), `${T.eraseLink} : ${erase}`,
  ].join("\n");
  const html = mailShell(
    `<p style="font-size:16px;margin:0 0 10px">${esc(T.hello(p.prenom))}</p>
  <p style="font-size:16px;margin:0 0 6px">${esc(T.drawn(t.name, org))}</p>
  <p style="font-size:16px;margin:0 0 18px">${esc(T.discover)}</p>
  <p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 26px;border-radius:999px">${esc(T.button)} 🎁</a></p>
  ${lines.length ? `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 14px">${lines.map(esc).join("<br>")}</p>` : ""}
  <p style="font-size:14px;color:#444;margin:0">${esc(T.keepSecret)} ${esc(T.linkNote)}</p>`,
    `<p style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;color:#888;font-size:12px;line-height:1.5">${esc(T.privacy(org))} <a href="${esc(erase)}" style="color:#888">${esc(T.eraseLink)}</a></p>`,
  );
  return { from: FROM, to: p.email, subject: T.subject(t.name), text, html, replyTo: CONTACT_EMAIL };
}

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
