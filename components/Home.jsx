"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Lock, Zap, ArrowDown } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { adminToken } from "@/components/admin/session";
import HomeCard from "@/components/HomeCard";

// Apps : lib/apps.js ; état, accès, accroche et ordre réglés dans le backoffice (/admin).

const valeurs = [
  { Icon: Ban, tint: "bg-orange-50 text-brand-orange-dark", title: "Sans publicité", desc: "Aucune pub, aucun traceur. Votre expérience reste fluide." },
  { Icon: Lock, tint: "bg-teal-50 text-teal-700", title: "Données privées", desc: "Vos données vous appartiennent : jamais exploitées, jamais revendues." },
  { Icon: Zap, tint: "bg-blue-50 text-brand-navy", title: "Simple et rapide", desc: "Pas de fioritures, juste ce qu'il faut pour faire le job." },
];

export default function Home({ apps }) {
  const { user, signOut } = useAuth();
  // apps « En test » : seulement sur un appareil connecté au backoffice (lecture locale)
  const [admin, setAdmin] = useState(false);
  useEffect(() => { setAdmin(!!adminToken()); }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Barre du haut */}
      <nav className="absolute top-0 left-0 right-0 z-10 px-4 py-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center text-sm">
          <Link href="/" aria-label="apps360.fr — accueil">
            <img src="/brand/apps360-symbole-fond-sombre.svg" alt="apps360.fr" className="h-8 w-8" />
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-2">
          {[["/soutenir", "☕", "Soutenir"], ["/contact?app=apps360", "✉️", "Nous écrire"]].map(([href, icon, label]) => (
            <Link key={href} href={href} aria-label={label} title={label}
              className="inline-flex items-center justify-center gap-1.5 min-w-[44px] h-11 sm:h-auto sm:px-3 sm:py-1.5 text-base sm:text-xs text-white/85 hover:text-white hover:bg-white/10 rounded-full font-semibold transition-colors">
              <span aria-hidden="true">{icon}</span><span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-3 text-white">
              <span className="opacity-80 text-xs hidden sm:inline">{user.email}</span>
              <button onClick={signOut} className="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-xs font-medium transition-colors">
                Déconnexion
              </button>
            </div>
          ) : (
            <Link href="/connexion" className="bg-white text-brand-navy hover:bg-brand-cream px-4 py-1.5 rounded-full text-xs font-semibold transition-colors">
              Se connecter
            </Link>
          )}
          </div>
        </div>
      </nav>

      {/* En-tête */}
      <section className="relative bg-brand-navy pt-28 pb-36 px-4 overflow-hidden">
        {/* le symbole en filigrane */}
        <img src="/brand/apps360-symbole-blanc.svg" alt="" aria-hidden="true"
          className="pointer-events-none select-none absolute -right-24 -top-16 w-[420px] opacity-[0.06]" />
        <img src="/brand/apps360-symbole-blanc.svg" alt="" aria-hidden="true"
          className="pointer-events-none select-none absolute -left-32 bottom-[-140px] w-[320px] opacity-[0.04]" />

        <div className="relative max-w-3xl mx-auto text-center space-y-7">
          <h1 className="flex justify-center">
            <img src="/brand/apps360-logo-fond-sombre.svg" alt="apps360.fr" className="w-full max-w-[460px] h-auto" />
          </h1>
          <p className="font-outfit text-xl sm:text-2xl text-white max-w-xl mx-auto leading-relaxed">
            Des applis utiles, gratuites et sans publicité.
            <span className="block text-brand-mist text-lg mt-1">Sans exploitation de vos données. Juste là pour faire le job.</span>
          </p>
          <div className="pt-2">
            <a href="#apps" className="inline-flex items-center gap-2 bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-8 py-3.5 rounded-full transition-colors text-sm">
              Découvrir les apps <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* Apps */}
      <section id="apps" className="max-w-5xl mx-auto px-4 -mt-20 relative z-10 pb-20">
        <div className="grid gap-6 sm:grid-cols-2">
          {apps.filter((a) => a.state === "public" || admin).map(app => (
            <HomeCard key={app.href} app={app} />
          ))}

          {/* Emplacement de la prochaine app */}
          <div className="rounded-3xl border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-center min-h-[260px]">
            <img src="/brand/apps360-symbole.svg" alt="" aria-hidden="true" className="w-12 h-12 mb-4 opacity-40" />
            <p className="text-gray-500 font-medium">D'autres apps arrivent bientôt</p>
            <p className="text-xs text-gray-400 mt-1">Une idée ? <Link href="/contact?app=apps360&sujet=idee" className="underline hover:text-brand-navy">Écrivez-nous</Link>.</p>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="bg-brand-cream py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-outfit text-3xl sm:text-4xl font-extrabold text-brand-navy mb-3">Notre philosophie</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Des outils pensés autrement, à contre-courant des applis usines à gaz.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {valeurs.map(({ Icon, tint, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <div className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-4 ${tint}`}>
                  <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-lg font-extrabold text-brand-navy mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Soutien */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-10 text-center border-2 border-brand-navy/10">
          <div className="text-4xl mb-4" aria-hidden="true">☕</div>
          <h2 className="font-outfit text-2xl font-extrabold text-brand-navy mb-2">Vous aimez apps360 ?</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Tout est gratuit et a vocation à le rester. Un don aide à payer l'hébergement, les serveurs et les outils qui font tourner les apps.
          </p>
          <Link href="/soutenir"
            className="inline-block bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-8 py-3 rounded-full transition-colors text-sm">
            Soutenir le projet
          </Link>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="border-t border-gray-100 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-3 text-xs text-gray-500">
          <img src="/brand/apps360-logo.svg" alt="apps360.fr" className="h-5 w-auto" />
          <p className="text-center">
            © {new Date().getFullYear()} apps360.fr — Apps utiles, sans pub ·{" "}
            <Link href="/contact?app=apps360" className="font-semibold underline hover:text-brand-navy">Nous écrire</Link> ·{" "}
            <a href="mailto:contact@apps360.fr" className="hover:underline hover:text-brand-navy">contact@apps360.fr</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
