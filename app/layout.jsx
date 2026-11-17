import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata = {
  title: "apps360 — Outils pratiques",
  description: "Des mini-apps utiles, simples et gratuites.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "apps360",
  },
  icons: {
    icon: "/icon-apps360.svg",
    shortcut: "/icon-apps360.svg",
    apple: "/icon-apps360.svg",
  },
};

export const viewport = {
  themeColor: "#ef4444",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
