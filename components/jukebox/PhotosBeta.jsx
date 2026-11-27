"use client";
/*
 * BETA écran commun (27/11/2026) — page de commande de l'organisateur / super-admin :
 * lier un album Clic-Clac à la soirée et choisir la disposition de l'écran
 * (🎵 Vidéo · 🎞️ Mélange · 📸 Photos). « Retirer les photos » : l'écran repasse
 * tout seul sur l'affichage habituel. Action régie « photos » (admin/route.js).
 */
import { useCallback, useEffect, useState } from "react";
import { authHeaders, hasRegieAccess, formatCode } from "./storage";


function localAlbums() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^cc_admin_(.+)$/.exec(localStorage.key(i) || "");
      if (m) out.push(m[1]);
    }
  } catch (e) { /* stockage indisponible */ }
  return out.sort();
}

export default function PhotosBeta({ code }) {
  const [access, setAccess] = useState(null);
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jukebox/${code}`, { cache: "no-store", headers: authHeaders(code) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error || "Soirée introuvable.");
      setSession(d.session);
    } catch (e) { setError("Connexion impossible, réessayez."); }
  }, [code]);
  useEffect(() => { setAccess(hasRegieAccess(code)); setMine(localAlbums()); load(); }, [code, load]);

  const send = async (body) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/jukebox/${code}/admin`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(code) }, body: JSON.stringify({ action: "photos", ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || `Erreur ${res.status}`);
      else { setInput(""); await load(); }
    } catch (e) { setError("Connexion impossible, réessayez."); }
    setBusy(false);
  };

  if (access === null) return <Shell>Chargement…</Shell>;
  if (!access) return <Shell><p>Cette page est réservée à l'organisateur de la soirée ou au super-admin. Ouvrez-la depuis un appareil connecté.</p></Shell>;
  const p = session?.photos;

  return (
    <Shell title={session ? `${session.name} · ${formatCode(code)}` : formatCode(code)}>
      <section className="space-y-3">
        <h2 className="font-bold text-lg">📸 Album Clic-Clac</h2>
        {p ? (
          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0"><p className="font-bold truncate">{p.name || "Album"}</p><p className="text-sm text-white/60">code {p.album}</p></div>
            <button disabled={busy} onClick={() => send({ album: null })} className="shrink-0 text-sm font-bold bg-white/10 hover:bg-white/20 rounded-full px-4 py-2">Retirer les photos</button>
          </div>
        ) : <p className="text-sm text-white/70">Aucun album lié : l'écran est l'écran habituel.</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) send({ album: input.trim() }); }} className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Code de l'album" autoCapitalize="characters"
            className="flex-1 min-w-0 bg-white/10 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-fuchsia-500" />
          <button disabled={busy || !input.trim()} className="shrink-0 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 font-bold rounded-xl px-5">{p ? "Changer" : "Lier"}</button>
        </form>
        {mine.filter((c) => c !== p?.album).length > 0 && (
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-white/60">Sur cet appareil :</span>
            {mine.filter((c) => c !== p?.album).map((c) => (
              <button key={c} disabled={busy} onClick={() => send({ album: c })} className="bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 font-mono font-bold">{c}</button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/40 rounded-xl px-3 py-2">{error}</p>}
      </section>

      {p && (
        <section className="space-y-3 mt-8">
          <h2 className="font-bold text-lg">📺 Écran de la soirée</h2>
          <p className="text-sm text-white/70">En haut, l'écran photos Clic-Clac (réglages et pilotage habituels, depuis Clic-Clac). En bas, le bandeau Jukebox : titre en cours et QR unique.</p>
          {(
            <div className="grid grid-cols-2 gap-2">
              {[[true, "🎬 Vidéo en vignette"], [false, "🔊 Son seul"]].map(([v, l]) => (
                <button key={l} disabled={busy} onClick={() => send({ video: v })}
                  className={`rounded-2xl py-3 font-bold text-sm ${(p.video !== false) === v ? "bg-fuchsia-600 ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>{l}</button>
              ))}
            </div>
          )}
          <p className="text-xs text-white/50">Le changement s'applique sur la télé en quelques secondes, sans couper la musique. Pendant un blind test, l'écran Jukebox habituel revient.</p>
        </section>
      )}

      <section className="mt-8 text-sm text-white/60 space-y-1">
        <p>Écran : <a className="underline" href={`/jukebox/${code}/ecran`}>/jukebox/{code}/ecran</a> (passe tout seul en version photos quand un album est lié).</p>
        <p><a className="underline" href={`/jukebox/${code}/organiser`}>← Organiser la soirée</a></p>
      </section>
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-6">
      <div className="max-w-lg mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-fuchsia-300">Beta · Écran avec photos</p>
        {title && <h1 className="text-xl font-black mt-1 mb-6">{title}</h1>}
        {children}
      </div>
    </main>
  );
}
