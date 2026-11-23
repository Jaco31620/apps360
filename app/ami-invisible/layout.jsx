/* Ami Invisible — icône d'onglet commune à toutes ses pages (organisateur,
 * page personnelle des participants, super-admin), au lieu du favicon apps360. */
export const metadata = {
  title: "Ami Invisible — apps360",
  icons: { icon: "/icon-ami-invisible.svg", apple: "/icons/ami-invisible-180.png" },
};

export const viewport = { themeColor: "#ef4444" };

export default function AmiInvisibleLayout({ children }) {
  return children;
}
