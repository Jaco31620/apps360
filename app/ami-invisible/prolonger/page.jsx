import Keep from "@/components/amiInvisible/Keep";

export const metadata = { title: "Conserver mes tirages — Ami Invisible", robots: { index: false } };

export default async function KeepPage({ searchParams }) {
  const sp = await searchParams;
  return <Keep token={typeof sp?.t === "string" ? sp.t : ""} />;
}
