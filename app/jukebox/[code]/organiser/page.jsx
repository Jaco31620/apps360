import Organiser from "@/components/jukebox/Organiser";
import SuperBanner from "@/components/admin/SuperBanner";

export const metadata = { title: "Organiser — Jukebox", robots: { index: false } };
export const viewport = { themeColor: "#030712", width: "device-width", initialScale: 1 };

export default async function JukeboxOrganiserPage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="jukebox" />
      <Organiser code={code} />
    </>
  );
}
