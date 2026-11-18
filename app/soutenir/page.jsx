import Link from "next/link";
import BrandShell from "@/components/BrandShell";

export const metadata = {
  title: "Soutenir apps360",
};

export default function SoutenirPage() {
  return (
    <BrandShell>
      <main className="max-w-md mx-auto px-4 py-12 text-center space-y-8">
        <div className="space-y-3">
          <div className="text-5xl" aria-hidden="true">☕</div>
          <h1 className="font-outfit text-3xl font-extrabold text-brand-navy">Soutenir apps360</h1>
          <p className="text-gray-600">
            Toutes les apps sont gratuites et sans publicité. Si elles vous ont été utiles,
            un petit don fait toujours plaisir et aide à financer les prochains outils !
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
          <p className="text-gray-600 text-sm">Choisissez le montant qui vous convient sur la page PayPal :</p>
          <div className="flex justify-center">
            <a href="https://www.paypal.com/donate/?hosted_button_id=N57TTF76Z9GLG"
              target="_blank" rel="noopener noreferrer"
              className="bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-7 py-3 rounded-full transition-colors">
              Faire un don
            </a>
          </div>
          <p className="text-xs text-gray-500">Paiement sécurisé via PayPal</p>
        </div>

        <Link href="/" className="text-sm text-gray-500 hover:underline">← Retour aux apps</Link>
      </main>
    </BrandShell>
  );
}
