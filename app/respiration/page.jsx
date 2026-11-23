import Respiration from "@/components/Respiration";

export const metadata = {
  title: "Respiration — apps360",
  description: "Guidez votre souffle avec un timer de respiration visuel et sonore.",
  manifest: "/manifest-respiration.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Respiration",
  },
};

export default function RespirationPage() {
  return <Respiration />;
}
