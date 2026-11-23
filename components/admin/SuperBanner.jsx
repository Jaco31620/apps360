"use client";
/*
 * Bandeau « mode super-admin » en haut des pages d'une app (organisateur,
 * télécommande, page invité…), affiché UNIQUEMENT si un jeton super-admin est
 * présent sur l'appareil : un vrai organisateur ne le voit jamais.
 * Retour au super-admin de l'app (jeton renouvelé au clic si besoin, comme
 * AdminBar) et au backoffice. Aucune requête au chargement, pas de polling.
 * Règle : jamais sur un écran affiché au public (live, borne, /tv, écran).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureApp, hasSuper } from "./session";

const APPS = {
  jukebox: { label: "Jukebox", href: "/jukebox/admin" },
  clicclac: { label: "Clic-Clac", href: "/clic-clac/super" },
  ami: { label: "Ami Invisible", href: "/ami-invisible/super" },
};

export default function SuperBanner({ app }) {
  const [on, setOn] = useState(false);
  const router = useRouter();
  useEffect(() => { setOn(hasSuper(app)); }, [app]);
  if (!on || !APPS[app]) return null;
  const a = APPS[app];
  const back = async (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    await ensureApp(app);
    router.push(a.href);
  };
  return (
    <div className="bg-brand-navy text-white text-xs sm:text-sm">
      <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="font-semibold">🛡️ Super-admin</span>
        <span className="text-white/40" aria-hidden="true">·</span>
        <a href={a.href} onClick={back} className="font-semibold text-white/90 hover:text-white underline decoration-white/30 hover:decoration-brand-orange">← Retour au super-admin {a.label}</a>
        <span className="text-white/40" aria-hidden="true">·</span>
        <a href="/admin" className="text-white/80 hover:text-white underline decoration-white/30 hover:decoration-brand-orange">Backoffice apps360</a>
      </div>
    </div>
  );
}
