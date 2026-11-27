"use client";
/*
 * BETA écran commun (27/11/2026) — page d'accueil de la soirée, cible du QR
 * unique de l'écran : « 🎵 Proposer un titre » (page invité Jukebox) ou
 * « 📸 Envoyer une photo » (album Clic-Clac lié). Une seule lecture au
 * chargement. Sans album lié : directement la page invité Jukebox.
 */
import { useEffect, useState } from "react";
import AppIcon from "@/components/AppIcon";
import { themeVars } from "@/lib/jukebox";

export default function SoireeHub({ code }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`/api/jukebox/${code}`, { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})).then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.session?.photos?.album) return setS(d.session);
        window.location.replace(`/jukebox/${code}`); // pas d'album (ou soirée fermée) : page invité habituelle
      })
      .catch(() => setErr(true));
  }, [code]);

  if (err) return <Shell><p className="text-white/80">Connexion impossible. <a className="underline" href={`/jukebox/${code}`}>Ouvrir le Jukebox</a></p></Shell>;
  if (!s) return <Shell><p className="text-white/60">Chargement…</p></Shell>;
  const theme = s.theme;
  return (
    <Shell style={themeVars(theme)}>
      {theme?.logo && <img src={`/api/jukebox/${code}/logo?v=${theme.logo}`} alt="" className="h-20 max-w-full object-contain mx-auto mb-4" />}
      <p className="text-sm font-bold tracking-[0.2em] uppercase text-white/60">Bienvenue !</p>
      <h1 className="text-3xl font-black mt-1 leading-tight">{theme?.title || s.name}</h1>
      {theme?.message && <p className="mt-2 text-white/70">{theme.message}</p>}
      <div className="mt-10 space-y-4">
        <a href={`/jukebox/${code}`} className="flex items-center gap-4 bg-white/10 hover:bg-white/15 active:scale-[.99] rounded-3xl p-5 text-left">
          <AppIcon app="jukebox" className="w-16 h-16 shrink-0" />
          <span><span className="block text-xl font-black">🎵 Proposer un titre</span><span className="block text-sm text-white/70">Choisissez la prochaine chanson</span></span>
        </a>
        <a href={`/clic-clac/${s.photos.album}`} className="flex items-center gap-4 bg-white/10 hover:bg-white/15 active:scale-[.99] rounded-3xl p-5 text-left">
          <AppIcon app="clicclac" className="w-16 h-16 shrink-0" />
          <span><span className="block text-xl font-black">📸 Envoyer une photo</span><span className="block text-sm text-white/70">Elle s'affichera sur l'écran de la soirée</span></span>
        </a>
      </div>
      <p className="mt-10 text-xs text-white/40">Revenez sur cette page pour passer de l'un à l'autre.</p>
    </Shell>
  );
}

function Shell({ children, style }) {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-5 py-10 text-center" style={style}>
      <div className="max-w-md mx-auto">{children}</div>
    </main>
  );
}
