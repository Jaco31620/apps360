export const metadata = {
  title: "Jukebox — apps360",
  description: "Le jukebox de vos soirées : les invités proposent leurs titres depuis leur téléphone, la régie les joue à la suite.",
  icons: { icon: "/icon-jukebox.svg", apple: "/icons/jukebox-180.png" },
  robots: { index: false, follow: false },
  manifest: "/manifest-jukebox.json",
};

export default function JukeboxLayout({ children }) {
  return children;
}
