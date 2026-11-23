"use client";
/*
 * Backoffice apps360 — session de l'appareil (localStorage) :
 *  - apps360_admin : jeton backoffice (7 jours, /api/admin) ;
 *  - jukebox_super et cc_super : jetons des super-admins, mêmes clés que
 *    components/jukebox/storage.js et components/clicclac/client.js.
 * La validité est lue dans le jeton lui-même (date d'expiration) : aucun appel
 * au serveur tant qu'un jeton est valide.
 */
const KEYS = { admin: "apps360_admin", jukebox: "jukebox_super", clicclac: "cc_super" };

const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* ignoré */ } };

/* Expiration (ms) inscrite dans un jeton signé « corps.signature ». */
function expOf(token) {
  try {
    const body = String(token).split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(body)).exp || 0;
  } catch (e) {
    return 0;
  }
}
const valid = (token) => !!token && expOf(token) > Date.now() + 60_000;

export const adminToken = () => (valid(get(KEYS.admin)) ? get(KEYS.admin) : null);

function store(r) {
  if (r.token) set(KEYS.admin, r.token);
  if (r.jukebox) set(KEYS.jukebox, r.jukebox);
  if (r.clicclac) set(KEYS.clicclac, r.clicclac);
}

async function post(body) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Connexion impossible."), { status: res.status });
  return r;
}

export async function login(password) {
  store(await post({ password }));
}

/* Avant d'ouvrir un super-admin : jeton de l'appareil encore valide → rien ;
 * sinon, si le backoffice est connecté, un seul appel renouvelle les jetons. */
export async function ensureApp(app) {
  if (valid(get(KEYS[app]))) return;
  const token = adminToken();
  if (!token) return; // le super-admin demandera son mot de passe
  try { store(await post({ token })); } catch (e) { if (e.status === 401) set(KEYS.admin, null); }
}

export function logout() {
  Object.values(KEYS).forEach((k) => set(k, null));
}
