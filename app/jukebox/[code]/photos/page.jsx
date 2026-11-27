import PhotosBeta from "@/components/jukebox/PhotosBeta";
import SuperBanner from "@/components/admin/SuperBanner";

export const metadata = { title: "Photos sur l'écran (beta) — Jukebox", robots: { index: false } };
export const viewport = { themeColor: "#030712", width: "device-width", initialScale: 1 };

export default async function JukeboxPhotosPage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="jukebox" />
      <PhotosBeta code={code} />
    </>
  );
}
