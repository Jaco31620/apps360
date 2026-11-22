import ToOrganiser from "@/components/jukebox/ToOrganiser";

export const metadata = { title: "Organiser — Jukebox", robots: { index: false } };

/* ancienne adresse : renvoie vers /jukebox/<code>/organiser (liens déjà envoyés) */
export default async function OldOrganiserPage({ params }) {
  const { code } = await params;
  return <ToOrganiser code={code} />;
}
