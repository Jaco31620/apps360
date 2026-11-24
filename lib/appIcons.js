/*
 * Icônes des apps hors balises <head> : pages (components/AppIcon.jsx),
 * e-mails et aperçus de liens partagés. Un seul endroit pour les chemins.
 */
const SITE = "https://apps360.fr";
const PNG_ONLY = new Set(["nuage"]); // SVG avec texte : dépend des polices installées

export const appIcon = (app) => (PNG_ONLY.has(app) ? `/icons/${app}-192.png` : `/icon-${app}.svg`);

/* En-tête des e-mails : icône (PNG, le SVG n'est pas affiché par Gmail/Outlook) + nom. */
export function mailHeader(app, name, color, margin = 12) {
  return `<div style="font-size:22px;font-weight:800;color:${color};margin-bottom:${margin}px"><img src="${SITE}/icons/${app}-180.png" width="32" height="32" alt="" style="width:32px;height:32px;border-radius:7px;vertical-align:middle;border:0"> <span style="vertical-align:middle">${name}</span></div>`;
}

/* Aperçu d'un lien partagé (WhatsApp, SMS…) : image public/brand/partage/<app>.png
 * (brand/scripts/app-share.js). Sans `url` : chaque lien garde sa propre adresse. */
export function shareMeta(app, title, description) {
  const images = [{ url: `/brand/partage/${app}.png`, width: 1200, height: 630, alt: title }];
  return {
    openGraph: { type: "website", siteName: "apps360", locale: "fr_FR", title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
