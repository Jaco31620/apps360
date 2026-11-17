"use client";
/* Les titres joués pendant la soirée, à retrouver ensuite : heure de passage
 * (précédée de JJ/MM si la soirée s'étend sur plusieurs dates),
 * ❤️ J'aime reçus (s'il y a eu des votes), tri par passage ou par cœurs. */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatCode } from "@/components/jukebox/storage";

const hour = (iso) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }) : "");
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }) : "");
const SORTS = [
  { id: "time", label: "🕘 Ordre de passage" },
  { id: "likes", label: "❤️ Les plus aimés" },
];

export default function PlaylistPage({ params }) {
  const { code } = use(params);
  const [d, setD] = useState(undefined);
  const [sort, setSort] = useState("time");
  useEffect(() => {
    fetch(`/api/jukebox/${code}/playlist`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, [code]);
  const tracks = d?.tracks || [];
  const voted = tracks.some((t) => t.likes > 0);
  const manyDays = new Set(tracks.map((t) => day(t.playedAt))).size > 1; // JJ/MM seulement si plusieurs dates
  const shown = voted && sort === "likes"
    ? tracks.filter((t) => t.likes > 0).sort((a, b) => b.likes - a.likes || String(a.playedAt).localeCompare(String(b.playedAt)))
    : tracks;
  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-5">
        <Link href={`/jukebox/${code}`} className="text-white/80 text-sm font-bold">← Soirée {formatCode(code)}</Link>
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Jukebox · les titres de la soirée</p>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-4">{d?.name || "…"}</h1>
          {d === undefined && <p className="text-gray-400">Chargement…</p>}
          {d === null && <p className="text-gray-500">Cette soirée n'existe pas (ou plus).</p>}
          {d && tracks.length === 0 && <p className="text-gray-500">Aucun titre joué pour l'instant.</p>}
          {voted && (
            <div className="flex bg-gray-100 rounded-full p-0.5 mb-3 text-sm">
              {SORTS.map((o) => (
                <button key={o.id} onClick={() => setSort(o.id)}
                  className={`flex-1 px-3 py-1.5 rounded-full font-bold ${sort === o.id ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>{o.label}</button>
              ))}
            </div>
          )}
          {shown.length > 0 && (
            <ol className="divide-y divide-gray-100">
              {shown.map((t, i) => (
                <li key={i} className="py-2.5 flex items-center gap-3">
                  <span className={`${manyDays ? "w-[4.5rem]" : "w-11"} text-xs text-gray-400 tabular-nums shrink-0`}>{manyDays && `${day(t.playedAt)} `}{hour(t.playedAt)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900 text-sm truncate">{t.title}</span>
                    <span className="block text-xs text-gray-500 truncate">{t.artist}</span>
                  </span>
                  {t.likes > 0 && <span className="shrink-0 text-sm font-bold text-rose-600 tabular-nums">❤️ {t.likes}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
