/*
 * Ami Invisible — lien personnel d'un participant (créé par le super-admin en
 * dépannage, à envoyer par SMS ou messagerie) : affiche son résultat.
 * Lecture serveur à l'ouverture ; lien invalide si le tirage a été supprimé.
 */
import Link from "next/link";
import { readPairToken, loadTirages } from "@/lib/amiInvisibleServer";
import { fillMessage } from "@/lib/amiInvisible";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ami Invisible — apps360", robots: { index: false, follow: false } };

async function pairOf(token) {
  const p = readPairToken(decodeURIComponent(token));
  if (!p) return null;
  try {
    const t = (await loadTirages(p.u)).find((x) => String(x.id) === String(p.t));
    const pair = t?.pairs?.[p.i];
    return pair ? { eventName: t.eventName, text: fillMessage(t.template, pair.offreur, pair.receveur) } : null;
  } catch (e) {
    console.error("ami-invisible lien:", e);
    return null;
  }
}

export default async function PairPage({ params }) {
  const { token } = await params;
  const r = await pairOf(token);
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-5">
        <div className="text-center">
          <div className="text-5xl">🎁</div>
          <h1 className="text-2xl font-extrabold text-red-600 mt-2">Ami Invisible</h1>
          {r && <p className="text-sm text-gray-500 mt-1">{r.eventName}</p>}
        </div>
        {r
          ? <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{r.text}</p>
          : <p className="text-center text-gray-500">Ce lien n'est plus valide. Demandez un nouveau lien à l'organisateur.</p>}
        <p className="text-center text-xs text-gray-400"><Link href="/" className="hover:underline">apps360.fr</Link></p>
      </div>
    </div>
  );
}
