/*
 * Apps publiques d'apps360, dans l'ordre de la page d'accueil (app/page.jsx).
 * Partagée avec le backoffice (/admin, lib/backoffice.js) : un seul endroit
 * pour le nom, l'icône et la description de chaque app.
 */
// Les apps gardent leurs propres couleurs ; le reste de la page suit la charte apps360 (brand/README.md).
export const apps = [
  {
    href: "/ami-invisible",
    icon: "ami-invisible", // components/AppIcon.jsx
    title: "Ami Invisible",
    desc: "Organisez votre tirage au sort en toute confidentialité. Exclusions, notifications, historique.",
    badge: "Gratuit",
  },
  {
    href: "/respiration",
    icon: "respiration", // components/AppIcon.jsx
    title: "Respiration",
    desc: "Guidez votre souffle avec un timer visuel et sonore. Cohérence cardiaque, 4-7-8, programmes perso.",
    badge: "Gratuit",
  },
  {
    href: "/nuage",
    icon: "nuage", // components/AppIcon.jsx
    title: "Nuage de mots",
    desc: "Posez une question, le public répond depuis son téléphone : les mots les plus cités grossissent en direct.",
    badge: "Gratuit",
  },
  {
    href: "/clic-clac",
    icon: "clicclac", // components/AppIcon.jsx
    title: "Clic-Clac",
    desc: "Le photo booth virtuel de vos événements : photos depuis les téléphones, borne, album partagé et diaporama en direct.",
    badge: "Sur demande",
  },
  {
    href: "/jukebox",
    icon: "jukebox", // components/AppIcon.jsx
    title: "Jukebox",
    desc: "Les invités proposent leurs titres depuis leur téléphone, la musique s'enchaîne sur la télé ou l'ordinateur. Blind test inclus.",
    badge: "Sur demande",
  },
  // Ajoutez vos prochaines apps ici
];
