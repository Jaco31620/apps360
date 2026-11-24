/* Ami Invisible — informations de confidentialité (organisateurs et participants). */
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const metadata = { title: "Confidentialité — Ami Invisible" };

const H = ({ children }) => <h2 className="text-lg font-extrabold text-gray-900 mt-7 mb-2">{children}</h2>;

export default function AmiInvisiblePrivacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow p-6 sm:p-8 text-gray-700 leading-relaxed">
        <Link href="/ami-invisible" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4"><AppIcon app="ami-invisible" /> Ami Invisible</Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Vos données</h1>
        <p className="mt-2">Ami Invisible organise un tirage au sort de cadeaux. Il collecte le minimum nécessaire, n'exploite rien (ni publicité, ni pistage, ni revente) et efface ce qui ne sert plus.</p>

        <H>Ce qui est enregistré</H>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>L'organisateur</b> : son adresse e-mail (pour se connecter, sans mot de passe) et, s'il l'indique, le prénom affiché aux participants.</li>
          <li><b>Les participants</b> : prénom, nom et adresse e-mail, saisis par l'organisateur. Ils sont gardés dans son carnet pour ses prochains tirages.</li>
          <li><b>Le tirage</b> : qui offre à qui, la date, le lieu et le budget s'ils sont indiqués, le message, et le suivi « envoyé » / « ouvert » de chaque lien (avec la date de première ouverture).</li>
          <li><b>Les listes de souhaits</b>, si l'organisateur les a activées : ce que chaque participant y écrit.</li>
        </ul>
        <p className="mt-2">Pas de numéro de téléphone, pas d'adresse postale.</p>

        <H>À quoi servent les adresses e-mail</H>
        <p>Uniquement à envoyer à chaque participant son lien personnel, quand l'organisateur le décide. L'e-mail ne contient que ce lien, jamais le résultat. Aucune lettre d'information, aucune publicité.</p>

        <H>Qui voit quoi</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chaque participant voit uniquement la personne à qui il offre un cadeau, et sa liste de souhaits.</li>
          <li>Une liste de souhaits n'est visible que par la personne qui offre le cadeau à son auteur : ni l'organisateur, ni les autres participants ne la voient.</li>
          <li>Si l'organisateur participe au tirage, le résultat ne lui est pas affiché. Il peut transmettre lui-même le lien d'un participant (par exemple par WhatsApp) : la page de ce participant indique la date de première ouverture. S'il organise sans participer, il peut afficher qui offre à qui ; chaque affichage est enregistré.</li>
          <li>L'administrateur d'apps360 peut intervenir en cas de problème (renvoyer ou transmettre un lien, corriger une adresse). Qui offre à qui lui est masqué par défaut ; l'affichage du résultat complet est enregistré.</li>
        </ul>

        <H>Combien de temps</H>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Listes de souhaits</b> : effacées un mois après la date de l'échange, ou trois mois après le tirage s'il n'y a pas de date.</li>
          <li><b>Tirages, participants et carnet</b> : conservés tant que l'organisateur utilise Ami Invisible, pour qu'il puisse repartir d'un tirage l'année suivante. Après 11 mois sans utilisation, il reçoit un e-mail : un clic suffit pour tout garder 12 mois de plus. Sans réponse, tout est supprimé au bout de 12 mois.</li>
        </ul>

        <H>Supprimer ses données</H>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Participant</b> : le lien « Supprimer mes coordonnées », en bas de l'e-mail reçu et de la page personnelle, efface votre adresse e-mail de tous les tirages et du carnet de cet organisateur. Vous ne recevez plus aucun message et l'organisateur en est informé. Votre nom reste dans les tirages déjà faits, pour que la personne qui vous offre un cadeau sache toujours à qui elle l'offre.</li>
          <li><b>Organisateur</b> : depuis votre espace, vous pouvez supprimer un tirage, ou toutes vos données Ami Invisible en une fois.</li>
        </ul>

        <H>Où sont les données</H>
        <p>Chez les prestataires techniques d'apps360 : Supabase (base de données), Vercel (site) et Resend (envoi des e-mails). Ils les hébergent ou les acheminent pour notre compte et ne les utilisent pas pour eux-mêmes.</p>

        <H>Responsable</H>
        <p>Ami Invisible est un service d'<Link href="/" className="underline">apps360</Link>. Pour toute question ou pour exercer vos droits (accès, rectification, suppression) : <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a>.</p>
      </div>
    </div>
  );
}
