/*
 * Ami Invisible — fonctions PURES (client et serveur) : nettoyage des données,
 * tirage, message, vue « organisateur » d'un tirage (sans les paires).
 *
 * Un tirage enregistré (table `tirages`, colonne data = tableau par utilisateur) :
 *   { id, eventName, date, template,
 *     pairs: [{ offreur, receveur, message?, sentAt?, sends? }],
 *     journal?: [{ at, who, action, index? }] }
 *   v: 2 pour les tirages faits côté serveur (envois suivis) ; absent avant.
 * `message` n'existe que dans les tirages d'avant l'envoi côté serveur : le
 * message est désormais recalculé à l'envoi (modèle + participants à jour).
 */

export const LIMITS = {
  participants: 100, // par tirage
  carnet: 500, // contacts
  template: 4000, // caractères
  field: 120, // prénom, nom, e-mail, téléphone, nom d'événement
  sendsPerPair: 5, // envois d'un même résultat (1er envoi + renvois)
};

export const DEFAULT_TEMPLATE = `Bonjour {prenom_offreur} 🎁

Le tirage au sort Ami Invisible vient d'avoir lieu !

Tu offres un cadeau à : {prenom_receveur} {nom_receveur}

Garde le secret et bonne préparation !`;

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());

const str = (v, max = LIMITS.field) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/* Participant ou contact : { id, prenom, nom, email, tel }. null si invalide. */
export function cleanPerson(p) {
  if (!p || typeof p !== "object") return null;
  const out = { id: p.id, prenom: str(p.prenom), nom: str(p.nom), email: str(p.email).toLowerCase(), tel: str(p.tel) };
  if (!(typeof out.id === "number" || typeof out.id === "string") || String(out.id).length > 40) return null;
  if (!out.prenom || !isEmail(out.email)) return null;
  return out;
}

export function cleanCarnet(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const c = cleanPerson(p);
    if (!c || seen.has(c.email)) continue;
    seen.add(c.email);
    out.push(c);
    if (out.length >= LIMITS.carnet) break;
  }
  return out;
}

export const cleanTemplate = (t) => String(t ?? "").slice(0, LIMITS.template) || DEFAULT_TEMPLATE;

/* Remplace toutes les variables du modèle. */
export const fillMessage = (template, o, r) =>
  String(template || DEFAULT_TEMPLATE)
    .replaceAll("{prenom_offreur}", o?.prenom || "").replaceAll("{nom_offreur}", o?.nom || "")
    .replaceAll("{prenom_receveur}", r?.prenom || "").replaceAll("{nom_receveur}", r?.nom || "");

/* Aperçu sans dévoiler le résultat. */
export const SECRET = { prenom: "🤫 (secret)", nom: "" };

/* Tirage : à chaque offreur un receveur différent de lui-même et hors
 * exclusions (« A ne peut pas offrir à B »). Recherche aléatoire avec retour
 * arrière : trouve une solution dès qu'il en existe une (dans la limite
 * d'essais), quel que soit le nombre d'exclusions. Renvoie les index des
 * receveurs, ou null. `rand` : pour les tests. */
export function drawPairs(participants, exclusions = [], rand = Math.random) {
  const n = participants.length;
  if (n < 2) return null;
  const idx = new Map(participants.map((p, i) => [String(p.id), i]));
  const banned = participants.map(() => new Set());
  for (const e of exclusions || []) {
    const a = idx.get(String(e?.from)), b = idx.get(String(e?.to));
    if (a !== undefined && b !== undefined) banned[a].add(b);
  }
  const shuffled = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // offreurs les plus contraints d'abord
  const order = shuffled([...Array(n).keys()]).sort((a, b) => banned[b].size - banned[a].size);
  const taken = new Array(n).fill(false);
  const result = new Array(n);
  let steps = 0;
  const place = (k) => {
    if (k === n) return true;
    if (++steps > 200000) return false;
    const g = order[k];
    for (const r of shuffled([...Array(n).keys()])) {
      if (r === g || taken[r] || banned[g].has(r)) continue;
      taken[r] = true; result[g] = r;
      if (place(k + 1)) return true;
      taken[r] = false;
    }
    return false;
  };
  return place(0) ? result : null;
}

/* Vue organisateur : jamais les receveurs ni les messages. */
export function publicTirage(t) {
  return {
    id: t.id,
    eventName: t.eventName,
    date: t.date,
    template: t.template,
    tracked: (t.v || 1) >= 2, // envois suivis (tirages faits depuis le passage côté serveur)
    participants: (t.pairs || []).map((p) => ({
      ...p.offreur,
      sentAt: p.sentAt || null,
      sends: p.sends || 0,
    })),
  };
}

/* Résumé d'envoi : { total, sent, lastSentAt }. */
export function sendSummary(t) {
  const pairs = t.pairs || [];
  const sent = pairs.filter((p) => p.sentAt);
  return {
    total: pairs.length,
    sent: sent.length,
    lastSentAt: sent.reduce((m, p) => (!m || p.sentAt > m ? p.sentAt : m), null),
  };
}
