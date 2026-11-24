/* Respiration — icône d'onglet et d'écran d'accueil propres à l'app, au lieu
 * de celles d'apps360 (règle commune : SVG pour l'onglet, PNG 180 pour l'iPhone). */
export const metadata = {
  icons: {
    // version agrandie pour l'onglet (lisible à 16 px) + PNG de secours
    icon: [
      { url: "/icon-respiration-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/respiration-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/respiration-180.png",
  },
  manifest: "/manifest-respiration.json",
};

export default function RespirationLayout({ children }) {
  return children;
}
