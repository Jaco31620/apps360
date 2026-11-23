import Remote from "@/components/clicclac/Remote";
import SuperBanner from "@/components/admin/SuperBanner";

export const metadata = { title: "Télécommande — Clic-Clac" };

export default async function ClicClacRemotePage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="clicclac" />
      <Remote code={code.toUpperCase()} />
    </>
  );
}
