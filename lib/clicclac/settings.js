/*
 * Clic-Clac — réglages d'album (module PUR, partagé client + serveur).
 * Deux familles de réglages :
 *  - SUPER : décidés par le super-admin (capacité, conservation, HD) ;
 *  - ADMIN : décidés par l'organisateur de l'album.
 */

export const FRAMES = [
  { id: "none", label: "Sans cadre" },
  { id: "polaroid", label: "Polaroïd" },
  { id: "film", label: "Pellicule" },
  { id: "vintage", label: "Tirage vintage" },
  { id: "tape", label: "Ruban adhésif" },
  { id: "confetti", label: "Confettis" },
  { id: "postcard", label: "Carte postale" },
  { id: "gold", label: "Doré fin" },
  { id: "disposable", label: "Appareil jetable" },
  { id: "custom", label: "Cadre perso" },
];

export const FILTERS = [
  { id: "none", label: "Naturel" },
  { id: "nb", label: "Noir & blanc" },
  { id: "vintage", label: "Vintage" },
  { id: "chaud", label: "Chaud" },
  { id: "froid", label: "Froid" },
  { id: "contraste", label: "Contrasté" },
  { id: "doux", label: "Doux" },
];

/* Recadrage : free = l'invité choisit le format · off = désactivé ·
 * sinon format imposé (l'invité ajuste seulement position et zoom). */
export const CROPS = [
  { id: "orig", label: "Original", ratio: null },
  { id: "1:1", label: "Carré", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];
export const CROP_MODES = ["free", "off", "1:1", "4:3", "3:4", "16:9", "9:16"];

/* off = désactivé · imposed = un seul, imposé · choice = l'invité choisit */
export const MODES = ["off", "imposed", "choice"];

export const DEFAULT_SETTINGS = {
  // super-admin
  maxPhotos: 1000,
  retentionDays: 60,
  keepHd: true, // stockage R2 : la HD (impression) ne coûte presque rien
  // admin
  guestQuota: 20, // 0 = illimité (dans la limite de maxPhotos)
  moderation: false,
  framesMode: "choice",
  frames: ["none", "polaroid", "film", "vintage", "tape", "confetti", "postcard", "gold", "disposable"],
  imposedFrame: "polaroid",
  frameText: "none", // texte sur les cadres : none | date (de l'événement) | free
  frameFreeText: "",
  frameAccent: "#ff5a5f", // couleur de l'événement (ruban, confettis, timbre…)
  filtersMode: "choice",
  filters: ["none", "nb", "vintage", "chaud", "froid", "contraste", "doux"],
  imposedFilter: "none",
  customFrame: null, // chemin Storage du cadre perso (PNG)
  stripEnabled: true,
  guestDownload: true,
  crop: "free",
  uploadsOpen: true, // false = album en lecture seule (fin d'événement)
  allowImport: true, // les invités peuvent ajouter des photos de leur galerie
};

export const SUPER_KEYS = ["maxPhotos", "retentionDays", "keepHd"];
export const ADMIN_KEYS = ["guestQuota", "moderation", "framesMode", "frames", "imposedFrame", "frameText", "frameFreeText", "frameAccent", "filtersMode", "filters", "imposedFilter", "stripEnabled", "guestDownload", "crop", "uploadsOpen", "allowImport"];

const int = (v, d, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const pickIds = (list, all) => {
  const ids = all.map((x) => x.id);
  const out = Array.isArray(list) ? list.filter((x) => ids.includes(x)) : null;
  return out && out.length ? [...new Set(out)] : null;
};

/* Anciens cadres (catalogue d'avant nov. 2026) → leur remplaçant. */
const OLD_FRAMES = { band: "polaroid", neon: "polaroid", baroque: "gold", wood: "gold", silver: "gold", gallery: "gold" };
export const FRAME_TEXTS = ["none", "date", "free"];
export const MAX_FRAME_TEXT = 40;

export function normalizeSettings(raw) {
  const s = raw || {};
  const d = DEFAULT_SETTINGS;
  const oldFrame = (id) => OLD_FRAMES[id] || id;
  const frames = pickIds(Array.isArray(s.frames) ? s.frames.map(oldFrame) : s.frames, FRAMES) || d.frames;
  const imposed = oldFrame(s.imposedFrame);
  const filters = pickIds(s.filters, FILTERS) || d.filters;
  return {
    maxPhotos: int(s.maxPhotos, d.maxPhotos, 1, 5000),
    retentionDays: int(s.retentionDays, d.retentionDays, 1, 365),
    keepHd: typeof s.keepHd === "boolean" ? s.keepHd : d.keepHd,
    guestQuota: int(s.guestQuota, d.guestQuota, 0, 1000),
    moderation: typeof s.moderation === "boolean" ? s.moderation : d.moderation,
    framesMode: MODES.includes(s.framesMode) ? s.framesMode : d.framesMode,
    frames,
    imposedFrame: FRAMES.some((f) => f.id === imposed) ? imposed : d.imposedFrame,
    frameText: FRAME_TEXTS.includes(s.frameText) ? s.frameText : d.frameText,
    frameFreeText: typeof s.frameFreeText === "string" ? s.frameFreeText.normalize("NFC").trim().slice(0, MAX_FRAME_TEXT) : d.frameFreeText,
    frameAccent: /^#[0-9a-f]{6}$/i.test(s.frameAccent || "") ? s.frameAccent.toLowerCase() : d.frameAccent,
    filtersMode: MODES.includes(s.filtersMode) ? s.filtersMode : d.filtersMode,
    filters,
    imposedFilter: FILTERS.some((f) => f.id === s.imposedFilter) ? s.imposedFilter : d.imposedFilter,
    customFrame: typeof s.customFrame === "string" && /^[\w/-]+\.png$/.test(s.customFrame) ? s.customFrame : null,
    stripEnabled: typeof s.stripEnabled === "boolean" ? s.stripEnabled : d.stripEnabled,
    guestDownload: typeof s.guestDownload === "boolean" ? s.guestDownload : d.guestDownload,
    crop: CROP_MODES.includes(s.crop) ? s.crop : d.crop,
    uploadsOpen: typeof s.uploadsOpen === "boolean" ? s.uploadsOpen : d.uploadsOpen,
    allowImport: typeof s.allowImport === "boolean" ? s.allowImport : d.allowImport,
  };
}

/* Codes : alphabet sans caractères ambigus (0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const isAlbumCode = (c) => new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(String(c || ""));
export const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const MAX_NAME = 40;
export const MAX_CAPTION = 120;

/* ── Écran live : réglages d'affichage (partagés écran / télécommande) ── */
export const LIVE_DEFAULTS = { speed: 5, order: "recent", layout: "single", transition: "kenburns", newFirst: true, captions: true, qr: true, qrSize: "m" };
export const LIVE_QR_SIZES = [["s", "Petit"], ["m", "Moyen"], ["l", "Grand"]];
export const LIVE_SPEEDS = [3, 5, 8, 12, 20]; // la valeur par défaut doit en faire partie
/* Intitulé du rythme selon l'affichage. */
export const liveSpeedLabel = (layout) => (layout === "single" ? "Durée par photo"
  : layout === "mosaic" ? "Photo en vedette changée toutes les" : "Nouvelle photo posée toutes les");
export const LIVE_ORDERS = [["recent", "Récentes en boucle"], ["chrono", "Chronologique"], ["random", "Aléatoire"]];
export const LIVE_LAYOUTS = [["single", "Photo seule"], ["mosaic", "Mosaïque"], ["wall", "Pêle-mêle polaroïds"], ["collage", "Pêle-mêle photos"]];
export const LIVE_TRANSITIONS = [["fade", "Fondu"], ["kenburns", "Zoom lent"], ["slide", "Glissement"]];

export function normalizeLive(raw) {
  const s = raw || {}, d = LIVE_DEFAULTS;
  const one = (list, v, def) => (list.some(([k]) => k === v) ? v : def);
  const bool = (v, def) => (typeof v === "boolean" ? v : def);
  return {
    speed: LIVE_SPEEDS.includes(Number(s.speed)) ? Number(s.speed) : d.speed,
    order: one(LIVE_ORDERS, s.order, d.order),
    layout: one(LIVE_LAYOUTS, s.layout, d.layout),
    transition: one(LIVE_TRANSITIONS, s.transition, d.transition),
    newFirst: bool(s.newFirst, d.newFirst),
    captions: bool(s.captions, d.captions),
    qr: bool(s.qr, d.qr),
    qrSize: one(LIVE_QR_SIZES, s.qrSize, d.qrSize),
  };
}
