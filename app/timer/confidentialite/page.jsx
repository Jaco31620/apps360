/* Timer — informations de confidentialité. */
import ContactLink from "@/components/ContactLink";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const metadata = { title: "Confidentialité — Timer" };

const H = ({ children }) => <h2 className="text-lg font-extrabold text-gray-900 mt-7 mb-2">{children}</h2>;

export default function TimerPrivacy() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow p-6 sm:p-8 text-gray-700 leading-relaxed">
        <Link href="/timer" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4"><AppIcon app="timer" /> Timer</Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Vos données</h1>
        <p className="mt-2">Ni publicité, ni pistage, ni revente.</p>
        <H>Sans compte</H>
        <p>Vos timers, favoris et réglages restent dans votre navigateur.</p>
        <H>Avec un compte</H>
        <p>Votre adresse e-mail (connexion), vos timers et vos favoris sont enregistrés pour les retrouver sur vos appareils. Vos séances ne sont pas enregistrées. Après 12 mois sans ouvrir Timer, vos timers et favoris sont supprimés.</p>
        <H>Partage</H>
        <p>Un lien partagé contient le nom et les réglages du timer, rien d'autre.</p>
        <H>Contact</H>
        <p>Pour toute question ou pour supprimer vos données : <a className="underline" href="mailto:contact@apps360.fr">contact@apps360.fr</a> ou <ContactLink app="timer">notre formulaire</ContactLink>.</p>
      </div>
    </div>
  );
}
