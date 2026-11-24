"use client";
/* Ami Invisible — page du lien « Conserver 12 mois de plus » (e-mail d'inactivité). */
import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export default function Keep({ token }) {
  const [state, setState] = useState(null); // { until } | { gone } | { invalid } | { error }
  useEffect(() => {
    fetch("/api/ami-invisible/keep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) })
      .then(async (res) => { const r = await res.json().catch(() => ({})); setState(res.ok ? r : res.status === 404 ? { invalid: true } : { error: r.error || "Service momentanément indisponible." }); })
      .catch(() => setState({ error: "Service momentanément indisponible." }));
  }, [token]);
  const until = state?.until ? new Date(state.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-10 flex justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center space-y-4 h-fit">
        <AppIcon app="ami-invisible" className="w-16 h-16 shadow-lg" />
        <h1 className="text-2xl font-extrabold text-red-600">Ami Invisible</h1>
        {!state && <p className="text-gray-400">Un instant…</p>}
        {until && <p className="text-gray-700">C'est fait : vos tirages et votre carnet sont conservés jusqu'au <b>{until}</b> au moins. Chaque utilisation d'Ami Invisible repousse cette date.</p>}
        {state?.gone && <p className="text-gray-700">Vos données Ami Invisible ont déjà été supprimées.</p>}
        {state?.invalid && <p className="text-gray-700">Ce lien n'est plus valide. Connectez-vous à Ami Invisible : cela conserve aussi vos tirages.</p>}
        {state?.error && <p className="text-red-600">{state.error}</p>}
        <Link href="/ami-invisible" className="inline-block bg-red-500 hover:bg-red-600 text-white font-bold rounded-full px-6 py-3">Mes tirages</Link>
      </div>
    </div>
  );
}
