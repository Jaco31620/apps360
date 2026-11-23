import Link from "next/link";
import BrandShell from "@/components/BrandShell";
import { PAYPAL_DONATE } from "@/lib/soutien";

export const metadata = {
  title: "Soutenir apps360",
  description: "Les apps apps360 sont gratuites et sans publicité. Un don aide à payer l'hébergement, les serveurs et les outils qui les font tourner.",
};

const usages = [
  { icon: "🖥️", title: "L'hébergement et les serveurs", desc: "qui font tourner les apps en direct pendant vos soirées et vos événements." },
  { icon: "🗄️", title: "La base de données et le stockage", desc: "pour vos albums photo, vos playlists et vos tirages." },
  { icon: "🌐", title: "Les noms de domaine et les outils techniques", desc: "envoi des e-mails, sauvegardes." },
  { icon: "🚀", title: "Le temps passé", desc: "à améliorer les apps et à en créer de nouvelles." },
];

function DonateButton() {
  return (
    <div className="space-y-2">
      <a href={PAYPAL_DONATE} target="_blank" rel="noopener noreferrer"
        className="inline-block bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-8 py-3.5 rounded-full transition-colors">
        Faire un don
      </a>
      <p className="text-xs text-gray-500">Le montant de votre choix · paiement sécurisé PayPal</p>
    </div>
  );
}

export default function SoutenirPage() {
  return (
    <BrandShell>
      <main className="max-w-lg mx-auto px-4 py-12 text-center space-y-8">
        <div className="space-y-3">
          <div className="text-5xl" aria-hidden="true">☕</div>
          <h1 className="font-outfit text-3xl font-extrabold text-brand-navy">Soutenir apps360</h1>
          <p className="text-gray-600">
            Toutes les apps sont gratuites, sans publicité, et vos données ne sont jamais exploitées.
            Pour que ça reste possible, apps360 compte sur ceux qui l&apos;utilisent.
          </p>
          <div className="pt-2"><DonateButton /></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 text-left space-y-4">
          <h2 className="font-outfit text-xl font-extrabold text-brand-navy text-center">À quoi sert votre don ?</h2>
          <ul className="space-y-3">
            {usages.map((u) => (
              <li key={u.title} className="flex gap-3">
                <span className="text-xl leading-6" aria-hidden="true">{u.icon}</span>
                <p className="text-gray-600"><strong className="text-brand-navy">{u.title}</strong> {u.desc}</p>
              </li>
            ))}
          </ul>
          <p className="text-gray-600 pt-2 border-t border-gray-100">
            Plus les apps sont utilisées, plus ces frais augmentent. Chaque don, même petit, aide à les garder{" "}
            <strong className="text-brand-navy">gratuites pour tout le monde</strong>.
          </p>
        </div>

        <div className="space-y-3">
          <DonateButton />
          <p className="text-sm text-gray-600">Merci 🧡 Un café offert, c&apos;est une soirée de plus sur les serveurs.</p>
        </div>

        <Link href="/" className="inline-block text-sm text-gray-500 hover:underline">← Retour aux apps</Link>
      </main>
    </BrandShell>
  );
}
