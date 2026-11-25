/*
 * Apps d'apps360. État (public / test ; absent = test), accès, accroche et ordre : valeurs
 * de départ, remplacées par le réglage du backoffice (« Page d'accueil », lib/homeConfig.js).
 * Partagée avec le backoffice (/admin, lib/backoffice.js) : un seul endroit
 * pour le nom, l'icône et la description de chaque app.
 */
// Les apps gardent leurs propres couleurs ; le reste de la page suit la charte apps360 (brand/README.md).
export const apps = [
  {
    href: "/ami-invisible",
    state: "public",
    icon: "ami-invisible", // components/AppIcon.jsx
    tag: { text: "🎄 Idéal pour Noël", color: "green", from: "", to: "2026-12-25" },
    title: "Ami Invisible",
    desc: "Organisez votre tirage au sort en toute confidentialité. Exclusions, notifications, historique.",
    access: "free",
  },
  {
    href: "/respiration",
    state: "public",
    icon: "respiration", // components/AppIcon.jsx
    title: "Respiration",
    desc: "Guidez votre souffle avec un timer visuel et sonore. Cohérence cardiaque, 4-7-8, programmes perso.",
    access: "free",
  },
  {
    href: "/timer",
    state: "test",
    icon: "timer", // components/AppIcon.jsx
    title: "Timer",
    desc: "Tabata, HIIT, EMOM, pyramide, minuteur, chrono : des programmes prêts à lancer, ou le vôtre en quelques appuis.",
    access: "free",
  },
  {
    href: "/nuage",
    state: "public",
    icon: "nuage", // components/AppIcon.jsx
    title: "Nuage de mots",
    desc: "Posez une question, le public répond depuis son téléphone : les mots les plus cités grossissent en direct.",
    access: "free",
  },
  {
    href: "/clic-clac",
    state: "public",
    icon: "clicclac", // components/AppIcon.jsx
    title: "Clic-Clac",
    desc: "Le photo booth virtuel de vos événements : photos depuis les téléphones, borne, album partagé et diaporama en direct.",
    access: "request",
  },
  {
    href: "/jukebox",
    state: "public",
    icon: "jukebox", // components/AppIcon.jsx
    title: "Jukebox",
    desc: "Les invités proposent leurs titres depuis leur téléphone, la musique s'enchaîne sur la télé ou l'ordinateur. Blind test inclus.",
    access: "request",
  },
  // Ajoutez vos prochaines apps ici
];
