import { shareMeta } from "@/lib/appIcons";

export const metadata = {
  // aperçu des liens partagés (WhatsApp, SMS…)
  ...shareMeta("nuage", "Nuage de mots", "Répondez depuis votre téléphone : les mots les plus cités grossissent en direct."),
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

export const viewport = { themeColor: "#06b6d4" };

export default function NuageLayout({ children }) {
  return children;
}
