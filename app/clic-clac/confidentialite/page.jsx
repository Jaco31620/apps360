/* Clic-Clac — informations de confidentialité pour les invités et organisateurs. */
import Link from "next/link";

export const metadata = { title: "Confidentialité — Clic-Clac" };

const H = ({ children }) => <h2 className="text-lg font-black text-gray-900 mt-7 mb-2">{children}</h2>;

export default function ClicClacPrivacy() {
  return (
    <div className="min-h-screen bg-[#fff8f3] px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 text-gray-700 leading-relaxed">
        <Link href="/clic-clac" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4">
          <img src="/icon-clicclac.svg" alt="" className="w-6 h-6 rounded-md" /> Clic-Clac
        </Link>
        <h1 className="text-3xl font-black text-gray-900">Vos photos et vos données</h1>
        <p className="mt-2">Clic-Clac est un album photo partagé le temps d'un événement. Il est conçu pour collecter le minimum, ne rien exploiter et tout effacer à la fin.</p>

        <H>Ce qui est enregistré</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Les photos que vous envoyez, et leur légende éventuelle.</li>
          <li>Le prénom que vous indiquez, affiché avec vos photos.</li>
          <li>Un identifiant aléatoire gardé dans votre navigateur, qui sert seulement à reconnaître « vos » photos (pour les supprimer) et à compter votre quota.</li>
        </ul>
        <p className="mt-2">Pas de compte, pas d'adresse e-mail, pas de publicité ni de pistage. Les photos sont réenregistrées par votre téléphone avant l'envoi, ce qui retire leurs métadonnées (dont la position GPS).</p>

        <H>Qui peut voir les photos</H>
        <p>Toute personne qui a le code de l'album (ou le QR code) : les invités, l'organisateur, et l'écran de diffusion de la soirée. L'organisateur peut choisir de valider les photos avant publication et de télécharger l'album complet.</p>

        <H>Où et combien de temps</H>
        <p>Les photos sont stockées dans l'Union européenne (Cloudflare R2, juridiction UE), dans un espace privé accessible uniquement par des liens temporaires. L'album, les photos et les prénoms sont <b>supprimés automatiquement</b> à la date indiquée sur la page de l'album (par défaut 60 jours après l'événement).</p>

        <H>Retirer une photo</H>
        <p>Vous pouvez supprimer à tout moment les photos que vous avez prises, depuis l'album (bouton 🗑 sur la photo). Pour une photo de vous prise par quelqu'un d'autre, demandez-le à l'organisateur, ou écrivez à <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a> en précisant le code de l'album.</p>

        <H>Responsable</H>
        <p>Clic-Clac est un service d'<Link href="/" className="underline">apps360</Link>. Pour toute question ou pour exercer vos droits (accès, suppression) : <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a>.</p>
      </div>
    </div>
  );
}
