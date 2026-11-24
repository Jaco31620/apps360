"use client";
/*
 * Télé (apps360.fr/tv) : derniers affichages ouverts sur cette télé — app, code,
 * nom (soirée, album, question du nuage), avec ou sans le son. Gardés dans le
 * navigateur de la télé ; noms fournis au jumelage ou relus à l'ouverture.
 */
const KEY = "apps360:tvRecents";
const OLD_CODE = "jukebox:tvCode"; // ancien bouton « Reprendre » (une seule soirée Jukebox, sans nom)
const OLD_SOUND = "jukebox:tvSound";
const MAX = 4;
const MAX_AGE = 30 * 864e5;

export const APPS = {
  jukebox: { label: "Jukebox", desc: "La soirée : titre en cours, file d'attente, blind test", missing: "Cette soirée n'existe plus.", api: (c) => `/api/jukebox/${c}`, name: (d) => d.session?.name },
  clicclac: { label: "Clic-Clac", desc: "Les photos de l'événement, en direct", missing: "Cet album n'existe plus.", api: (c) => `/api/clicclac/${c}`, name: (d) => d.album?.name },
  nuage: { label: "Nuage de mots", desc: "Les mots du public, en direct", missing: "Ce nuage n'existe plus.", api: (c) => `/api/nuage/${c}?lite=1`, name: (d) => d.session?.question },
};

const same = (a, b) => a.app === b.app && a.code === b.code;
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* stockage indisponible */ }
  return list;
}

export function loadRecents() {
  try {
    const raw = localStorage.getItem(KEY);
    let list = JSON.parse(raw || "[]");
    if (!Array.isArray(list)) list = [];
    const old = localStorage.getItem(OLD_CODE);
    if (raw === null && /^\d{6}$/.test(old || "")) list = [{ app: "jukebox", code: old, name: "", sound: localStorage.getItem(OLD_SOUND) === "1", at: Date.now() }];
    return list.filter((r) => r && APPS[r.app] && r.code && Date.now() - r.at < MAX_AGE).slice(0, MAX);
  } catch (e) { return []; }
}

export const remember = (r) => save([{ ...r, at: Date.now() }, ...loadRecents().filter((x) => !same(x, r))].slice(0, MAX));
export const forget = (r) => save(loadRecents().filter((x) => !same(x, r)));
export const rename = (r, name) => save(loadRecents().map((x) => (same(x, r) ? { ...x, name } : x)));

/* { found, closed, name } ; erreur réseau ou serveur : exception. */
export async function lookup(app, code) {
  const res = await fetch(APPS[app].api(code), { cache: "no-store" });
  const d = await res.json().catch(() => ({}));
  if (res.status === 404) return { found: false, closed: !!d.closed };
  if (!res.ok) throw new Error("Connexion impossible, réessayez.");
  return { found: true, name: APPS[app].name(d) || "" };
}

export function when(at) {
  const day = (t) => new Date(t).setHours(0, 0, 0, 0);
  const d = Math.round((day(Date.now()) - day(at)) / 864e5);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`;
}
