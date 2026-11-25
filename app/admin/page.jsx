import Backoffice from "@/components/admin/Backoffice";
import { homeApps } from "@/lib/homeServer";

// page gardée en cache (comme l'accueil) : aucune lecture en base à l'ouverture
export const revalidate = 3600;

export default async function AdminPage() {
  return <Backoffice home={(await homeApps()).map(({ href, state, access, tag }) => ({ href, state, access, tag }))} />;
}
