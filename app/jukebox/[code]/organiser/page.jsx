import Organiser from "@/components/jukebox/Organiser";

export const metadata = { title: "Organiser — Jukebox", robots: { index: false } };
export const viewport = { themeColor: "#030712", width: "device-width", initialScale: 1 };

export default async function JukeboxOrganiserPage({ params }) {
  const { code } = await params;
  return <Organiser code={code} />;
}
