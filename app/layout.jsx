import "./globals.css";
import { Outfit } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";

// police de la charte apps360 : exposée en variable CSS (--font-outfit), utilisée
// seulement là où on la demande (font-outfit) — les apps ne changent pas
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "800"], variable: "--font-outfit", display: "swap" });

const DESCRIPTION = "Des applis utiles, gratuites, sans pub et sans exploitation de vos données.";

export const metadata = {
  metadataBase: new URL("https://apps360.fr"),
  title: "apps360 — Des applis utiles, sans pub",
  description: DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "apps360",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-apps360.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "apps360",
    title: "apps360",
    description: DESCRIPTION,
    url: "https://apps360.fr",
    locale: "fr_FR",
    images: [{ url: "/brand/apps360-partage-1200x630.png", width: 1200, height: 630, alt: "apps360.fr — des applis utiles, sans pub" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/apps360-partage-1200x630.png"] },
};

export const viewport = {
  themeColor: "#14306B",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body className="bg-gray-50 min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
