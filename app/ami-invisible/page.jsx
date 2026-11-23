import Organizer from "@/components/amiInvisible/Organizer";
import SuperBanner from "@/components/admin/SuperBanner";

export const metadata = {
  title: "Ami Invisible — apps360",
  description: "Organisez votre tirage Ami Invisible en toute confidentialité.",
  manifest: "/manifest-ami-invisible.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ami Invisible",
  },
};

export default function AmiInvisiblePage() {
  return (
    <>
      <SuperBanner app="ami" />
      <Organizer />
    </>
  );
}
