export const metadata = {
  title: "apps360 sur la télé",
  description: "Afficher l'écran d'une soirée Jukebox ou d'un album Clic-Clac sur une télé connectée.",
  icons: { icon: "/icon-jukebox.svg", apple: "/icon-jukebox.svg" },
  robots: { index: false, follow: false },
};

export default function TvLayout({ children }) {
  return children;
}
