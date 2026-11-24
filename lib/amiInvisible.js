/*
 * Ami Invisible — fonctions PURES (client et serveur) : nettoyage des
 * données, liste collée, tirage, message, textes selon le ton.
 *
 * Un tirage (table ai_tirages) est d'abord un brouillon : ses participants
 * sont dans `draft` ([{ key, prenom, nom, email }]) et les exclusions
 * ([{ from, to, both }]) désignent ces `key`. Au tirage, chaque participant
 * devient une ligne ai_participants (receveur, lien personnel, envoi…).
 */
import { fmtDateFr } from "@/lib/dates";
import { mailHeader } from "@/lib/appIcons";

export const LIMITS = {
  participants: 100,
  carnet: 500,
  template: 4000,
  field: 120,
  wishlist: 2000,
  exclusions: 2000,
  sendsPerPair: 5, // envois d'un même lien par l'organisateur (1er envoi + renvois)
  mailSubject: 120,
  mailText: 1500,
};

export const TONES = ["tu", "vous"];
export const TONE_LABELS = { tu: "Tutoiement", vous: "Vouvoiement" };

export const DEFAULT_TEMPLATES = {
  tu: `Bonjour {prenom_offreur} 🎁

Tu offres un cadeau à : {prenom_receveur} {nom_receveur}

Garde le secret et bonne préparation !`,
  vous: `Bonjour {prenom_offreur} 🎁

Vous offrez un cadeau à : {prenom_receveur} {nom_receveur}

Gardez le secret et bonne préparation !`,
};
export const defaultTemplate = (tone) => DEFAULT_TEMPLATES[tone === "vous" ? "vous" : "tu"];
export const isDefaultTemplate = (t) => Object.values(DEFAULT_TEMPLATES).includes(String(t || "").trim());

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
const str = (v, max = LIMITS.field) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const longStr = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);

/* Participant ou contact : { key, prenom, nom, email }. null si invalide. */
export function cleanPerson(p) {
  if (!p || typeof p !== "object") return null;
  const key = str(p.key ?? p.id, 40);
  const out = { key, prenom: str(p.prenom), nom: str(p.nom), email: str(p.email).toLowerCase() };
  if (!key || !out.prenom || !isEmail(out.email)) return null;
  return out;
}

/* Brouillon : on garde aussi les lignes incomplètes (saisie en cours). */
export function cleanDraft(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, LIMITS.participants).map((p) => ({
    key: str(p?.key, 40) || Math.random().toString(36).slice(2, 10),
    prenom: str(p?.prenom), nom: str(p?.nom), email: str(p?.email).toLowerCase(),
  }));
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

export function cleanExclusions(list, keys) {
  const ok = keys ? new Set(keys) : null;
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const from = str(e?.from, 40), to = str(e?.to, 40);
    if (!from || !to || from === to || (ok && (!ok.has(from) || !ok.has(to)))) continue;
    const k = `${from}>${to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ from, to, both: e?.both !== false });
    if (out.length >= LIMITS.exclusions) break;
  }
  return out;
}

/* Options du tirage. */
export function cleanOptions(o = {}) {
  const out = {
    tone: o.tone === "vous" ? "vous" : "tu",
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date || "")) ? o.date : "",
    place: str(o.place),
    budget: str(o.budget, 40),
    organizerName: str(o.organizerName),
    organizerPlays: o.organizerPlays !== false,
    wishlist: !!o.wishlist,
  };
  // e-mail d'envoi personnalisé ("" = texte par défaut, qui suit le ton et le prénom de l'organisateur)
  const subject = str(o.mailSubject, LIMITS.mailSubject);
  const text = longStr(o.mailText, LIMITS.mailText).replace(/\r\n/g, "\n").trim();
  out.mailSubject = subject && subject !== DEFAULT_SUBJECT ? subject : "";
  out.mailText = text && text !== defaultMailText(out) ? text : "";
  return out;
}

/* ── E-mail d'envoi du lien ─────────────────────────────────────────
 * Partie modifiable par l'organisateur : objet + texte d'introduction
 * (variables {prenom}, {nom}, {tirage}, {organisateur}). Partie fixe :
 * bouton vers le lien personnel, infos de l'échange, rappel du secret,
 * pied de page confidentialité / suppression des coordonnées. */
export const MAIL_VARS = ["{prenom}", "{nom}", "{tirage}", "{organisateur}"];
export const DEFAULT_SUBJECT = "🎁 Ami Invisible : {tirage}";
export function defaultMailText(o = {}) {
  const tu = o.tone !== "vous";
  return [
    "Bonjour {prenom},",
    "",
    `Le tirage au sort « {tirage} »${o.organizerName ? " organisé par {organisateur}" : ""} a eu lieu !`,
    tu ? "Découvre à qui tu offres un cadeau :" : "Découvrez à qui vous offrez un cadeau :",
  ].join("\n");
}
export const mailSubjectOf = (o = {}) => o.mailSubject || DEFAULT_SUBJECT;
export const mailTextOf = (o = {}) => o.mailText || defaultMailText(o);
export const fillMail = (tpl, t, p) =>
  String(tpl || "")
    .replaceAll("{prenom}", p?.prenom || "").replaceAll("{nom}", p?.nom || "")
    .replaceAll("{tirage}", t?.name || "").replaceAll("{organisateur}", t?.options?.organizerName || "");

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SITE_URL = "https://apps360.fr";

export function mailShell(inner, footer = "") {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:8px">
  ${mailHeader("ami-invisible", "Ami Invisible", "#dc2626", 16)}
  ${inner}
  ${footer}
  <p style="margin-top:18px;color:#999;font-size:12px">Ami Invisible · <a href="${SITE_URL}" style="color:#999">apps360.fr</a></p>
</div>`;
}

export function eventLines(o = {}) {
  return [
    o.date ? `📅 ${fmtDay(o.date)}` : "",
    o.place ? `📍 ${o.place}` : "",
    o.budget ? `💶 Budget : ${o.budget}` : "",
  ].filter(Boolean);
}

/* E-mail du lien personnel : { subject, text, html }. Sert à l'envoi (serveur)
 * et à l'aperçu (navigateur, avec un lien factice). */
export function buildLinkMail(t, p, link) {
  const o = t.options || {};
  const T = texts(o.tone);
  const erase = `${link}?supprimer=1`;
  const privacyUrl = `${SITE_URL}/ami-invisible/confidentialite`;
  const org = o.organizerName || "";
  const lines = eventLines(o);
  const intro = fillMail(mailTextOf(o), t, p).trim();
  const subject = fillMail(mailSubjectOf(o), t, p).replace(/\s+/g, " ").trim() || T.subject(t.name);
  const text = [
    intro, "", `👉 ${link}`, "",
    ...(lines.length ? [...lines, ""] : []),
    T.keepSecret, T.linkNote, "", "—", T.privacy(org), `${T.eraseLink} : ${erase}`, `Confidentialité : ${privacyUrl}`,
  ].join("\n");
  const paras = intro.split(/\n\s*\n/).map((b) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${esc(b.trim()).replace(/\n/g, "<br>")}</p>`).join("\n  ");
  const html = mailShell(
    `${paras}
  <p style="margin:8px 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 26px;border-radius:999px">${esc(T.button)} 🎁</a></p>
  ${lines.length ? `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 14px">${lines.map(esc).join("<br>")}</p>` : ""}
  <p style="font-size:14px;color:#444;margin:0">${esc(T.keepSecret)} ${esc(T.linkNote)}</p>`,
    `<p style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;color:#888;font-size:12px;line-height:1.5">${esc(T.privacy(org))} <a href="${esc(erase)}" style="color:#888">${esc(T.eraseLink)}</a> · <a href="${privacyUrl}" style="color:#888">Confidentialité</a></p>`,
  );
  return { subject, text, html };
}

/* Listes de souhaits : effacées 1 mois après la date de l'échange, ou 3 mois
 * après le tirage s'il n'y a pas de date. Renvoie la date limite (Date) ou null. */
export function wishlistEnd(o = {}, drawnAt) {
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(o.date || ""))) return addMonths(`${o.date}T23:59:59`, 1);
  return drawnAt ? addMonths(drawnAt, 3) : null;
}
export const wishlistExpired = (o, drawnAt, now = new Date()) => { const e = wishlistEnd(o, drawnAt); return !!e && e < now; };

export const cleanTemplate = (t, tone) => (longStr(t, LIMITS.template).trim() ? longStr(t, LIMITS.template) : defaultTemplate(tone));
export const cleanWishlist = (t) => longStr(t, LIMITS.wishlist).trim();

/* Liste collée : une personne par ligne, « Prénom Nom e-mail » (séparateurs
 * libres : espaces, virgules, points-virgules, tabulations, <e-mail>).
 * Renvoie { people: [{ prenom, nom, email }], rejected: [lignes] }. */
export function parseList(text) {
  const people = [], rejected = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/);
    if (!m) { rejected.push(line); continue; }
    const email = m[0].toLowerCase();
    const words = line.replace(m[0], " ").replace(/[<>,;"'\t()]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) { rejected.push(line); continue; }
    people.push({ prenom: str(words[0]), nom: str(words.slice(1).join(" ")), email });
  }
  return { people, rejected };
}

/* Remplace toutes les variables du modèle. */
export const fillMessage = (template, o, r) =>
  String(template || DEFAULT_TEMPLATES.tu)
    .replaceAll("{prenom_offreur}", o?.prenom || "").replaceAll("{nom_offreur}", o?.nom || "")
    .replaceAll("{prenom_receveur}", r?.prenom || "").replaceAll("{nom_receveur}", r?.nom || "");

export const SECRET = { prenom: "🤫 (secret)", nom: "" };

/* Identité d'une personne d'un tirage à l'autre : e-mail, sinon prénom + nom. */
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const identityOf = (p) => (p?.email ? `e:${String(p.email).toLowerCase()}` : `n:${fold(`${p?.prenom} ${p?.nom}`)}`);
export const nameIdentity = (p) => `n:${fold(`${p?.prenom} ${p?.nom}`)}`;

/* Interdictions (index offreur → index receveur) : exclusions (réciproques
 * ou non) + paires d'anciens tirages à éviter ([{ giver, receiver }], chacun
 * une liste d'identités : e-mail et/ou nom). */
export function bannedEdges(people, exclusions = [], avoidPairs = []) {
  const byKey = new Map(people.map((p, i) => [String(p.key), i]));
  const byId = new Map();
  people.forEach((p, i) => { byId.set(identityOf(p), i); if (!byId.has(nameIdentity(p))) byId.set(nameIdentity(p), i); });
  const find = (ids) => { for (const id of ids) if (byId.has(id)) return byId.get(id); return undefined; };
  const out = [];
  for (const e of exclusions) {
    const a = byKey.get(String(e.from)), b = byKey.get(String(e.to));
    if (a === undefined || b === undefined) continue;
    out.push([a, b]);
    if (e.both !== false) out.push([b, a]);
  }
  for (const p of avoidPairs) {
    const a = find(p.giver), b = find(p.receiver);
    if (a !== undefined && b !== undefined && a !== b) out.push([a, b]);
  }
  return out;
}

/* Tirage : à chaque offreur un receveur différent de lui-même et hors
 * interdictions. Recherche aléatoire avec retour arrière (trouve une solution
 * dès qu'il en existe une, dans la limite d'essais). Renvoie, pour chaque
 * offreur, l'index de son receveur, ou null. `rand` : pour les tests. */
export function drawPairs(n, banned = [], rand = Math.random) {
  if (n < 2) return null;
  const ban = Array.from({ length: n }, () => new Set());
  for (const [a, b] of banned) if (a >= 0 && a < n && b >= 0 && b < n) ban[a].add(b);
  const shuffled = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const order = shuffled([...Array(n).keys()]).sort((a, b) => ban[b].size - ban[a].size);
  const taken = new Array(n).fill(false);
  const result = new Array(n);
  let steps = 0;
  const place = (k) => {
    if (k === n) return true;
    if (++steps > 200000) return false;
    const g = order[k];
    for (const r of shuffled([...Array(n).keys()])) {
      if (r === g || taken[r] || ban[g].has(r)) continue;
      taken[r] = true; result[g] = r;
      if (place(k + 1)) return true;
      taken[r] = false;
    }
    return false;
  };
  return place(0) ? result : null;
}

/* Contrôles avant tirage : renvoie un message d'erreur ou null. */
export function drawProblem(name, people) {
  if (!String(name || "").trim()) return "Donnez un nom au tirage (étape 1).";
  if (people.length < 2) return "Il faut au moins 2 participants.";
  if (people.length > LIMITS.participants) return `${LIMITS.participants} participants au maximum.`;
  const bad = people.find((p) => !cleanPerson(p));
  if (bad) return `${bad.prenom || "Un participant"} : prénom et e-mail valide requis.`;
  const emails = people.map((p) => p.email.toLowerCase());
  const dup = emails.find((e, i) => emails.indexOf(e) !== i);
  if (dup) return `L'adresse ${dup} apparaît deux fois.`;
  return null;
}

/* « 2026-12-24 » → « jeudi 24 décembre 2026 » (vide si pas de date). */
export const fmtDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? fmtDateFr(v) : "");

/* Textes vus par les participants, selon le ton choisi par l'organisateur. */
export function texts(tone) {
  const tu = tone !== "vous";
  return {
    subject: (event) => `🎁 Ami Invisible : ${event}`,
    hello: (prenom) => `Bonjour ${prenom},`,
    drawn: (event, org) => `Le tirage au sort « ${event} »${org ? ` organisé par ${org}` : ""} a eu lieu !`,
    discover: tu ? "Découvre à qui tu offres un cadeau :" : "Découvrez à qui vous offrez un cadeau :",
    button: "Voir mon résultat",
    keepSecret: tu ? "Garde le secret !" : "Gardez le secret !",
    linkNote: tu ? "Ce lien est personnel : ne le transfère pas." : "Ce lien est personnel : ne le transférez pas.",
    privacy: (org) => tu
      ? `Tes coordonnées ont été saisies par ${org || "l'organisateur"} pour organiser ce tirage. Elles ne servent qu'à t'envoyer ton résultat. Si tu ne souhaites plus recevoir de message d'Ami Invisible, tu peux supprimer tes coordonnées.`
      : `Vos coordonnées ont été saisies par ${org || "l'organisateur"} pour organiser ce tirage. Elles ne servent qu'à vous envoyer votre résultat. Si vous ne souhaitez plus recevoir de message d'Ami Invisible, vous pouvez supprimer vos coordonnées.`,
    eraseLink: "Supprimer mes coordonnées",
    receiverList: (prenom) => `La liste de souhaits de ${prenom}`,
    receiverEmpty: (prenom) => (tu ? `${prenom} n'a pas encore rempli sa liste. Reviens plus tard !` : `${prenom} n'a pas encore rempli sa liste. Revenez plus tard !`),
    myList: tu ? "Ta liste de souhaits" : "Votre liste de souhaits",
    myListHelp: tu
      ? "Quelques idées pour la personne qui va te faire un cadeau : elle seule la verra."
      : "Quelques idées pour la personne qui va vous faire un cadeau : elle seule la verra.",
    wishlistOver: "L'échange est passé : les listes de souhaits ont été effacées.",
    myListSave: "Enregistrer",
    myListSaved: "Enregistrée ✓",
    eraseTitle: "Supprimer mes coordonnées",
    eraseExplain: (org) => tu
      ? `Ton adresse e-mail sera effacée d'Ami Invisible : tu ne recevras plus aucun message. ${org || "L'organisateur"} en sera informé. Ton nom reste dans ce tirage, pour que la personne qui t'offre un cadeau sache toujours à qui elle l'offre.`
      : `Votre adresse e-mail sera effacée d'Ami Invisible : vous ne recevrez plus aucun message. ${org || "L'organisateur"} en sera informé. Votre nom reste dans ce tirage, pour que la personne qui vous offre un cadeau sache toujours à qui elle l'offre.`,
    eraseConfirm: "Confirmer la suppression",
    erased: tu ? "C'est fait : tes coordonnées sont supprimées." : "C'est fait : vos coordonnées sont supprimées.",
    invalid: "Ce lien n'est plus valide. Demandez un nouveau lien à l'organisateur.",
  };
}
