/* Formulaire de contact : règles communes page / serveur / backoffice (sans accès base). */
import { apps } from "@/lib/apps";

export const KINDS = {
  question: { icon: "💬", label: "J'ai une question", short: "Question", ask: "Votre question", hint: "Que souhaitez-vous savoir ?" },
  souci: { icon: "🛠️", label: "Ça ne marche pas", short: "Souci", ask: "Que s'est-il passé ?", hint: "Que faisiez-vous ? Qu'avez-vous vu à l'écran ?" },
  idee: { icon: "💡", label: "J'ai une idée", short: "Idée", ask: "Votre idée", hint: "Qu'aimeriez-vous pouvoir faire ?" },
  avis: { icon: "❤️", label: "Un mot, un avis", short: "Avis", ask: "Votre message", hint: "Dites-nous tout, les compliments comme les critiques." },
};
export const STATUS = { todo: "À traiter", answered: "Répondu", closed: "Classé" };
export const SITE_APP = "apps360";
export const MESSAGE_MAX = 4000;
export const LATE_DAYS = 3; // message à traiter signalé en orange au-delà

export const appTitle = (k) => (k === SITE_APP ? "apps360" : apps.find((a) => a.icon === k)?.title || k);
export const refOf = (num) => (num ? `A-${num}` : "");
export const isLate = (m, now = Date.now()) => m.status === "todo" && now - new Date(m.created_at).getTime() > LATE_DAYS * 86400e3;
export const emailNeeded = (kind) => kind === "question";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]{2,}$/;
const line = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, n);
export const isEmail = (s) => EMAIL.test(String(s || "").trim());

/* Prénom repris dans l'accusé de réception (envoyé à une adresse non vérifiée) :
 * des lettres seulement, pour que personne n'y glisse un texte ou un lien. */
export const safeName = (s) => (/^[\p{L}\p{M}' -]{1,30}$/u.test(s || "") ? s : "");

/* Message vérifié → { row } prêt pour la base, ou { error, field }. */
export function cleanContact(b) {
  const kind = Object.hasOwn(KINDS, b?.kind) ? b.kind : null;
  if (!kind) return { error: "Choisissez le sujet de votre message.", field: "kind" };
  const app = b.app === SITE_APP || apps.some((a) => a.icon === b.app) ? b.app : null;
  if (!app) return { error: "Choisissez l'app concernée.", field: "app" };
  const message = String(b.message ?? "").replace(/\u0000/g, "").trim();
  if (!message) return { error: "Écrivez votre message.", field: "message" };
  if (message.length > MESSAGE_MAX) return { error: `Votre message est un peu long : ${MESSAGE_MAX} caractères au plus.`, field: "message" };
  const email = line(b.email, 200);
  if (email && !isEmail(email)) return { error: "Vérifiez votre adresse e-mail.", field: "email" };
  if (!email && emailNeeded(kind)) return { error: "Laissez votre e-mail pour que nous puissions vous répondre.", field: "email" };
  if (!UUID.test(b.id || "")) return { error: "Rechargez la page et réessayez." };
  return { row: { id: b.id.toLowerCase(), kind, app, message, email: email || null, name: line(b.name, 40) || null, device: line(b.device, 160) || null } };
}

/* Appareil, en clair (affiché au visiteur avant l'envoi) : aucune adresse, aucun code. */
export function describeDevice(ua, { width, height, installed } = {}) {
  const os = /iPhone|iPod/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Appareil inconnu";
  const b = [["Edge", /Edg\w*\/(\d+)/], ["Samsung Internet", /SamsungBrowser\/(\d+)/], ["Opera", /OPR\/(\d+)/], ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/], ["Chrome", /(?:Chrome|CriOS)\/(\d+)/], ["Safari", /Version\/(\d+).*Safari/]]
    .map(([n, r]) => [n, ua.match(r)]).find(([, m]) => m);
  return [os, b && `${b[0]} ${b[1][1]}`, width && height && `écran ${width}×${height}`, installed && "app installée"].filter(Boolean).join(" · ");
}
