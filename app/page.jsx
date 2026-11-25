import Home from "@/components/Home";
import { homeApps } from "@/lib/homeServer";

// page gardée en cache : régénérée chaque heure au plus, et à l'enregistrement dans le backoffice
export const revalidate = 3600;

export default async function HomePage() {
  return <Home apps={await homeApps()} />;
}
