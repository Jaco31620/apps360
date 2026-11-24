import SuperBanner from "@/components/admin/SuperBanner";
import Participant from "@/components/nuage/Participant";

export default async function NuageParticipantPage({ params }) {
  const { code } = await params;
  return (
    <>
      <SuperBanner app="nuage" />
      <Participant code={code} />
    </>
  );
}
