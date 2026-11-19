/*
 * Clic-Clac — pilotage de l'écran live depuis un téléphone (télécommande).
 * Deux clés dans jukebox_config (pas de SQL dédié), écrites séparément pour
 * qu'une commande ne soit jamais écrasée par le signe de vie d'un écran :
 *  - « cclive:<album id> » : { rev, cfg (réglages, ou null), paused, seq
 *      (programme du diaporama synchronisé, voir liveSeq.js), dropped (photos
 *      retirées récemment), later (nouvelles photos arrivées pendant la pause) }
 *  - « ccscreens:<album id> » : { <écran>: { seen, ack, tv } }  ← écrans
 *    (ack = dernière commande appliquée : accusé de réception)
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLive, LIVE_DEFAULTS } from "./settings";
import { DEFAULT_SEQ, rebase, applySeq } from "./liveSeq";

const key = (albumId) => `cclive:${albumId}`;
const screensKey = (albumId) => `ccscreens:${albumId}`;
const EMPTY = { rev: 0, cfg: null, paused: false, seq: DEFAULT_SEQ, dropped: [], later: [] };
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

/* Modifie l'état : { cfg?, paused?, action? } — action : { type: "next" | "prev" }
 * · { type: "show" | "fresh", photo } (photo déjà vérifiée, liens signés)
 * · { type: "drop", id }. Le programme est d'abord figé à l'instant présent,
 * puis modifié, puis relancé (anchor = maintenant, ou null en pause). */
export async function updateLive(albumId, patch, now = Date.now()) {
  const cur = await readLive(albumId);
  let seq = rebase(cur, now);
  const next = { ...cur, rev: cur.rev + 1 };
  delete next.cmd; delete next.seen; // anciens formats
  if (patch.cfg) {
    const before = (cur.cfg || LIVE_DEFAULTS).order;
    next.cfg = normalizeLive({ ...(cur.cfg || {}), ...patch.cfg });
    if (next.cfg.order !== before) seq = applySeq(seq, { type: "order" });
  }
  if (typeof patch.paused === "boolean") next.paused = patch.paused;
  let later = [...(cur.later || [])];
  const a = patch.action;
  if (a?.type === "fresh") {
    if ((next.cfg || LIVE_DEFAULTS).newFirst) {
      if (next.paused) later = [a.photo, ...later.filter((p) => p.id !== a.photo.id)].slice(0, 12); // montrée à la reprise
      else seq = applySeq(seq, a);
    }
  } else if (a && ["next", "prev", "show", "drop"].includes(a.type) && (a.type !== "show" || a.photo)) {
    seq = applySeq(seq, a);
  }
  if (a?.type === "drop") {
    later = later.filter((p) => p.id !== a.id);
    next.dropped = [a.id, ...(cur.dropped || []).filter((x) => x !== a.id)].slice(0, 30);
  }
  // reprise après une pause : les photos arrivées entre-temps passent d'abord
  if (cur.paused && !next.paused && later.length) {
    for (const p of [...later].reverse()) seq = applySeq(seq, { type: "fresh", photo: p });
    later = [];
  }
  next.later = later;
  seq.anchor = next.paused ? null : now;
  next.seq = seq;
  await writeKey(key(albumId), next);
  return next;
}

/* Annonce sans faire échouer l'appelant (envoi, validation, suppression d'une photo). */
export async function announce(albumId, action) {
  try { await updateLive(albumId, { action }); } catch (e) { console.error("clicclac live announce:", e); }
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
