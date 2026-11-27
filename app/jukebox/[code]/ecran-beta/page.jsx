import EcranBeta from "@/components/jukebox/EcranBeta";

export const metadata = { title: "Écran d'affichage (beta photos) — Jukebox", robots: { index: false } };

/* BETA écran commun Jukebox + Clic-Clac ; mêmes paramètres que /ecran (?son=1, &claim=1). */
export default async function JukeboxEcranBetaPage({ params, searchParams }) {
  const { code } = await params;
  const { son, claim } = await searchParams;
  return <EcranBeta code={code} sound={son === "1"} claim={claim === "1"} />;
}
