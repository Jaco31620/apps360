/*
 * Timer (/timer) — modèle pur, partagé client / serveur / tests : modes,
 * programmes, étapes d'une séance, liens de partage.
 * Un timer = { id, name, c } ; `c` = configuration d'un des cinq modes.
 */
export const MODES = { iv: "Intervalles", em: "EMOM", py: "Pyramide", ti: "Minuteur", ch: "Chrono" };

/* Champs de chaque mode : clé, libellé, type (t = durée en s, n = nombre), min, max. */
export const FIELDS = {
  iv: [["work", "Effort", "t", 1, 7200], ["rest", "Repos", "t", 0, 7200], ["rounds", "Tours", "n", 1, 99], ["sets", "Séries", "n", 1, 20], ["setRest", "Repos entre séries", "t", 0, 7200]],
  em: [["every", "Durée du tour", "t", 5, 7200], ["rounds", "Tours", "n", 1, 99]],
  py: [["min", "Départ", "t", 1, 7199], ["max", "Sommet", "t", 2, 7200], ["inc", "Palier", "t", 1, 3600], ["rest", "Repos", "t", 0, 7200]],
  ti: [["dur", "Durée", "t", 1, 7200]],
  ch: [["limit", "Limite", "t", 0, 7200]],
};

export const DEFAULTS = {
  iv: { m: "iv", work: 30, rest: 15, rounds: 8, sets: 1, setRest: 60 },
  em: { m: "em", every: 60, rounds: 10 },
  py: { m: "py", min: 20, max: 50, inc: 10, rest: 15 },
  ti: { m: "ti", dur: 300 },
  ch: { m: "ch", limit: 0 },
};

/* Temps avant le départ (s) : `c.prep` propre au timer ; absent = valeur par défaut des réglages. */
export const PREPS = [0, 5, 10, 15, 30];
export const prepLabel = (v) => (v ? `${v} s` : "Aucun");
export const prepOf = (c, general) => c.prep ?? general;

/* Configuration fiable (lien reçu, données du compte…) ; null si le mode est inconnu. */
export function normalizeConfig(raw) {
  const m = raw?.m;
  if (!Object.hasOwn(FIELDS, m)) return null;
  const c = { m };
  for (const [k, , , min, max] of FIELDS[m]) {
    const n = raw[k] == null || raw[k] === "" ? NaN : Math.round(Number(raw[k]));
    c[k] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULTS[m][k];
  }
  if (m === "py") {
    if (c.max <= c.min) c.max = c.min + 1;
    // 30 paliers au plus par versant
    c.inc = Math.max(c.inc, Math.ceil((c.max - c.min) / 30));
  }
  if (raw.prep != null && raw.prep !== "" && PREPS.includes(Number(raw.prep))) c.prep = Number(raw.prep);
  return c;
}

export const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 40);

/* Change un champ ; pyramide : le dernier réglage touché l'emporte. */
export function setField(c, key, value) {
  const next = { ...c, [key]: value };
  if (c.m === "py" && key === "max" && value <= c.min) next.min = Math.max(1, value - 1);
  return normalizeConfig(next);
}

/* Pas des boutons − / + : petit pas, puis grand pas en appui long. */
export function stepSize(key, value, big = false) {
  if (key === "limit") return big ? 300 : 60;
  const [s, l] = value < 60 ? [1, 5] : value < 300 ? [5, 10] : value < 1200 ? [10, 30] : [30, 60];
  return big ? l : s;
}
export function bump(c, key, dir, big = false) {
  const [, , type] = FIELDS[c.m].find((f) => f[0] === key);
  const v = c[key];
  // en descendant, le palier est celui de la valeur juste en dessous (1:00 → 0:59)
  const s = type === "n" ? 1 : stepSize(key, Math.max(0, dir < 0 ? v - 1 : v), big);
  return setField(c, key, v + dir * s);
}

export function fmt(s) {
  s = Math.max(0, Math.ceil(s - 1e-6));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
}

/* Étapes : k = work | rest | sets | prep, d = durée (Infinity : chrono libre), r/n = tour, s/sn = série. */
export function steps(c) {
  const o = [];
  if (c.m === "iv") {
    for (let s = 1; s <= c.sets; s++) {
      for (let r = 1; r <= c.rounds; r++) {
        const p = { r, n: c.rounds, s, sn: c.sets };
        o.push({ k: "work", d: c.work, ...p });
        if (r < c.rounds) { if (c.rest) o.push({ k: "rest", d: c.rest, ...p }); }
        else if (s < c.sets && c.setRest) o.push({ k: "sets", d: c.setRest, ...p });
      }
    }
  }
  if (c.m === "em") for (let r = 1; r <= c.rounds; r++) o.push({ k: "work", d: c.every, r, n: c.rounds });
  if (c.m === "py") {
    const up = [];
    for (let d = c.min; d < c.max; d += c.inc) up.push(d);
    const all = [...up, c.max, ...up.slice().reverse()];
    all.forEach((d, i) => {
      o.push({ k: "work", d, r: i + 1, n: all.length });
      if (c.rest && i < all.length - 1) o.push({ k: "rest", d: c.rest, r: i + 1, n: all.length });
    });
  }
  if (c.m === "ti") o.push({ k: "work", d: c.dur });
  if (c.m === "ch") o.push({ k: "work", d: c.limit || Infinity, up: true });
  return o;
}

export const total = (c) => steps(c).reduce((a, s) => a + s.d, 0);
export const totalText = (c) => (c.m === "ch" && !c.limit ? "libre" : fmt(total(c)));

export function describe(c) {
  if (c.m === "iv") return `${fmt(c.work)} / ${fmt(c.rest)} × ${c.rounds}${c.sets > 1 ? ` · ${c.sets} séries` : ""}`;
  if (c.m === "em") return `Départ toutes les ${fmt(c.every)} × ${c.rounds}`;
  if (c.m === "py") return `De ${fmt(c.min)} à ${fmt(c.max)} et retour`;
  if (c.m === "ti") return "Compte à rebours";
  return c.limit ? `Limite ${fmt(c.limit)}` : "Sans limite";
}

const iv = (work, rest, rounds, sets = 1, setRest = 60) => ({ m: "iv", work, rest, rounds, sets, setRest });
const P = (id, cat, name, c, d) => ({ id, cat, name, c, d });
export const PRESETS = [
  P("tabata", "Cardio", "Tabata", iv(20, 10, 8), "20/10 × 8"),
  P("h3030", "Cardio", "HIIT 30/30", iv(30, 30, 10), "30/30 × 10"),
  P("h4020", "Cardio", "HIIT 40/20", iv(40, 20, 10), "40/20 × 10"),
  P("h4515", "Cardio", "HIIT 45/15", iv(45, 15, 10), "45/15 × 10"),
  P("c7", "Cardio", "Circuit 7 minutes", iv(30, 10, 12), "30/10 × 12"),
  P("sit", "Cardio", "Sprints longs", iv(30, 240, 4), "30 s à fond, 4 min de récup × 4"),
  P("tab4", "Cardio", "Tabata × 4", iv(20, 10, 8, 4, 60), "4 séries, 1 min entre chaque"),
  P("pyr", "Cardio", "Pyramide 20 à 60", { m: "py", min: 20, max: 60, inc: 10, rest: 15 }, "20-30-40-50-60 s puis retour"),
  P("n44", "Course", "Norvégien 4 × 4", iv(240, 180, 4), "4 min vite, 3 min lent × 4"),
  P("f11", "Course", "Fractionné 1/1", iv(60, 60, 10), "1 min vite, 1 min lent × 10"),
  P("pyrc", "Course", "Pyramide 1 à 4 min", { m: "py", min: 60, max: 240, inc: 60, rest: 60 }, "1-2-3-4-3-2-1 min"),
  P("em10", "Cross-training", "EMOM 10", { m: "em", every: 60, rounds: 10 }, "Départ chaque minute × 10"),
  P("e2m", "Cross-training", "E2MOM", { m: "em", every: 120, rounds: 6 }, "Départ toutes les 2 min × 6"),
  P("am12", "Cross-training", "AMRAP 12", { m: "ti", dur: 720 }, "Max de tours en 12 min"),
  P("ft", "Cross-training", "For Time 20", { m: "ch", limit: 1200 }, "Chrono, limite 20 min"),
  P("box", "Cross-training", "Boxe 3 × 3", iv(180, 60, 3), "Rounds de 3 min, 1 min de repos"),
  P("gain", "Douceur", "Gainage", iv(45, 15, 5), "45/15 × 5"),
  P("etir", "Douceur", "Étirements", iv(30, 5, 10), "30 s par posture × 10"),
  P("pomo", "Autres usages", "Pomodoro", iv(1500, 300, 4), "25 min de travail, 5 de pause × 4"),
  P("dents", "Autres usages", "Brossage des dents", { m: "ti", dur: 120 }, "2 min"),
  P("oeuf", "Autres usages", "Œufs mollets", { m: "ti", dur: 360 }, "6 min"),
];
const PRESET_IDS = new Set(PRESETS.map((p) => p.id));

/* Lien de partage : tout est dans l'adresse, rien en base. */
export function shareQuery(name, c) {
  const t = [c.m, ...FIELDS[c.m].map(([k]) => c[k]), ...(c.prep == null ? [] : [c.prep])].join("-");
  return `t=${t}&n=${encodeURIComponent(cleanName(name))}`;
}
export function parseShare(search) {
  const q = new URLSearchParams(search);
  const [m, ...vals] = String(q.get("t") || "").split("-");
  if (!Object.hasOwn(FIELDS, m)) return null;
  const c = normalizeConfig(Object.fromEntries([["m", m], ...FIELDS[m].map(([k], i) => [k, vals[i]]), ["prep", vals[FIELDS[m].length]]]));
  return { name: cleanName(q.get("n")) || MODES[m], c };
}

/* Données du compte : timers perso et favoris, bornés. */
export const MAX_TIMERS = 100;
export function normalizeData(raw) {
  const mine = [];
  const seen = new Set();
  for (const t of Array.isArray(raw?.mine) ? raw.mine : []) {
    const c = normalizeConfig(t?.c), name = cleanName(t?.name), id = String(t?.id ?? "").slice(0, 40);
    if (!c || !name || !id || seen.has(id) || mine.length >= MAX_TIMERS) continue;
    seen.add(id);
    mine.push({ id, name, c });
  }
  const favs = [...new Set((Array.isArray(raw?.favs) ? raw.favs : []).filter((x) => PRESET_IDS.has(x)))];
  return { mine, favs };
}
/* Première connexion sur un appareil : ce qui était enregistré ici s'ajoute au compte. */
export function mergeData(local, remote) {
  return normalizeData({ mine: [...(remote?.mine || []), ...(local?.mine || [])], favs: [...(remote?.favs || []), ...(local?.favs || [])] });
}
