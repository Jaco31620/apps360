import BrandShell from "@/components/BrandShell";
import ContactForm from "@/components/ContactForm";
import { homeApps } from "@/lib/homeServer";

export const metadata = {
  title: "Nous écrire — apps360",
  description: "Une question, une idée, un souci avec une app apps360 ? Écrivez-nous, une vraie personne vous lit.",
};

// gardée en cache, comme l'accueil
export const revalidate = 3600;

export default async function ContactPage() {
  const list = (await homeApps()).map(({ href, icon, title, state, access }) => ({ href, icon, title, state, access }));
  return <BrandShell><ContactForm apps={list} /></BrandShell>;
}
