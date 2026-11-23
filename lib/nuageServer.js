/*
 * Nuage de mots — helpers SERVEUR (à n'importer que depuis les route handlers).
 * Jeton présentateur : chaîne aléatoire remise au créateur ; seul son SHA-256
 * est stocké en base.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidCode } from "@/lib/nuage";
import { normalizeStyle } from "@/lib/nuageThemes";

export const newAdminToken = () => randomBytes(24).toString("hex");
export const hashToken = (t) => createHash("sha256").update(String(t)).digest("hex");

export function checkToken(token, hash) {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Colonnes utiles seulement ; rev / del_rev (SQL v3) : relues si elles existent,
 * sinon repli sur les colonnes d'origine (rien n'est alors économisé). */
const BASE_COLS = "id,code,question,admin_hash,status,max_per_participant,hidden,style";
let hasRev = true;
export async function loadSession(code) {
  if (!isValidCode(code)) return null;
  const sb = getSupabaseAdmin();
  if (hasRev) {
    const { data, error } = await sb.from("nuage_sessions").select(`${BASE_COLS},rev,del_rev`).eq("code", code).maybeSingle();
    if (!error) return data;
    if (!/rev/.test(error.message || "")) throw error;
    hasRev = false;
  }
  const { data, error } = await sb.from("nuage_sessions").select(BASE_COLS).eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

/* Purge : nuages sans aucune modification depuis 6 mois (SQL v3, colonne
 * active_at), avec leurs mots (cascade) et leurs images de titre. */
export async function purgeNuage() {
  const sb = getSupabaseAdmin();
  const limit = new Date(Date.now() - 183 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await sb.from("nuage_sessions").select("id,code").lt("active_at", limit).limit(200);
  if (error) {
    if (/active_at/.test(error.message || "")) return { skipped: "SQL v3 non appliqué" };
    throw error;
  }
  let deleted = 0;
  for (const s of data || []) {
    try {
      const { data: files } = await sb.storage.from("nuage-assets").list(s.code);
      if (files?.length) await sb.storage.from("nuage-assets").remove(files.map((f) => `${s.code}/${f.name}`));
      const { error: e } = await sb.from("nuage_sessions").delete().eq("id", s.id);
      if (e) throw e;
      deleted++;
    } catch (e) {
      console.error("nuage purge:", e);
    }
  }
  return { deleted };
}

export const publicSession = (s) => ({
  code: s.code,
  question: s.question,
  status: s.status,
  maxPerParticipant: s.max_per_participant,
  style: normalizeStyle(s.style),
  rev: s.rev ?? null,       // version du nuage (null avant le SQL v3)
  delRev: s.del_rev ?? null, // change quand des mots sont supprimés
});
