/* Timer — icônes d'onglet et d'écran d'accueil propres à l'app (SVG + PNG 180 iPhone). */
import { shareMeta } from "@/lib/appIcons";

import { testRobots } from "@/lib/homeServer";

const base = {
  ...shareMeta("timer", "Timer", "Tabata, HIIT, EMOM, minuteur, chrono : choisis, règle, GO."),
  icons: { icon: "/icon-timer.svg?v=3", apple: "/icons/timer-180.png?v=3" },
  manifest: "/manifest-timer.json",
};

// app en test (backoffice, « Page d'accueil ») : non indexée par Google
export const revalidate = 3600;
export async function generateMetadata() {
  return { ...base, ...(await testRobots("/timer")) };
}

export const viewport = { themeColor: "#14306b", viewportFit: "cover" };

export default function TimerLayout({ children }) {
  return children;
}
