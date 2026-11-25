/* Backoffice apps360 (/admin) : page privée, non indexée. */
export const metadata = {
  title: "Backoffice — apps360",
  robots: { index: false, follow: false },
  // installable à part (Android : « Installer l'appli ») ; icône apps360 + bouclier
  manifest: "/manifest-admin.json",
  icons: { icon: "/icon-admin-favicon.svg", apple: "/icons/admin-180.png?v=2" },
  appleWebApp: { capable: true, title: "Backoffice" },
};

export default function AdminLayout({ children }) {
  return children;
}
