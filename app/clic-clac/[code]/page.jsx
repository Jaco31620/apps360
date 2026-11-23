import GuestApp from "@/components/clicclac/GuestApp";
import SuperBanner from "@/components/admin/SuperBanner";

export default async function ClicClacAlbumPage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="clicclac" />
      <GuestApp code={code.toUpperCase()} />
    </>
  );
}
