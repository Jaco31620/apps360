/*
 * Clic-Clac — programme du diaporama, SYNCHRONISÉ entre tous les écrans
 * (module PUR, partagé serveur / écrans / télécommande).
 *
 * L'état (rangé côté serveur) contient seq = { anchor, pos, front, seed } :
 *  - anchor : heure serveur (ms) du début du créneau 0 ; null = en pause ;
 *  - front  : photos prioritaires à montrer d'abord, dans l'ordre (nouvelles
 *             photos, « afficher cette photo ») — objets photo complets ;
 *  - pos    : position dans la liste ordonnée après la file prioritaire ;
 *  - seed   : graine de l'ordre aléatoire (même tirage sur tous les écrans).
 * Chaque écran calcule la photo du moment à partir de l'heure du serveur :
 * créneau k = (maintenant − anchor) / durée → front[k], sinon liste[pos + …].
 * Aucun échange entre écrans : ils tombent sur la même photo au même instant.
 */
import { LIVE_DEFAULTS } from "./settings";

export const DEFAULT_SEQ = { anchor: 0, pos: 0, front: [], seed: 1 };
export const RECENT_LOOP = 40; // « Récentes en boucle » : les 40 plus récentes
const FRONT_MAX = 12;

export const durationMs = (cfg) => (cfg?.speed || LIVE_DEFAULTS.speed) * 1000;
const mod = (a, n) => ((a % n) + n) % n;

function seqOf(state) {
  const s = { ...DEFAULT_SEQ, ...(state?.seq || {}) };
  return { ...s, front: Array.isArray(s.front) ? s.front : [] };
}

/* Créneau courant. En pause (ou anchor null) : figé sur le créneau 0. */
function slot(state, now) {
  const seq = seqOf(state);
  const d = durationMs(state?.cfg);
  const k = state?.paused || seq.anchor == null ? 0 : Math.max(0, Math.floor((now - seq.anchor) / d));
  return { seq, d, k };
}

/* Mélange déterministe (même graine → même ordre partout). */
function shuffle(list, seed) {
  let a = seed >>> 0 || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/* Liste dans l'ordre d'affichage (list : photos publiées, plus récentes d'abord). */
export function orderedList(list, cfg, seed) {
  const order = cfg?.order || LIVE_DEFAULTS.order;
  if (order === "chrono") return [...list].reverse();
  if (order === "random") return shuffle([...list].sort((x, y) => (x.id < y.id ? -1 : 1)), seed);
  return list.slice(0, RECENT_LOOP);
}

/* Dernière liste ordonnée gardée en mémoire (l'écran recalcule 4 fois par seconde). */
let memo = null;
function ordered(list, droppedIds, cfg, seed) {
  const key = `${cfg?.order}|${seed}|${droppedIds.join(",")}`;
  if (memo && memo.list === list && memo.key === key) return memo.out;
  const dropped = new Set(droppedIds);
  const out = orderedList(list.filter((p) => !dropped.has(p.id)), cfg, seed);
  memo = { list, key, out };
  return out;
}

/* Photo à l'écran à l'instant now (heure serveur).
 * → { photo, fresh, until } (until : fin du créneau, Infinity en pause) */
export function photoAt(state, list, now) {
  const { seq, d, k } = slot(state, now);
  const dropped = new Set(state?.dropped || []);
  const until = state?.paused || seq.anchor == null ? Infinity : seq.anchor + (k + 1) * d;
  if (k < seq.front.length && !dropped.has(seq.front[k].id)) return { photo: seq.front[k], fresh: !!seq.front[k].fresh, until };
  const L = ordered(list, state?.dropped || [], state?.cfg, seq.seed);
  if (!L.length) return { photo: null, fresh: false, until };
  return { photo: L[mod(seq.pos + Math.max(0, k - seq.front.length), L.length)], fresh: false, until };
}

/* Serveur : position actuelle figée dans l'état (avant toute modification). */
export function rebase(state, now) {
  const { seq, k } = slot(state, now);
  if (k < seq.front.length) return { ...seq, front: seq.front.slice(k) };
  return { ...seq, front: [], pos: seq.pos + (k - seq.front.length) };
}

/* Serveur : applique un changement au programme. action :
 *  { type: "next" | "prev" } · { type: "show", photo } · { type: "fresh", photo }
 *  · { type: "drop", id } · { type: "order" } (nouvel ordre → nouvelle graine) */
export function applySeq(seq, action, { random = Math.random } = {}) {
  const s = { ...seq, front: [...seq.front] };
  switch (action?.type) {
    case "next": if (s.front.length) s.front.shift(); else s.pos += 1; break;
    case "prev": s.front = []; s.pos -= 1; break;
    case "show": s.front = [action.photo, ...s.front.filter((p) => p.id !== action.photo.id)]; break;
    case "fresh": s.front = [{ ...action.photo, fresh: true }, ...s.front.filter((p) => p.id !== action.photo.id)]; break;
    case "drop": s.front = s.front.filter((p) => p.id !== action.id); break;
    case "order": s.seed = Math.floor(random() * 2 ** 31) || 1; s.pos = 0; break;
    default: break;
  }
  s.front = s.front.slice(0, FRONT_MAX);
  return s;
}
