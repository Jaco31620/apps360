/*
 * Clic-Clac — pilotage de l'écran live depuis un téléphone (télécommande).
 * État rangé dans jukebox_config (clé « cclive:<album id> », pas de SQL dédié) :
 *   { rev, cfg (réglages d'affichage, ou null = ceux de l'écran), paused,
 *     cmd: { seq, type: "next" | "prev" | "show", photoId? }, seen (dernier
 *     signe de vie d'un écran télé, ms) }
 * L'écran interroge cet état toutes les 2 s et applique ce qui a changé.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLive } from "./settings";

const key = (albumId) => `cclive:${albumId}`;
const EMPTY = { rev: 0, cfg: null, paused: false, cmd: { seq: 0 }, seen: 0 };

export async function readLive(albumId) {
  const { data, error } = await getSupabaseAdmin().from("jukebox_config").select("value").eq("key", key(albumId)).maybeSingle();
  if (error) throw error;
  try { return { ...EMPTY, ...(data ? JSON.parse(data.value) : {}) }; } catch (e) { return { ...EMPTY }; }
}

async function write(albumId, state) {
  const { error } = await getSupabaseAdmin().from("jukebox_config").upsert({ key: key(albumId), value: JSON.stringify(state) });
  if (error) throw error;
}

/* Télécommande : { cfg?, paused?, cmd?: { type, photoId? } } */
export async function updateLive(albumId, patch) {
  const cur = await readLive(albumId);
  const next = { ...cur, rev: cur.rev + 1 };
  if (patch.cfg) next.cfg = normalizeLive({ ...(cur.cfg || {}), ...patch.cfg });
  if (typeof patch.paused === "boolean") next.paused = patch.paused;
  if (patch.cmd && ["next", "prev", "show"].includes(patch.cmd.type)) {
    next.cmd = { seq: (cur.cmd?.seq || 0) + 1, type: patch.cmd.type, ...(patch.cmd.type === "show" ? { photoId: String(patch.cmd.photoId || "") } : {}) };
  }
  await write(albumId, next);
  return next;
}

/* Signe de vie de l'écran télé (au plus une écriture toutes les 15 s). */
export async function touchLive(albumId, state) {
  if (Date.now() - (state.seen || 0) < 15000) return state;
  const next = { ...state, seen: Date.now() };
  await write(albumId, next);
  return next;
}

export async function deleteLive(albumId) {
  await getSupabaseAdmin().from("jukebox_config").delete().eq("key", key(albumId));
}
