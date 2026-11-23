import Participant from "@/components/amiInvisible/Participant";

export const metadata = { title: "Ami Invisible — apps360", robots: { index: false, follow: false } };

export default async function ParticipantPage({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  return <Participant token={decodeURIComponent(token)} erase={sp?.supprimer === "1"} />;
}
