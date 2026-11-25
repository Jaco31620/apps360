"use client";
/*
 * Nuage de mots — accueil : rejoindre un nuage avec son code, ou en créer un
 * (le créateur devient organisateur et reçoit un jeton gardé en local).
 */
import ContactLink from "@/components/ContactLink";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { myClouds, rememberCloud, setAdminToken, forgetCloud, formatCode } from "@/components/nuage/storage";
import { DEFAULT_MAX_PER_PARTICIPANT, MAX_QUESTION_LEN, MAX_CHOICES, maxLabel } from "@/lib/nuage";
import { bearer } from "@/components/nuage/account";
import { useAuth } from "@/components/AuthProvider";
import SuperBanner from "@/components/admin/SuperBanner";
import AppIcon from "@/components/AppIcon";

export default function NuageHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [max, setMax] = useState(DEFAULT_MAX_PER_PARTICIPANT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState([]);

  const { user } = useAuth();
  const [account, setAccount] = useState([]); // nuages du compte connecté

  useEffect(() => setMine(myClouds()), []);
  useEffect(() => {
    let alive = true;
    setAccount([]);
    if (user) (async () => {
      try {
        const res = await fetch("/api/nuage/mine", { headers: await bearer(), cache: "no-store" });
        const d = await res.json();
        if (alive && res.ok) setAccount(d.nuages);
      } catch (e) { /* liste de l'appareil seulement */ }
    })();
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const owned = new Set(account.map((c) => c.code));
  const list = [...account, ...mine.filter((c) => !owned.has(c.code))]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const join = (e) => {
    e.preventDefault();
    const c = code.replace(/\D/g, "");
    if (c.length === 6) router.push(`/nuage/${c}`);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/nuage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({ question, maxPerParticipant: max }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création impossible.");
      setAdminToken(data.code, data.adminToken);
      rememberCloud(data.code, question.trim());
      router.push(`/nuage/${data.code}/presenter`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = (c) => {
    if (!confirm(`Retirer le nuage ${formatCode(c)} de cette liste ?\n(Gardez le code organisateur pour le retrouver.)`)) return;
    forgetCloud(c);
    setMine(myClouds());
  };

  return (
    <>
    <SuperBanner app="nuage" />
    <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-sky-500 to-violet-600 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 text-white text-sm">
          <Link href="/" className="font-bold opacity-90 hover:opacity-100">← apps360</Link>
        </div>

        <div className="text-center text-white mb-10">
          <AppIcon app="nuage" className="w-20 h-20 mb-4 shadow-xl" />
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Nuage de mots</h1>
          <p className="mt-3 text-white/85 text-lg">Posez une question, le public répond depuis son téléphone : les mots les plus cités grossissent en direct.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <form onSubmit={join} className="bg-white rounded-3xl p-7 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Participer</h2>
            <p className="text-sm text-gray-500">Saisissez le code affiché à l'écran.</p>
            <input
              inputMode="numeric" autoComplete="off" placeholder="123 456" value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
              className="w-full text-center text-3xl font-bold tracking-[0.3em] border-2 border-gray-200 rounded-2xl py-3 focus:border-sky-500 outline-none"
            />
            <button disabled={code.replace(/\D/g, "").length !== 6}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-bold py-3 rounded-full transition-colors">
              Rejoindre
            </button>
          </form>

          <form onSubmit={create} className="bg-white rounded-3xl p-7 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Créer un nuage</h2>
            <textarea
              rows={2} maxLength={MAX_QUESTION_LEN} placeholder="Ex. : Quel mot résume votre journée ?"
              value={question} onChange={(e) => setQuestion(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 focus:border-violet-500 outline-none resize-none"
            />
            <label className="flex items-center justify-between text-sm text-gray-600">
              Mots par participant
              <select value={max} onChange={(e) => setMax(Number(e.target.value))}
                className="border-2 border-gray-200 rounded-xl px-3 py-1.5 font-semibold">
                {MAX_CHOICES.map((n) => <option key={n} value={n}>{maxLabel(n)}</option>)}
              </select>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy || !question.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-full transition-colors">
              {busy ? "Création…" : "Lancer le nuage"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/85">
          {user ? `Connecté : ${user.email} — vos nouveaux nuages sont enregistrés dans votre compte.`
            : <><Link href="/connexion?next=/nuage" className="underline font-semibold">Connectez-vous</Link> pour retrouver vos nuages sur tous vos appareils (facultatif).</>}
          {" "}<Link href="/nuage/confidentialite" className="underline">Vos données</Link>{" · "}<ContactLink app="nuage" />
        </p>

        {list.length > 0 && (
          <div className="mt-8 bg-white/95 rounded-3xl p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-3">Mes nuages</h2>
            <ul className="divide-y divide-gray-100">
              {list.map((c) => (
                <li key={c.code} className="flex items-center gap-3 py-3">
                  <span className="font-mono font-bold text-violet-600 shrink-0">{formatCode(c.code)}</span>
                  <span className="flex-1 min-w-0 truncate text-gray-700">{c.question}</span>
                  <Link href={`/nuage/${c.code}/presenter`} className="text-sm font-semibold text-sky-600 hover:underline shrink-0">Organiser</Link>
                  {owned.has(c.code)
                    ? <span className="text-xs text-gray-400 shrink-0">compte</span>
                    : <button onClick={() => remove(c.code)} className="text-gray-300 hover:text-red-500 shrink-0" aria-label="Retirer">✕</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
