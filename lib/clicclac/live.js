/*
 * Clic-Clac — pilotage de l'écran live depuis un téléphone (télécommande).
 * Deux clés dans jukebox_config (pas de SQL dédié), écrites séparément pour
 * qu'une commande ne soit jamais écrasée par le signe de vie d'un écran :
 *  - « cclive:<album id> » : { rev, cfg (réglages, ou null), paused,
 *      cmd: { seq, type: "next" | "prev" | "show", photo? } }  ← télécommande
 *  - « ccscreens:<album id> » : { <écran>: { seen, ack, tv } }  ← écrans
 *    (ack = dernière commande appliquée : accusé de réception)
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLive } from "./settings";

const key = (albumId) => `cclive:${albumId}`;
const screensKey = (albumId) => `ccscreens:${albumId}`;
const EMPTY = { rev: 0, cfg: null, paused: false, cmd: { seq: 0 } };
export const SCREEN_ALIVE_MS = 40000;

async function readKey(k, empty) {
  const { data, error } = await getSupabaseAdmin().from("jukebox_config").select("value").eq("key", k).maybeSingle();
  if (error) throw error;
  try { return { ...empty, ...(data ? JSON.parse(data.value) : {}) }; } catch (e) { return { ...empty }; }
}
async function writeKey(k, value) {
  const { error } = await getSupabaseAdmin().from("jukebox_config").upsert({ key: k, value: JSON.stringify(value) });
  if (error) throw error;
}

export const readLive = (albumId) => readKey(key(albumId), EMPTY);

/* Télécommande : { cfg?, paused?, cmd?: { type, photo? } } (photo : déjà vérifiée par la route) */
export async function updateLive(albumId, patch) {
  const cur = await readLive(albumId);
  const next = { ...cur, rev: cur.rev + 1 };
  if (patch.cfg) next.cfg = normalizeLive({ ...(cur.cfg || {}), ...patch.cfg });
  if (typeof patch.paused === "boolean") next.paused = patch.paused;
  if (patch.cmd && ["next", "prev", "show"].includes(patch.cmd.type) && (patch.cmd.type !== "show" || patch.cmd.photo)) {
    next.cmd = { seq: (cur.cmd?.seq || 0) + 1, type: patch.cmd.type, ...(patch.cmd.type === "show" ? { photo: patch.cmd.photo } : {}) };
  }
  delete next.seen; // ancien format
  await writeKey(key(albumId), next);
  return next;
}

/* Signe de vie d'un écran + accusé de réception (écriture seulement si utile). */
export async function touchScreen(albumId, screenId, { ack, tv }) {
  const all = await readKey(screensKey(albumId), {});
  const now = Date.now();
  const cur = all[screenId];
  const changed = !cur || cur.ack !== ack || cur.tv !== tv || now - cur.seen > 15000;
  if (changed) {
    const next = { [screenId]: { seen: now, ack, tv } };
    for (const [id, v] of Object.entries(all)) if (id !== screenId && now - v.seen < 10 * 60000) next[id] = v; // écrans disparus : oubliés
    await writeKey(screensKey(albumId), next);
    return next;
  }
  return all;
}

/* Écrans actifs (vus depuis moins de 40 s). */
export async function activeScreens(albumId) {
  const all = await readKey(screensKey(albumId), {});
  const now = Date.now();
  return Object.values(all).filter((v) => now - v.seen < SCREEN_ALIVE_MS).map(({ ack, tv, seen }) => ({ ack, tv: !!tv, seen }));
}

export async function deleteLive(albumId) {
  await getSupabaseAdmin().from("jukebox_config").delete().in("key", [key(albumId), screensKey(albumId)]);
}
