/* Ami Invisible — icône d'onglet commune à toutes ses pages (organisateur,
 * page personnelle des participants, super-admin), au lieu du favicon apps360. */
export const metadata = {
  title: "Ami Invisible — apps360",
  icons: {
    // version agrandie pour l'onglet (cadeau lisible à 16 px) + PNG de secours
    icon: [
      { url: "/icon-ami-invisible-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/ami-invisible-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/ami-invisible-180.png",
  },
  manifest: "/manifest-ami-invisible.json",
};

export const viewport = { themeColor: "#ef4444" };

export default function AmiInvisibleLayout({ children }) {
  return children;
}
