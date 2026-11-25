/*
 * Page d'accueil : état, accès, accroche et ordre des apps, réglés dans le
 * backoffice (module PUR, partagé serveur / navigateur). Réglage enregistré :
 * { order: [href], apps: { href: { state, access, tag } } } ; une valeur absente
 * du réglage vient de lib/apps.js (sans `state` : « En test ») ; une app absente
 * se place à la fin. tag (accroche) : null ou { text, color, from, to }, jours
 * AAAA-MM-JJ compris, facultatifs (heure de Paris).
 */
export const STATES = { public: "Publique", test: "En test" };
export const ACCESS = { free: "Accès libre", request: "Sur demande" };
export const TAG_COLORS = { orange: "Orange", teal: "Turquoise", navy: "Bleu nuit", red: "Rouge fête" }; // styles : components/HomeCard.jsx
export const TAG_MAX = 24;
export const TAG_PRESETS = ["Nouveau", "Bêta"];

const day = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : "");
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

/* Accroche propre, ou null si elle est vide. */
export function cleanTag(t) {
  const text = [...String(t?.text || "").replace(/\s+/g, " ").trim()].slice(0, TAG_MAX).join("").trim();
  return text ? { text, color: TAG_COLORS[t.color] ? t.color : "orange", from: day(t.from), to: day(t.to) } : null;
}
/* Accroche à afficher ce jour-là, sinon null. */
export const activeTag = (t, now = today()) => (t && (!t.from || t.from <= now) && (!t.to || now <= t.to) ? t : null);

export function applyHome(apps, cfg) {
  const order = Array.isArray(cfg?.order) ? cfg.order : [];
  const rank = (a) => { const i = order.indexOf(a.href); return i < 0 ? order.length : i; };
  return apps.map((a) => {
    const c = cfg?.apps?.[a.href] || {};
    // ancien format (une étiquette « badge ») : « Nouveau » et « Bêta » deviennent l'accroche
    const old = TAG_PRESETS.includes(c.badge) ? { text: c.badge, color: "orange" } : a.tag;
    return {
      ...a,
      state: STATES[c.state] ? c.state : STATES[a.state] ? a.state : "test",
      access: ACCESS[c.access] ? c.access : a.access || "free",
      tag: cleanTag(c.tag === undefined ? old : c.tag),
    };
  }).sort((a, b) => rank(a) - rank(b)); // tri stable : ordre de lib/apps.js à égalité
}

/* Réglage à enregistrer d'après la liste envoyée ; null si invalide. */
export function cleanHome(apps, list) {
  if (!Array.isArray(list) || list.length !== apps.length) return null;
  const known = new Set(apps.map((a) => a.href));
  const out = { order: [], apps: {} };
  for (const x of list) {
    if (!x || !known.delete(x.href) || !STATES[x.state] || !ACCESS[x.access]) return null;
    const tag = cleanTag(x.tag);
    if (tag?.from && tag.to && tag.from > tag.to) return null;
    out.order.push(x.href);
    out.apps[x.href] = { state: x.state, access: x.access, tag };
  }
  return out;
}
