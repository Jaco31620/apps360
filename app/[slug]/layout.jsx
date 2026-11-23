/*
 * Layout des pages d'instance (/<slug> et /<slug>/admin) : marque BLACKROLL
 * (favicon, titre, nom écran d'accueil) au lieu de apps360, et pas de PWA.
 */
export const metadata = {
  title: "BLACKROLL Codes",
  icons: { icon: "/icon-blackroll.svg", shortcut: "/icon-blackroll.svg", apple: "/icons/blackroll-180.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BLACKROLL" },
  manifest: null,
};

export const viewport = { themeColor: "#0A0A0A" };

export default function CodesInstanceLayout({ children }) {
  return children;
}
