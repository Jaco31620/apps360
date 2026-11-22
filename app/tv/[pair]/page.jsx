"use client";
/*
 * Page ouverte par le téléphone qui a scanné le QR code de apps360.fr/tv :
 * choix de la soirée à afficher sur la télé (soirées de cet appareil, ou
 * code à 6 chiffres), puis du mode : affichage seul, ou affichage + son (la
 * télé joue la musique ; seulement depuis un appareil qui a l'accès régie,
 * le téléphone sert ensuite de télécommande).
 * Ou un album Clic-Clac : la télé affiche son écran live (diaporama), piloté
 * ensuite depuis la télécommande Clic-Clac de l'organisateur.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { myParties, formatCode, getAdminToken } from "@/components/jukebox/storage";
import { normalizeCode, isAlbumCode } from "@/lib/clicclac/settings";

/* Albums Clic-Clac connus de cet appareil (organisateur) : clés cc_admin_<code>. */
function myAlbums() {
  try {
    return Object.keys(localStorage).map((k) => k.match(/^cc_admin_([A-Z0-9]{6})$/)?.[1]).filter(Boolean);
  } catch (e) { return []; }
}

export default function TvPair({ params }) {
  const { pair } = use(params);
  const [mine, setMine] = useState([]);
  const [code, setCode] = useState("");
  const [chosen, setChosen] = useState(null); // { code, name } : soirée choisie, mode à choisir
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { code, sound, app }
  const [albums, setAlbums] = useState([]); // [{ code, name }]
  const [album, setAlbum] = useState("");

  useEffect(() => {
    setMine(myParties());
    Promise.all(myAlbums().map((c) => fetch(`/api/clicclac/${c}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? { code: c, name: d.album.name } : null)).catch(() => null)))
      .then((l) => setAlbums(l.filter(Boolean)));
  }, []);

  const sendAlbum = async (c) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/jukebox/tv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pair, app: "clicclac", code: c }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Envoi impossible.");
      let admin = false;
      try { admin = !!(localStorage.getItem(`cc_admin_${c}`) || localStorage.getItem("cc_super")); } catch (e) { /* stockage indisponible */ }
      setDone({ code: c, app: "clicclac", admin });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const send = async (c, sound) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/jukebox/tv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pair, code: c, ...(sound ? { token: getAdminToken(c) } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Envoi impossible.");
      setDone({ code: c, sound });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // régie sur cet appareil : choix du mode ; sinon affichage seul
  const choose = (c, name) => (getAdminToken(c) ? setChosen({ code: c, name }) : send(c, false));

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900 px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-3xl p-6 shadow-xl space-y-5">
        <div>
          <p className="text-4xl mb-2">📺</p>
          <h1 className="text-2xl font-extrabold text-gray-900">Afficher sur la télé</h1>
        </div>
        {done?.app === "clicclac" ? (
          <div className="space-y-3">
            <p className="text-green-700 bg-green-50 rounded-2xl px-4 py-3 font-semibold">✓ La télé affiche l'album {done.code} dans quelques secondes.</p>
            {done.admin ? (
              <Link href={`/clic-clac/${done.code}/telecommande`} className="block text-center bg-[#ff5a5f] text-white font-bold py-3 rounded-full">
                📱 Piloter l'écran depuis ce téléphone
              </Link>
            ) : <p className="text-sm text-gray-500">Vous pouvez fermer cette page.</p>}
          </div>
        ) : done ? (
          <div className="space-y-3">
            <p className="text-green-700 bg-green-50 rounded-2xl px-4 py-3 font-semibold">
              ✓ La télé ouvre la soirée {formatCode(done.code)} dans quelques secondes.
            </p>
            {done.sound ? (
              <>
                <p className="text-sm text-gray-600">
                  Appuyez sur <b>OK</b> avec la télécommande de la télé pour lancer la musique. Pilotez ensuite la soirée
                  depuis ce téléphone.
                </p>
                <Link href={`/jukebox/${done.code}/organiser`} className="block text-center bg-fuchsia-600 text-white font-bold py-3 rounded-full">
                  📱 Ouvrir la télécommande
                </Link>
              </>
            ) : <p className="text-sm text-gray-500">Vous pouvez fermer cette page.</p>}
          </div>
        ) : chosen ? (
          <div className="space-y-3">
            <p className="text-gray-600">Soirée <b>{chosen.name || formatCode(chosen.code)}</b> : que fait la télé ?</p>
            <button onClick={() => send(chosen.code, false)} disabled={busy}
              className="w-full text-left bg-gray-50 hover:bg-fuchsia-50 rounded-2xl px-4 py-3 disabled:opacity-50">
              <span className="block font-bold text-gray-900">📺 Affichage seul</span>
              <span className="block text-sm text-gray-500">La musique reste jouée par la régie (ordinateur branché à la sono).</span>
            </button>
            <button onClick={() => send(chosen.code, true)} disabled={busy}
              className="w-full text-left bg-gray-50 hover:bg-fuchsia-50 rounded-2xl px-4 py-3 disabled:opacity-50">
              <span className="block font-bold text-gray-900">🔊 Affichage + son</span>
              <span className="block text-sm text-gray-500">La télé joue aussi la musique, sans ordinateur ; ce téléphone sert de télécommande.</span>
            </button>
            <button onClick={() => setChosen(null)} className="text-sm text-gray-500 underline">← Autre soirée</button>
          </div>
        ) : (
          <>
            {mine.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Vos soirées :</p>
                <ul className="space-y-2">
                  {mine.map((p) => (
                    <li key={p.code}>
                      <button onClick={() => choose(p.code, p.name)} disabled={busy}
                        className="w-full flex items-center gap-3 text-left bg-gray-50 hover:bg-fuchsia-50 rounded-2xl px-4 py-3 disabled:opacity-50">
                        <span className="flex-1 min-w-0 font-semibold text-gray-900 truncate">{p.name}</span>
                        <span className="font-mono font-bold text-fuchsia-600">{formatCode(p.code)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); const c = code.replace(/\D/g, ""); if (c.length === 6) choose(c, ""); }} className="space-y-2">
              <p className="text-sm text-gray-500">{mine.length ? "Ou le code d'une autre soirée :" : "Code de la soirée :"}</p>
              <div className="flex gap-2">
                <input inputMode="numeric" autoComplete="off" placeholder="123 456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                  className="flex-1 min-w-0 text-center text-2xl font-bold tracking-[0.2em] border-2 border-gray-200 rounded-2xl py-2 focus:border-fuchsia-500 outline-none" />
                <button disabled={busy || code.replace(/\D/g, "").length !== 6}
                  className="shrink-0 bg-fuchsia-600 disabled:opacity-40 text-white font-bold px-5 rounded-2xl">Afficher</button>
              </div>
            </form>

            <div className="border-t border-gray-100 pt-5 space-y-2">
              <p className="font-bold text-gray-900">📸 Un album photo Clic-Clac</p>
              {albums.length > 0 && (
                <ul className="space-y-2">
                  {albums.map((a) => (
                    <li key={a.code}>
                      <button onClick={() => sendAlbum(a.code)} disabled={busy}
                        className="w-full flex items-center gap-3 text-left bg-gray-50 hover:bg-orange-50 rounded-2xl px-4 py-3 disabled:opacity-50">
                        <span className="flex-1 min-w-0 font-semibold text-gray-900 truncate">{a.name}</span>
                        <span className="font-mono font-bold text-[#ff5a5f]">{a.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={(e) => { e.preventDefault(); const c = normalizeCode(album); if (isAlbumCode(c)) sendAlbum(c); }} className="flex gap-2">
                <input autoComplete="off" placeholder="Code de l'album" value={album} maxLength={8}
                  onChange={(e) => setAlbum(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 text-center text-2xl font-bold tracking-[0.2em] border-2 border-gray-200 rounded-2xl py-2 focus:border-[#ff5a5f] outline-none" />
                <button disabled={busy || !isAlbumCode(normalizeCode(album))}
                  className="shrink-0 bg-[#ff5a5f] disabled:opacity-40 text-white font-bold px-5 rounded-2xl">Afficher</button>
              </form>
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
