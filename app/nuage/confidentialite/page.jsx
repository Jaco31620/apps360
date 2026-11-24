/* Nuage de mots — informations de confidentialité. */
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const metadata = { title: "Confidentialité — Nuage de mots" };

const H = ({ children }) => <h2 className="text-lg font-extrabold text-gray-900 mt-7 mb-2">{children}</h2>;

export default function NuagePrivacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-violet-50 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow p-6 sm:p-8 text-gray-700 leading-relaxed">
        <Link href="/nuage" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4"><AppIcon app="nuage" /> Nuage de mots</Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Vos données</h1>
        <p className="mt-2">Ni publicité, ni pistage, ni revente.</p>
        <H>Participants</H>
        <p>Pas de compte ni de nom. Vos mots sont enregistrés avec un identifiant au hasard, gardé par votre navigateur, qui sert à compter vos envois.</p>
        <H>Présentateurs</H>
        <p>Le compte est facultatif. Avec un compte, votre adresse e-mail sert à vous connecter, à retrouver vos nuages et à vous prévenir avant leur suppression. L'administrateur d'apps360 peut voir les nuages, l'adresse du compte rattaché et une note de gestion, pour vous aider à retrouver un accès perdu.</p>
        <H>E-mails</H>
        <p>Les adresses auxquelles un nuage est envoyé ne sont pas enregistrées dans l'app. L'envoi passe par notre prestataire d'e-mails.</p>
        <H>Limites d'usage</H>
        <p>L'adresse IP et, pour les envois par e-mail, l'identifiant du compte servent à limiter les abus. Ces compteurs sont effacés automatiquement après leur période d'usage.</p>
        <H>Durée</H>
        <p>Un nuage sans modification depuis 6 mois est supprimé avec ses mots et son image, sauf s'il a été conservé à la demande de son organisateur. Le présentateur peut le supprimer à tout moment.</p>
        <H>Contact</H>
        <p>Pour toute question ou pour supprimer vos données : <a className="underline" href="mailto:contact@apps360.fr">contact@apps360.fr</a>.</p>
      </div>
    </div>
  );
}
