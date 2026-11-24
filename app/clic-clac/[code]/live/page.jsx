import Live from "@/components/clicclac/Live";

export const metadata = { title: "Écran d'affichage — Clic-Clac" };

export default async function ClicClacLivePage({ params }) {
  const { code } = await params;
  return <Live code={code.toUpperCase()} />;
}
