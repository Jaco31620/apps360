export const metadata = {
  title: "Nuage de mots — apps360",
  description: "Un nuage de mots en direct : les participants envoient leurs mots depuis leur téléphone, les plus cités grossissent à l'écran.",
  icons: {
    // version agrandie pour l'onglet (lisible à 16 px) + PNG de secours
    icon: [
      { url: "/icon-nuage-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/nuage-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/nuage-180.png",
  },
  manifest: "/manifest-nuage.json",
};

export default function NuageLayout({ children }) {
  return children;
}
