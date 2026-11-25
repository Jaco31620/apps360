/*
 * Page d'accueil : état, étiquette et ordre des apps, réglés dans le backoffice
 * (module PUR, partagé serveur / navigateur). Réglage enregistré :
 * { order: [href], apps: { href: { state, badge } } } ; une app absente du
 * réglage garde les valeurs de lib/apps.js (sans `state` : « En test ») et se
 * place à la fin.
 */
export const STATES = { public: "Publique", test: "En test" };
export const BADGES = ["Gratuit", "Sur demande", "Nouveau", "Bêta", ""];

export function applyHome(apps, cfg) {
  const order = Array.isArray(cfg?.order) ? cfg.order : [];
  const rank = (a) => { const i = order.indexOf(a.href); return i < 0 ? order.length : i; };
  return apps.map((a) => {
    const c = cfg?.apps?.[a.href] || {};
    return { ...a, state: STATES[c.state] ? c.state : STATES[a.state] ? a.state : "test", badge: BADGES.includes(c.badge) ? c.badge : a.badge || "" };
  }).sort((a, b) => rank(a) - rank(b)); // tri stable : ordre de lib/apps.js à égalité
}

/* Réglage à enregistrer d'après la liste envoyée ; null si invalide. */
export function cleanHome(apps, list) {
  if (!Array.isArray(list) || list.length !== apps.length) return null;
  const known = new Set(apps.map((a) => a.href));
  const out = { order: [], apps: {} };
  for (const x of list) {
    if (!x || !known.delete(x.href) || !STATES[x.state] || !BADGES.includes(x.badge)) return null;
    out.order.push(x.href);
    out.apps[x.href] = { state: x.state, badge: x.badge };
  }
  return out;
}
