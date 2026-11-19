/*
 * Clic-Clac — helpers SERVEUR (route handlers uniquement).
 *  - Authentification : mot de passe super-admin (scrypt, en base) et code admin
 *    d'album (SHA-256, en base) → jetons signés HMAC (en-tête x-cc-auth).
 *    Portées : "super" (tout), "album:<id>" (organisateur), "booth:<id>" (borne).
 *  - Stockage : bucket PRIVÉ « clicclac », liens signés temporaires.
 *    Toutes les opérations Storage passent par ce module (changer de fournisseur
 *    plus tard = ne modifier qu'ici).
 */
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSettings, isAlbumCode, normalizeCode, CODE_ALPHABET } from "./settings";
import { r2Put, r2Remove, r2SignUrls } from "./r2";

export const BUCKET = "clicclac";
const HOUR = 3600 * 1000;

/* ── Jetons ─────────────────────────────────────────────────────── */
function secret() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant.");
  return crypto.createHash("sha256").update("clicclac-auth|" + k).digest();
}
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function signToken(scope, ttlMs = 12 * HOUR, extra = {}) {
  const body = b64url(JSON.stringify({ scope, exp: Date.now() + ttlMs, ...extra }));
  return `${body}.${b64url(crypto.createHmac("sha256", secret()).update(body).digest())}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const good = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}

const tokenOf = (req) => verifyToken(req.headers.get("x-cc-auth"));
export const isSuper = (req) => tokenOf(req)?.scope === "super";

/* Empreinte courte du code organisateur, gravée dans les jetons organisateur
 * et borne : régénérer le code les invalide tous (appareils, liens borne). */
export const pinStamp = (album) => String(album.admin_hash || "").slice(0, 12);
export const ADMIN_TTL = 7 * 24 * HOUR; // connexion organisateur : 7 jours sur l'appareil
export const albumToken = (album) => signToken(`album:${album.id}`, ADMIN_TTL, { h: pinStamp(album) });
export const boothTokenFor = (album) => signToken(`booth:${album.id}`, 7 * 24 * HOUR, { h: pinStamp(album) });

/* Rôle du demandeur pour un album : "super" | "admin" | "booth" | null. */
export function roleFor(req, album) {
  const t = tokenOf(req);
  if (!t) return null;
  if (t.scope === "super") return "super";
  if (t.h !== pinStamp(album)) return null; // code organisateur changé depuis
  if (t.scope === `album:${album.id}`) return "admin";
  if (t.scope === `booth:${album.id}`) return "booth";
  return null;
}

/* ── Passes de connexion (sans code organisateur) ──────────────────
 * Rangés dans jukebox_config « ccjoin:<nonce> ». Usage unique (QR « sur mon
 * téléphone », 10 min) ou multiple (lien envoyé par le super-admin, 7 jours).
 * Invalides si le code organisateur a changé. */
export async function createPass(album, { ttlMs, multi = false }) {
  const nonce = crypto.randomBytes(18).toString("base64url");
  const { error } = await getSupabaseAdmin().from("jukebox_config").upsert({
    key: `ccjoin:${nonce}`, value: JSON.stringify({ album: album.id, h: pinStamp(album), exp: Date.now() + ttlMs, multi }),
  });
  if (error) throw error;
  return nonce;
}

export async function usePass(album, nonce) {
  if (!/^[\w-]{16,40}$/.test(String(nonce || ""))) return false;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("jukebox_config").select("value").eq("key", `ccjoin:${nonce}`).maybeSingle();
  let v = null;
  try { v = data ? JSON.parse(data.value) : null; } catch (e) { v = null; }
  if (!v) return false;
  if (!v.multi || v.exp < Date.now()) await sb.from("jukebox_config").delete().eq("key", `ccjoin:${nonce}`);
  return v.album === album.id && v.h === pinStamp(album) && v.exp >= Date.now();
}

/* Passes expirés (appelé par la purge). */
export async function purgePasses() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("jukebox_config").select("key,value").like("key", "ccjoin:%");
  const dead = (data || []).filter((r) => { try { return JSON.parse(r.value).exp < Date.now(); } catch (e) { return true; } }).map((r) => r.key);
  if (dead.length) await sb.from("jukebox_config").delete().in("key", dead);
}
export const canAdmin = (role) => role === "super" || role === "admin";

/* ── Mots de passe ──────────────────────────────────────────────── */
export async function checkMasterPassword(pw) {
  const { data, error } = await getSupabaseAdmin().from("clicclac_config").select("master_hash").eq("id", 1).maybeSingle();
  if (error) throw error;
  const [, salt, hash] = String(data?.master_hash || "").split("$");
  if (!salt || !hash || typeof pw !== "string" || !pw) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const ref = Buffer.from(hash, "hex");
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

/* Changement du mot de passe super-admin (Clic-Clac et Jukebox) : l'ancien
 * est exigé. Renvoie un message d'erreur, ou null si c'est fait. */
export const MIN_MASTER_LEN = 8;
export async function changeMasterPassword(current, next) {
  if (!(await checkMasterPassword(current))) return "Mot de passe actuel incorrect.";
  if (typeof next !== "string" || next.length < MIN_MASTER_LEN) return `Le nouveau mot de passe doit faire au moins ${MIN_MASTER_LEN} caractères.`;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(next, salt, 64).toString("hex");
  const { error } = await getSupabaseAdmin().from("clicclac_config").update({ master_hash: `scrypt$${salt}$${hash}` }).eq("id", 1);
  if (error) throw error;
  return null;
}

export const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export function checkPin(pin, hash) {
  if (!pin || !hash) return false;
  const a = Buffer.from(sha256(String(pin).toUpperCase().trim())), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function randomCode(len) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/* ── Albums ─────────────────────────────────────────────────────── */
export async function loadAlbum(code) {
  const c = normalizeCode(code);
  if (!isAlbumCode(c)) return null;
  const { data, error } = await getSupabaseAdmin().from("clicclac_albums").select("*").eq("code", c).maybeSingle();
  if (error) throw error;
  return data ? { ...data, settings: normalizeSettings(data.settings) } : null;
}

/* Date d'expiration = fin du jour de l'événement + durée de conservation. */
export function computeExpiry(eventDate, retentionDays) {
  const base = eventDate ? new Date(`${eventDate}T23:59:59Z`) : new Date();
  return new Date(base.getTime() + retentionDays * 24 * HOUR).toISOString();
}

/* Toutes les lignes d'une requête : Supabase plafonne chaque réponse à 1 000
 * lignes, on lit donc par pages. build() doit renvoyer une requête TRIÉE de
 * façon stable (sinon les pages se chevauchent). */
export async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) return out;
  }
}

export async function albumUsage(albumId) {
  const data = await fetchAll(() => getSupabaseAdmin().from("clicclac_photos").select("bytes,status").eq("album_id", albumId).order("id"));
  return {
    photos: data.length,
    pending: data.filter((p) => p.status === "pending").length,
    bytes: data.reduce((s, p) => s + (p.bytes || 0), 0),
  };
}

/* Informations publiques d'un album (invités). */
export async function publicAlbum(a) {
  const s = a.settings;
  const customFrameUrl = s.customFrame ? (await signUrls([s.customFrame]))[0] : null;
  return {
    code: a.code,
    name: String(a.name || "").normalize("NFC"),
    eventDate: a.event_date,
    expiresAt: a.expires_at,
    settings: {
      guestQuota: s.guestQuota, moderation: s.moderation, maxPhotos: s.maxPhotos,
      framesMode: s.framesMode, frames: s.frames, imposedFrame: s.imposedFrame,
      filtersMode: s.filtersMode, filters: s.filters, imposedFilter: s.imposedFilter,
      stripEnabled: s.stripEnabled, guestDownload: s.guestDownload, keepHd: s.keepHd, crop: s.crop,
      uploadsOpen: s.uploadsOpen, allowImport: s.allowImport,
      hasCustomFrame: !!s.customFrame,
    },
    customFrameUrl,
  };
}

/* ── Stockage ───────────────────────────────────────────────────── */
/* Fournisseur choisi par CLICCLAC_STORAGE : "supabase" (défaut) ou "r2"
 * (voir lib/clicclac/r2.js et docs/clicclac-r2.md). */
export const useR2 = () => process.env.CLICCLAC_STORAGE === "r2";

export async function putFile(path, buffer, contentType) {
  if (useR2()) return r2Put(path, buffer, contentType);
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (useR2()) return r2Remove(list);
  for (let i = 0; i < list.length; i += 900) {
    const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove(list.slice(i, i + 900));
    if (error) throw error;
  }
}

/* Liens signés (1 h par défaut), dans l'ordre des chemins demandés. */
export async function signUrls(paths, ttlSec = 3600) {
  if (!paths.length) return [];
  if (useR2()) return r2SignUrls(paths, ttlSec);
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, ttlSec);
  if (error) throw error;
  const map = new Map(data.map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => map.get(p) || null);
}

/* Photo telle que l'écran live l'affiche (liens signés 3 h), à partir d'une ligne en base. */
export async function livePhotoOf(row) {
  const [thumb, full] = await signUrls([row.thumb_path, row.path], 3 * 3600);
  return { id: row.id, thumb, full, name: (row.guest_name || "").normalize("NFC"), caption: (row.caption || "").normalize("NFC"), kind: row.kind };
}

/* Supprime un album : fichiers puis lignes (les photos suivent en cascade). */
export async function deleteAlbum(album) {
  const sb = getSupabaseAdmin();
  const photos = await fetchAll(() => sb.from("clicclac_photos").select("path,thumb_path,hd_path").eq("album_id", album.id).order("id"));
  const files = photos.flatMap((p) => [p.path, p.thumb_path, p.hd_path]);
  if (album.settings?.customFrame) files.push(album.settings.customFrame);
  await removeFiles(files);
  await sb.from("jukebox_config").delete().in("key", [`cclive:${album.id}`, `ccscreens:${album.id}`]); // écran live
  const { error } = await sb.from("clicclac_albums").delete().eq("id", album.id);
  if (error) throw error;
}

/* Vérifie la signature binaire d'un JPEG / PNG. */
export function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}
