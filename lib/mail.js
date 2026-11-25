/*
 * Modèle commun des e-mails d'apps360 (PUR : aussi utilisé par les aperçus).
 * Compatible Outlook (moteur Word), qui ignore white-space, max-width,
 * border-radius et le padding des liens : <p>, <br> et tableaux seulement.
 *   mailPage("jukebox", title("…") + para(texte brut) + button(url, "Ouvrir", "jukebox"))
 * para, title, button et quote échappent leur texte ; rich et small attendent du HTML déjà échappé.
 */
const SITE = "https://apps360.fr";
export const MAIL_APPS = {
  apps360: { name: "apps360", color: "#14306b", icon: "/brand/apps360-icone-192.png" },
  jukebox: { name: "Jukebox", color: "#c026d3" },
  clicclac: { name: "Clic-Clac", color: "#ff5a5f" },
  "ami-invisible": { name: "Ami Invisible", color: "#dc2626" },
  nuage: { name: "Nuage de mots", color: "#0284c7" },
};
const FONT = "font-family:Arial,Helvetica,sans-serif";
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Texte brut → HTML : échappé, adresses web cliquables (« . » ou « ) » final exclu), retours à la ligne. */
export const lines = (s) => String(s ?? "").replace(/\r\n?/g, "\n").trim()
  .split(/(https?:\/\/[^\s<>"«»]*[^\s<>"«».,;:!?)])/)
  .map((p, i) => (i % 2 ? `<a href="${esc(p)}" style="color:#14306b">${esc(p)}</a>` : esc(p))).join("").replace(/\n/g, "<br>");

/* Paragraphe en HTML. */
export const rich = (html, color = "#1f1f1f") => `<p style="margin:0 0 16px;${FONT};font-size:16px;line-height:24px;color:${color}">${html}</p>`;
/* Texte brut : un paragraphe par bloc séparé d'une ligne vide. */
export const para = (s, color) => String(s ?? "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean).map((p) => rich(lines(p), color)).join("");
export const small = (html, color = "#777777") => `<p style="margin:0 0 12px;${FONT};font-size:13px;line-height:19px;color:${color}">${html}</p>`;
export const title = (s) => `<p style="margin:0 0 16px;${FONT};font-size:20px;line-height:27px;font-weight:bold;color:#1f1f1f">${esc(s)}</p>`;

/* Message cité : filet de couleur à gauche. */
export const quote = (s, color = "#F47A20") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td width="3" bgcolor="${color}" style="width:3px;font-size:1px;line-height:1px">&nbsp;</td><td style="padding:2px 0 0 14px">${para(s, "#555555")}</td></tr></table>`;

export const button = (url, label, app = "apps360") => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="${MAIL_APPS[app].color}" style="padding:12px 22px;border-radius:24px"><a href="${esc(url)}" style="${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;

/* Tableau « libellé / valeur » ([[libellé, valeur en texte brut]]). */
export const table = (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">${rows.map(([k, v]) => `<tr><td valign="top" style="padding:4px 14px 4px 0;${FONT};font-size:15px;line-height:21px;color:#777777">${esc(k)}</td><td valign="top" style="padding:4px 0;${FONT};font-size:15px;line-height:21px;font-weight:bold;color:#1f1f1f">${lines(v)}</td></tr>`).join("")}</table>`;

/* Page complète : icône et nom de l'app, contenu, signature. width : largeur maximale. */
export function mailPage(app, inner, { footer = "", width = 600 } = {}) {
  const a = MAIL_APPS[app];
  const sign = app === "apps360" ? "apps360 · Des applis utiles, gratuites et sans publicité" : esc(a.name);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="left" style="padding:20px 16px">
<!--[if mso]><table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px">
<tr><td style="padding:0 0 22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px"><img src="${SITE}${a.icon || `/icons/mail/${app}.png`}" width="40" height="40" alt="" style="display:block;border:0"></td>
<td valign="middle" style="${FONT};font-size:22px;line-height:28px;font-weight:bold;color:${a.color}">${esc(a.name)}</td></tr></table></td></tr>
<tr><td>${inner}</td></tr>
<tr><td style="padding-top:14px;border-top:1px solid #dddddd">${footer}${small(`${sign} · <a href="${SITE}" style="color:#777777">apps360.fr</a>`)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

/* Un e-mail par destinataire (personne ne voit les adresses des autres), l'un après
 * l'autre ; une adresse en échec n'arrête pas les suivantes. { sent, failed: [adresses], error } */
export async function sendEach(to, send) {
  const failed = [];
  let error = null;
  for (const addr of to) {
    try { await send(addr); } catch (e) { failed.push(addr); error = e?.message || "Échec de l'envoi."; console.error("mail individuel:", error); }
  }
  return { sent: to.length - failed.length, failed, error };
}
/* Bilan affiché à l'expéditeur. */
export const sentText = ({ sent, failed = [] }) => `✓ Envoyé à ${sent} destinataire${sent > 1 ? "s" : ""}.${failed.length ? ` Non envoyé : ${failed.join(", ")}` : ""}`;
