/* Respiration — icône d'onglet et d'écran d'accueil propres à l'app, au lieu
 * de celles d'apps360 (règle commune : SVG pour l'onglet, PNG 180 pour l'iPhone). */
export const metadata = {
  icons: { icon: "/icon-respiration.svg", apple: "/icons/respiration-180.png" },
};

export default function RespirationLayout({ children }) {
  return children;
}
