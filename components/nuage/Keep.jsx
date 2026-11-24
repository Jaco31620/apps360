"use client";
/* Nuage de mots — page du lien « Conserver 6 mois de plus » (alerte avant purge). */
import { useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export default function Keep({ token }) {
  const [state, setState] = useState(null); // { until } | { gone } | { error }
  const [busy, setBusy] = useState(false);
  const keep = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/nuage/keep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) });
      const r = await res.json().catch(() => ({}));
      setState(res.ok ? r : { error: r.error || "Service momentanément indisponible." });
    } catch (e) { setState({ error: "Service momentanément indisponible." }); }
    setBusy(false);
  };
  const done = state?.until || state?.gone;
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-violet-50 px-4 py-10 flex justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center space-y-4 h-fit">
        <AppIcon app="nuage" className="w-16 h-16 shadow-lg" />
        <h1 className="text-2xl font-extrabold text-gray-900">Conserver mon nuage</h1>
        {state?.until && <p className="text-gray-700">C'est fait : votre nuage est conservé jusqu'au <b>{new Date(state.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</b> au moins.</p>}
        {state?.gone && <p className="text-gray-700">Ce nuage a déjà été supprimé.</p>}
        {state?.error && <p className="text-red-600">{state.error}</p>}
        {!done && <button onClick={keep} disabled={busy} className="w-full bg-violet-600 disabled:opacity-40 text-white font-bold rounded-full px-6 py-3">Conserver 6 mois de plus</button>}
        <Link href="/nuage" className="block text-sm underline text-gray-500">Mes nuages</Link>
      </div>
    </div>
  );
}
