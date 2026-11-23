/*
 * Apps publiques d'apps360, dans l'ordre de la page d'accueil (app/page.jsx).
 * Partagée avec le backoffice (/admin, lib/backoffice.js) : un seul endroit
 * pour le nom, l'emoji et la description de chaque app.
 */
// Les apps gardent leurs propres couleurs ; le reste de la page suit la charte apps360 (brand/README.md).
export const apps = [
  {
    href: "/ami-invisible",
    emoji: "🎁",
    title: "Ami Invisible",
    desc: "Organisez votre tirage au sort en toute confidentialité. Exclusions, notifications, historique.",
    gradient: "from-red-500 to-orange-500",
    badge: "Gratuit",
  },
  {
    href: "/respiration",
    emoji: "🫁",
    title: "Respiration",
    desc: "Guidez votre souffle avec un timer visuel et sonore. Cohérence cardiaque, 4-7-8, programmes perso.",
    gradient: "from-indigo-500 to-purple-500",
    badge: "Gratuit",
  },
  {
    href: "/nuage",
    emoji: "☁️",
    title: "Nuage de mots",
    desc: "Posez une question, le public répond depuis son téléphone : les mots les plus cités grossissent en direct.",
    gradient: "from-cyan-500 to-violet-500",
    badge: "Gratuit",
  },
  {
    href: "/clic-clac",
    emoji: "📸",
    title: "Clic-Clac",
    desc: "Le photo booth virtuel de vos événements : photos depuis les téléphones, borne, album partagé et diaporama en direct.",
    gradient: "from-rose-500 to-amber-400",
    badge: "Sur demande",
  },
  {
    href: "/jukebox",
    emoji: "🎶",
    title: "Jukebox",
    desc: "Les invités proposent leurs titres depuis leur téléphone, la musique s'enchaîne sur la télé ou l'ordinateur. Blind test inclus.",
    gradient: "from-fuchsia-600 to-indigo-600",
    badge: "Sur demande",
  },
  // Ajoutez vos prochaines apps ici
];
