import Poster from "@/components/clicclac/Poster";

export const metadata = { title: "Affiche — Clic-Clac" };

export default async function ClicClacPosterPage({ params }) {
  const { code } = await params;
  return <Poster code={code.toUpperCase()} />;
}
