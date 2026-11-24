import Keep from "@/components/nuage/Keep";

export const metadata = { title: "Conserver mon nuage — Nuage de mots", robots: { index: false } };

export default async function KeepPage({ searchParams }) {
  const sp = await searchParams;
  return <Keep token={typeof sp?.t === "string" ? sp.t : ""} />;
}
