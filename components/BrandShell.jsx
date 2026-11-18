/*
 * Cadre des pages « site » d'apps360 (connexion, soutien…) aux couleurs de la
 * charte (brand/README.md) : fond crème, logo en tête qui ramène à l'accueil.
 * Ne pas utiliser dans les apps, qui gardent leur propre identité.
 */
import Link from "next/link";

export default function BrandShell({ children }) {
  return (
    <div className="min-h-screen bg-brand-cream text-gray-900">
      <header className="px-4 pt-8 flex justify-center">
        <Link href="/" aria-label="apps360.fr — retour à l'accueil">
          <img src="/brand/apps360-logo.svg" alt="apps360.fr" className="h-9 w-auto" />
        </Link>
      </header>
      {children}
    </div>
  );
}
