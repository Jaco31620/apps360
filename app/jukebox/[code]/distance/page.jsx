import EcranBeta from "@/components/jukebox/EcranBeta";

export const metadata = { title: "Soirée à distance — Jukebox", robots: { index: false } };

/* BETA : la soirée en direct pour ceux qui n'ont pas pu venir (musique synchronisée, photos, liens). */
export default async function JukeboxDistancePage({ params }) {
  const { code } = await params;
  return <EcranBeta code={code} remote />;
}
