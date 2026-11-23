import AdminApp from "@/components/clicclac/AdminApp";
import SuperBanner from "@/components/admin/SuperBanner";

export const metadata = { title: "Organisateur — Clic-Clac" };

export default async function ClicClacAdminPage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="clicclac" />
      <AdminApp code={code.toUpperCase()} />
    </>
  );
}
