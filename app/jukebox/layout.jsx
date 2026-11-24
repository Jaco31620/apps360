import { shareMeta } from "@/lib/appIcons";

export const metadata = {
  // aperçu des liens partagés (WhatsApp, SMS…)
  ...shareMeta("jukebox", "Jukebox", "Les invités proposent leurs titres depuis leur téléphone, la musique s'enchaîne."),
  title: "Jukebox — apps360",
  description: "Le jukebox de vos soirées : les invités proposent leurs titres depuis leur téléphone, la régie les joue à la suite.",
  icons: { icon: "/icon-jukebox.svg", apple: "/icons/jukebox-180.png" },
  robots: { index: false, follow: false },
  manifest: "/manifest-jukebox.json",
};

export const viewport = { themeColor: "#030712" };

export default function JukeboxLayout({ children }) {
  return children;
}
