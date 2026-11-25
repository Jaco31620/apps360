/*
 * Icônes des apps hors balises <head> : pages (components/AppIcon.jsx) et
 * aperçus de liens partagés (e-mails : lib/mail.js). Un seul endroit pour les chemins.
 */
const SITE = "https://apps360.fr";
const PNG_ONLY = new Set(["nuage"]); // SVG avec texte : dépend des polices installées

export const appIcon = (app) => (PNG_ONLY.has(app) ? `/icons/${app}-192.png` : `/icon-${app}.svg`);

/* Aperçu d'un lien partagé (WhatsApp, SMS…) : image public/brand/partage/<app>.png
 * (brand/scripts/app-share.js). Sans `url` : chaque lien garde sa propre adresse. */
export function shareMeta(app, title, description) {
  const images = [{ url: `/brand/partage/${app}.png`, width: 1200, height: 630, alt: title }];
  return {
    openGraph: { type: "website", siteName: "apps360", locale: "fr_FR", title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
