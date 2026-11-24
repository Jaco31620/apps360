/* Respiration — icône d'onglet et d'écran d'accueil propres à l'app, au lieu
 * de celles d'apps360 (règle commune : SVG pour l'onglet, PNG 180 pour l'iPhone). */
import { shareMeta } from "@/lib/appIcons";

export const metadata = {
  // aperçu des liens partagés (WhatsApp, SMS…)
  ...shareMeta("respiration", "Respiration", "Guidez votre souffle avec un timer visuel et sonore."),
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

export const viewport = { themeColor: "#818cf8" };

export default function RespirationLayout({ children }) {
  return children;
}
