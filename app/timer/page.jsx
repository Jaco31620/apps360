import TimerApp from "@/components/timer/TimerApp";

export const metadata = {
  title: "Timer — apps360",
  description: "Tabata, HIIT, EMOM, pyramide, minuteur, chrono : choisis, règle, GO.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Timer" },
};

export default function TimerPage() {
  return <TimerApp />;
}
