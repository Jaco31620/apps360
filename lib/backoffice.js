/*
 * Backoffice apps360 (/admin) — contenu de la page, sans aucune lecture en base.
 * Pour ajouter une app, un lien ou un message : une entrée ici suffit.
 *
 * Messages : même style que ceux des apps (lib/jukeboxMessages.js) — une ligne
 * d'accroche avec l'emoji de l'app, puis 👉 le lien, ❓ le mode d'emploi s'il
 * existe. Si une formulation change ici ou dans une app, garder les deux alignées.
 */
import { apps } from "@/lib/apps";
import { PAYPAL_DONATE } from "@/lib/soutien";

export const hostOf = (origin) => String(origin || "").replace(/^https?:\/\//, "");

/* Compléments par app publique (clé = href de lib/apps.js). */
const extras = {
  "/jukebox": {
    superAdmin: "/jukebox/admin",
    note: "Création des soirées : libre, sur code d'activation ou par le super-admin seul (réglage du super-admin). Les codes d'activation se créent dans le super-admin, onglet Codes.",
    links: (o) => [
      { label: "Créer une soirée", url: `${o}/jukebox` },
      { label: "Mode d'emploi", url: `${o}/jukebox/aide` },
      { label: "Télé", url: `${o}/tv` },
    ],
    message: (o) => [
      "🎶 Jukebox : vos invités choisissent la musique depuis leur téléphone, elle s'enchaîne sur la télé ou l'ordinateur. Blind test inclus !",
      "",
      `👉 Créez votre soirée : ${o}/jukebox`,
      `📺 Musique sur la télé : ouvrez ${hostOf(o)}/tv dans son navigateur`,
      `❓ Mode d'emploi : ${o}/jukebox/aide`,
    ].join("\n"),
  },
  "/clic-clac": {
    superAdmin: "/clic-clac/super",
    note: "Les albums sont créés par le super-admin ; la page de l'app permet d'en faire la demande.",
    links: (o) => [
      { label: "Page de l'app (demande d'album)", url: `${o}/clic-clac` },
      { label: "Télé", url: `${o}/tv` },
    ],
    message: (o) => [
      "📸 Clic-Clac : le photo booth virtuel de votre événement. Les invités prennent les photos avec leur téléphone, l'album est partagé et le diaporama défile en direct.",
      "",
      `👉 Demandez votre album : ${o}/clic-clac`,
    ].join("\n"),
  },
  "/nuage": {
    links: (o) => [{ label: "Créer un nuage", url: `${o}/nuage` }],
    message: (o) => [
      "☁️ Nuage de mots : posez une question, le public répond depuis son téléphone et les mots les plus cités grossissent en direct.",
      "",
      `👉 Créez votre nuage : ${o}/nuage`,
    ].join("\n"),
  },
  "/ami-invisible": {
    superAdmin: "/ami-invisible/super",
    note: "Super-admin : tous les tirages (brouillons, envois, ouvertures, activité des organisateurs), renvoi ou copie du lien personnel, correction d'un participant, suppression. Les paires restent masquées (affichage tracé au journal).",
    links: (o) => [
      { label: "Organiser un tirage", url: `${o}/ami-invisible` },
      { label: "Mode d'emploi", url: `${o}/ami-invisible/aide` },
    ],
    message: (o) => [
      "🎁 Ami Invisible : organisez votre tirage au sort en toute confidentialité. Chacun reçoit son lien personnel pour découvrir à qui il offre ; exclusions, liste de souhaits, et on repart du tirage de l'an dernier.",
      "",
      `👉 Organisez votre tirage : ${o}/ami-invisible`,
      `❓ Mode d'emploi : ${o}/ami-invisible/aide`,
    ].join("\n"),
  },
  "/respiration": {
    links: (o) => [{ label: "Ouvrir l'app", url: `${o}/respiration` }],
    message: (o) => [
      "🫁 Respiration : guidez votre souffle avec un timer visuel et sonore (cohérence cardiaque, 4-7-8, programmes perso).",
      "",
      `👉 ${o}/respiration`,
    ].join("\n"),
  },
};

export const backofficeApps = apps.map((a) => ({ ...a, ...(extras[a.href] || {}) }));

/* Le site lui-même. */
export const siteCard = {
  icon: "apps360",
  title: "Site apps360",
  links: (o) => [
    { label: "Page d'accueil", url: `${o}/` },
    { label: "Soutenir", url: `${o}/soutenir` },
    { label: "Don PayPal (lien direct)", url: PAYPAL_DONATE },
  ],
  message: (o) => [
    "apps360 : des applis utiles. Sans pub. Sans exploiter vos données. Juste là pour faire le job.",
    "",
    `👉 ${o}`,
  ].join("\n"),
};

/* Développements hors cadre : absents de la page d'accueil publique. */
export const horsCadre = [
  {
    emoji: "🎤",
    title: "Laure50",
    desc: "Karaoké synchronisé de l'anniversaire de Laure.",
    links: (o) => [
      { label: "Téléphones", url: `${o}/laure50` },
      { label: "Régie (clé demandée)", url: `${o}/laure50/ecran` },
      { label: "QR d'accueil", url: `${o}/laure50/qr` },
    ],
  },
  {
    emoji: "🏀",
    title: "FFBB × BLACKROLL",
    desc: "Codes licenciés, domaine blackroll-codes.com. Projet en pause.",
    links: (o) => [
      { label: "Super-admin du dispositif", url: `${o}/ffbb-test/super` },
      { label: "blackroll-codes.com", url: "https://blackroll-codes.com" },
    ],
  },
];

/* Ressources (outils externes). `supabaseRef` : déduit de l'adresse Supabase publique. */
export function resources(supabaseRef) {
  const supa = supabaseRef ? `https://supabase.com/dashboard/project/${supabaseRef}` : "https://supabase.com/dashboard";
  return [
    { group: "Quotas à surveiller", items: [
      { label: "Vercel · Fluid Active CPU (4 h / 30 jours)", url: "https://vercel.com/jacos-projects-9ddf9fa6/~/usage#vercel-functions-fluid-cpu-duration" },
      { label: "Supabase · Usage (egress)", url: "https://supabase.com/dashboard/org/gwzeqhkrorumgybtfwvi/usage#egress" },
      { label: "Cloudflare R2 (photos Clic-Clac)", url: "https://dash.cloudflare.com/?to=/:account/r2/overview" },
      { label: "YouTube · quota de recherche", url: "https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas" },
    ] },
    { group: "Outils", items: [
      { label: "Vercel · projet apps360", url: "https://vercel.com/jacos-projects-9ddf9fa6/apps360" },
      { label: "Supabase · éditeur SQL", url: `${supa}/sql/new` },
      { label: "Resend · e-mails envoyés", url: "https://resend.com/emails" },
      { label: "GitHub · dépôt apps360", url: "https://github.com/Jaco31620/apps360" },
    ] },
    { group: "Contact et marque", items: [
      { label: "contact@apps360.fr", url: "mailto:contact@apps360.fr" },
      { label: "Logo (fichiers du site)", url: "/brand/apps360-logo.svg" },
    ], note: "Kit de marque complet et charte PDF : OneDrive › Documents › _Apps360." },
  ];
}
