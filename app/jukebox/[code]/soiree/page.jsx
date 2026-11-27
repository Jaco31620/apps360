import SoireeHub from "@/components/jukebox/SoireeHub";

export const metadata = { title: "Soirée — Jukebox et photos", robots: { index: false } };
export const viewport = { themeColor: "#030712", width: "device-width", initialScale: 1 };

/* BETA : page d'accueil du QR unique de l'écran commun (titres ou photos). */
export default async function JukeboxSoireePage({ params }) {
  const { code } = await params;
  return <SoireeHub code={code} />;
}
