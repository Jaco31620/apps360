import Remote from "@/components/clicclac/Remote";

export const metadata = { title: "Télécommande — Clic-Clac" };

export default async function ClicClacRemotePage({ params }) {
  const { code } = await params;
  return <Remote code={code.toUpperCase()} />;
}
