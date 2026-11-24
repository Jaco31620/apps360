/* Timer — icônes d'onglet et d'écran d'accueil propres à l'app (SVG + PNG 180 iPhone). */
import { shareMeta } from "@/lib/appIcons";

export const metadata = {
  ...shareMeta("timer", "Timer", "Tabata, HIIT, EMOM, minuteur, chrono : choisis, règle, GO."),
  icons: { icon: "/icon-timer.svg", apple: "/icons/timer-180.png" },
  manifest: "/manifest-timer.json",
};

export const viewport = { themeColor: "#14306b", viewportFit: "cover" };

export default function TimerLayout({ children }) {
  return children;
}
