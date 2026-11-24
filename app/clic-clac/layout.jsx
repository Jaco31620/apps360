/* Clic-Clac — photo booth virtuel (albums d'événement). */
import { shareMeta } from "@/lib/appIcons";

export const metadata = {
  // aperçu des liens partagés (WhatsApp, SMS…)
  ...shareMeta("clicclac", "Clic-Clac", "Le photo booth virtuel de votre événement : photos depuis les téléphones, album partagé."),
  title: "Clic-Clac — photo booth virtuel",
  description: "Un photo booth virtuel pour vos événements : les invités prennent des photos avec leur téléphone, tout le monde profite de l'album.",
  icons: { icon: "/icon-clicclac.svg", apple: "/icons/clicclac-180.png" },
  manifest: "/manifest-clicclac.json",
};

export const viewport = { themeColor: "#ff5a5f" };

export default function ClicClacLayout({ children }) {
  return children;
}
