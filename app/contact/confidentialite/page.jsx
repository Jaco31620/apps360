/* Formulaire de contact — informations de confidentialité. */
import Link from "next/link";
import BrandShell from "@/components/BrandShell";

export const metadata = { title: "Vos données — Contact apps360" };

const H = ({ children }) => <h2 className="font-outfit text-lg font-extrabold text-brand-navy mt-7 mb-2">{children}</h2>;

export default function ContactPrivacy() {
  return (
    <BrandShell>
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 text-gray-700 leading-relaxed">
          <Link href="/contact" className="text-sm font-bold text-gray-500">← Nous écrire</Link>
          <h1 className="font-outfit text-3xl font-extrabold text-brand-navy mt-3">Vos données</h1>
          <p className="mt-2">Ni publicité, ni pistage, ni revente.</p>
          <H>Ce que nous gardons</H>
          <p>Votre message, l'app concernée et, si vous les donnez, votre prénom, votre adresse e-mail et votre type d'appareil (affiché avant l'envoi, décochable). Votre adresse sert uniquement à vous répondre. Nos réponses et une note de suivi sont gardées avec le message.</p>
          <H>Brouillon</H>
          <p>Tant que le message n'est pas envoyé, il reste dans votre navigateur, 24 heures au plus, pour ne pas le perdre si la page se ferme.</p>
          <H>Qui y a accès</H>
          <p>L'équipe apps360 seulement. Nos prestataires techniques les hébergent ou les acheminent pour notre compte : Supabase (base de données), Vercel (site), Resend (envoi des e-mails) et OVH (messagerie).</p>
          <H>Limites d'usage</H>
          <p>L'adresse IP et une empreinte de l'adresse e-mail servent à limiter les abus. Ces compteurs sont effacés automatiquement après leur période d'usage.</p>
          <H>Durée</H>
          <p>Les messages sont effacés de notre outil de suivi au bout de 12 mois. Nous pouvons en garder une copie dans notre messagerie le temps utile à l'échange. Vous pouvez demander leur suppression à tout moment.</p>
          <H>Contact</H>
          <p>Pour toute question ou pour exercer vos droits (accès, rectification, suppression) : <a className="underline" href="mailto:contact@apps360.fr">contact@apps360.fr</a>.</p>
        </div>
      </main>
    </BrandShell>
  );
}
