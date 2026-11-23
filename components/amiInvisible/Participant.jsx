"use client";
/*
 * Ami Invisible — page personnelle d'un participant (/ami-invisible/p/<token>).
 * Le résultat s'affiche dès l'arrivée : il est demandé par le navigateur
 * (JavaScript), ce qui note « ouvert » — les robots qui se contentent de
 * télécharger la page (antivirus des messageries) ne comptent pas.
 * Liste de souhaits si l'organisateur l'a activée.
 * ?supprimer=1 (lien de l'e-mail) : ouvre directement la suppression des
 * coordonnées, sans afficher le résultat (ni noter « ouvert »).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { texts, fmtDay } from "@/lib/amiInvisible";
import SoutenirLink from "@/components/SoutenirLink";

async function api(body) {
  const res = await fetch("/api/ami-invisible/p", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Service momentanément indisponible."), { status: res.status });
  return r;
}

export default function Participant({ token, erase: eraseAsked }) {
  const [state, setState] = useState(null); // { event, me } | { invalid } | { error }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erase, setErase] = useState(eraseAsked);
  const [erased, setErased] = useState(false);
  const [wish, setWish] = useState("");
  const [wishSaved, setWishSaved] = useState(false);
  const [err, setErr] = useState("");

  const reveal = async () => {
    setErr("");
    try { const r = await api({ action: "reveal", token }); setState({ event: r.event, me: r.me }); setResult(r); setWish(r.myWishlist || ""); }
    catch (e) { setState(e.status === 404 ? { invalid: true } : { error: e.message }); }
  };

  useEffect(() => {
    if (!eraseAsked) { reveal(); return; }
    api({ action: "view", token })
      .then((r) => setState(r))
      .catch((e) => setState(e.status === 404 ? { invalid: true } : { error: e.message }));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const T = texts(state?.event?.tone);

  const saveWish = async () => {
    setBusy(true); setErr("");
    try { await api({ action: "wishlist", token, text: wish }); setWishSaved(true); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const doErase = async () => {
    setBusy(true); setErr("");
    try { await api({ action: "erase", token }); setErased(true); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const ev = state?.event;
  const infos = ev ? [ev.date && `📅 ${fmtDay(ev.date)}`, ev.place && `📍 ${ev.place}`, ev.budget && `💶 Budget : ${ev.budget}`].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="text-5xl">🎁</div>
          <h1 className="text-2xl font-extrabold text-red-600 mt-1">Ami Invisible</h1>
          {ev && <p className="text-gray-600 font-semibold mt-1">{ev.name}</p>}
          {ev?.organizer && <p className="text-xs text-gray-400">organisé par {ev.organizer}</p>}
        </div>

        {!state && <p className="text-center text-gray-400 py-10">Chargement…</p>}
        {state?.invalid && <Card><p className="text-center text-gray-500">{T.invalid}</p></Card>}
        {state?.error && <Card><p className="text-center text-red-600">{state.error}</p></Card>}

        {ev && !erase && (
          <>
            {!result ? (
              <p className="text-center text-gray-400 py-10">Chargement…</p>
            ) : (
              <Card>
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{result.message}</p>
                {infos.length > 0 && <div className="bg-orange-50 rounded-xl p-3 text-sm text-gray-700 space-y-1">{infos.map((l) => <p key={l}>{l}</p>)}</div>}
              </Card>
            )}

            {result && ev.wishlist && (
              <>
                <Card>
                  <h2 className="font-bold text-gray-800">{T.receiverList(result.receiver.prenom)}</h2>
                  {result.receiverWishlist
                    ? <p className="text-gray-700 whitespace-pre-wrap break-words">{linkify(result.receiverWishlist)}</p>
                    : <p className="text-sm text-gray-400">{T.receiverEmpty(result.receiver.prenom)}</p>}
                </Card>
                <Card>
                  <h2 className="font-bold text-gray-800">{T.myList}</h2>
                  <p className="text-xs text-gray-500">{T.myListHelp}</p>
                  <textarea rows={5} value={wish} maxLength={2000} onChange={(e) => { setWish(e.target.value); setWishSaved(false); }}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 outline-none" />
                  <button onClick={saveWish} disabled={busy || wishSaved}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-bold px-5 py-2 rounded-full">
                    {wishSaved ? T.myListSaved : T.myListSave}
                  </button>
                </Card>
              </>
            )}
            {result && ev.wishlistOver && <p className="text-center text-xs text-gray-400">{T.wishlistOver}</p>}
            {result && <SoutenirLink className="px-2" />}
            {err && <p className="text-center text-sm text-red-600">{err}</p>}
            <p className="text-xs text-gray-400 leading-relaxed px-1">
              {T.privacy(ev.organizer)}{" "}
              <button onClick={() => setErase(true)} className="underline">{T.eraseLink}</button>
              {" · "}<Link href="/ami-invisible/confidentialite" className="underline">Confidentialité</Link>
            </p>
          </>
        )}

        {ev && erase && (
          <Card>
            <h2 className="font-bold text-gray-800">{T.eraseTitle}</h2>
            {erased || state.me.erased ? (
              <p className="text-gray-700">{T.erased}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 leading-relaxed">{T.eraseExplain(ev.organizer)}</p>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={doErase} disabled={busy} className="flex-1 bg-gray-900 text-white text-sm font-bold py-2.5 rounded-full disabled:opacity-50">{busy ? "⏳" : T.eraseConfirm}</button>
                  <button onClick={() => { setErase(false); if (!result) reveal(); }} className="flex-1 border-2 border-gray-200 text-sm font-bold py-2.5 rounded-full">Annuler</button>
                </div>
              </>
            )}
          </Card>
        )}

        <p className="text-center text-xs text-gray-400"><Link href="/" className="hover:underline">apps360.fr</Link></p>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">{children}</div>;
}

/* Liens cliquables dans une liste de souhaits. */
function linkify(text) {
  return String(text).split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-red-600 underline break-all">{part}</a>
      : part);
}
