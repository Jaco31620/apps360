"use client";
/*
 * Super-admin — statistiques (soirées par mois, titres joués, demandes,
 * codes) et exports CSV des soirées et des demandes. Calculé à partir des
 * données déjà chargées (soirées non supprimées, 30 dernières demandes traitées).
 * ❤️ J'aime cumulés par chanson du catalogue (SQL v39), chargés à part.
 */
import { useEffect, useState } from "react";
import { formatCode, getSuperToken } from "../storage";

const monthKey = (iso) => String(iso || "").slice(0, 7);
const monthLabel = (k) => new Date(`${k}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function csv(rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\n"); // BOM + « ; » : ouverture directe dans Excel
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");

export function Stats({ sessions = [], requests, activations }) {
  const months = {};
  for (const s of sessions) {
    const m = (months[monthKey(s.createdAt)] ||= { parties: 0, played: 0 });
    m.parties++;
    m.played += s.played;
  }
  const keys = Object.keys(months).sort().reverse();
  const played = sessions.reduce((n, s) => n + s.played, 0);
  const used = sessions.filter((s) => s.played > 0).length;
  const req = requests || [];
  const reqBy = (st) => req.filter((r) => r.status === st).length;
  const approved = req.filter((r) => r.status === "approved");
  const converted = approved.filter((r) => (activations || []).find((a) => a.id === r.activationId)?.used > 0).length;
  const acts = activations || [];

  const exportSessions = () => download(`jukebox-soirees-${day(Date.now())}.csv`, csv([
    ["Code", "Nom", "Organisateur", "Créée le", "Titres joués", "En attente", "Dernière activité", "Fermeture", "État"],
    ...sessions.map((s) => [formatCode(s.code), s.name, s.organizer || "", day(Date.parse(s.createdAt)), s.played, s.queued, day(s.lastActivity), day(s.endsAt),
      s.closedReason ? "fermée" : "ouverte"]),
  ]));
  const exportRequests = () => download(`jukebox-demandes-${day(Date.now())}.csv`, csv([
    ["Reçue le", "Nom", "E-mail", "Date de la soirée", "Invités", "Message", "État", "Traitée le", "Code"],
    ...req.map((r) => [day(Date.parse(r.createdAt)), r.name, r.email, r.date || "", r.guests || "", r.message || "",
      { pending: "en attente", approved: "validée", rejected: "refusée" }[r.status] || r.status, day(Date.parse(r.handledAt)), acts.find((a) => a.id === r.activationId)?.code || ""]),
  ]));

  const Tile = ({ label, value, sub }) => (
    <div className="bg-white rounded-2xl border border-purple-100 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="🎉 Soirées" value={sessions.length} sub={`${used} avec de la musique`} />
        <Tile label="🎵 Titres joués" value={played} sub={used ? `${Math.round(played / used)} par soirée en moyenne` : null} />
        <Tile label="📥 Demandes" value={req.length} sub={requests == null ? "table v23 absente" : `${reqBy("pending")} en attente · ${approved.length} validées · ${reqBy("rejected")} refusées`} />
        <Tile label="🎟️ Codes utilisés" value={`${acts.filter((a) => a.used > 0).length} / ${acts.length}`} sub={approved.length ? `${converted} demande${converted > 1 ? "s" : ""} validée${converted > 1 ? "s" : ""} → soirée créée` : null} />
      </div>
      <div className="bg-white rounded-2xl border border-purple-100 p-4">
        <h2 className="font-bold text-gray-900 mb-2">Par mois</h2>
        {keys.length === 0 ? <p className="text-sm text-gray-400">Aucune soirée.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1 font-semibold">Mois</th><th className="font-semibold text-right">Soirées</th><th className="font-semibold text-right">Titres joués</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className="border-t border-gray-100"><td className="py-1.5 capitalize">{monthLabel(k)}</td><td className="text-right tabular-nums">{months[k].parties}</td><td className="text-right tabular-nums">{months[k].played}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-gray-400 mt-2">Soirées encore présentes (les soirées supprimées ne comptent plus) ; demandes : en attente + 30 dernières traitées.</p>
      </div>
      <LikeStats />
      <div className="flex flex-wrap gap-2">
        <button onClick={exportSessions} className="font-bold bg-gray-900 text-white px-4 py-2 rounded-full text-sm">⬇️ Exporter les soirées (CSV)</button>
        {requests != null && <button onClick={exportRequests} className="font-bold bg-gray-100 px-4 py-2 rounded-full text-sm">⬇️ Exporter les demandes (CSV)</button>}
      </div>
    </div>
  );
}

/* ❤️ J'aime cumulés par chanson : taux = cœurs / votants présents aux passages
 * (lib/jukeboxVotes recordPassLikes). Minimum de passages réglable : avec un
 * seul passage, le taux ne veut pas dire grand-chose. */
const LIKE_SORTS = [
  { id: "rate", label: "Taux" },
  { id: "likes", label: "Cœurs" },
  { id: "passes", label: "Passages" },
];
const pct = (s) => (s.audience ? Math.round((100 * s.likes) / s.audience) : 0);

function LikeStats() {
  const [d, setD] = useState(undefined);
  const [sort, setSort] = useState("rate");
  const [minPasses, setMinPasses] = useState(2);
  const [all, setAll] = useState(false);
  useEffect(() => {
    fetch("/api/jukebox/super?likes=1", { cache: "no-store", headers: { "x-jukebox-super": getSuperToken() || "" } })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setD(j?.likes ?? null)).catch(() => setD(null));
  }, []);
  const box = (body) => (
    <div className="bg-white rounded-2xl border border-purple-100 p-4">
      <h2 className="font-bold text-gray-900 mb-2">❤️ J'aime par chanson</h2>
      {body}
    </div>
  );
  if (d === undefined) return box(<p className="text-sm text-gray-400">Chargement…</p>);
  if (d === null) return box(<p className="text-sm text-gray-400">Indisponible (colonnes SQL v39 absentes ?).</p>);
  if (!d.songs.length) return box(<p className="text-sm text-gray-400">Pas encore de données : elles s'accumulent à la fin de chaque titre joué dans une soirée avec les votes activés.</p>);
  const key = { rate: (x) => x.likes / (x.audience || 1), likes: (x) => x.likes, passes: (x) => x.passes }[sort];
  const rows = d.songs.filter((x) => x.passes >= minPasses).sort((a, b) => key(b) - key(a) || b.likes - a.likes || b.passes - a.passes);
  const shown = all ? rows : rows.slice(0, 30);
  const t = d.totals;
  const exportCsv = () => download(`jukebox-jaime-${day(Date.now())}.csv`, csv([
    ["Interprète", "Titre", "Passages comptés", "Cœurs", "Votants présents", "Taux %", "Écoutes"],
    ...d.songs.map((x) => [x.artist, x.title, x.passes, x.likes, x.audience, pct(x), x.plays]),
  ]));
  return box(
    <>
      <div className="grid grid-cols-3 gap-3 mb-3 text-center">
        <div><p className="text-xl font-black tabular-nums">{t.likes}</p><p className="text-xs text-gray-500">cœurs</p></div>
        <div><p className="text-xl font-black tabular-nums">{t.audience ? Math.round((100 * t.likes) / t.audience) : 0} %</p><p className="text-xs text-gray-500">taux moyen</p></div>
        <div><p className="text-xl font-black tabular-nums">{t.songs}</p><p className="text-xs text-gray-500">chansons · {t.passes} passages</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        <span className="text-gray-500">Trier par</span>
        <div className="flex bg-gray-100 rounded-full p-0.5">
          {LIKE_SORTS.map((o) => (
            <button key={o.id} onClick={() => setSort(o.id)}
              className={`px-3 py-1 rounded-full font-bold ${sort === o.id ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>{o.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-gray-500">
          au moins
          <select value={minPasses} onChange={(e) => setMinPasses(Number(e.target.value))} className="border border-gray-200 rounded-lg px-1.5 py-0.5 font-semibold text-gray-900">
            {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          passage{minPasses > 1 ? "s" : ""}
        </label>
      </div>
      {rows.length === 0 ? <p className="text-sm text-gray-400">Aucune chanson avec autant de passages.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-400">
            <th className="py-1 font-semibold">Chanson</th><th className="font-semibold text-right">Passages</th>
            <th className="font-semibold text-right">❤️</th><th className="font-semibold text-right" title="Votants présents cumulés">Votants</th><th className="font-semibold text-right">Taux</th>
          </tr></thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-2"><span className="font-semibold text-gray-900">{x.title}</span> <span className="text-gray-500">— {x.artist}</span></td>
                <td className="text-right tabular-nums">{x.passes}</td>
                <td className="text-right tabular-nums">{x.likes}</td>
                <td className="text-right tabular-nums text-gray-500">{x.audience}</td>
                <td className="text-right tabular-nums font-bold">{pct(x)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-2">
        {rows.length > 30 && <button onClick={() => setAll(!all)} className="text-sm font-semibold text-purple-700 underline">{all ? "Afficher les 30 premières" : `Tout afficher (${rows.length})`}</button>}
        <button onClick={exportCsv} className="text-sm font-bold bg-gray-100 px-3 py-1.5 rounded-full">⬇️ CSV</button>
      </div>
      <p className="text-xs text-gray-400 mt-2">Taux = cœurs ÷ votants présents (invités ayant voté dans la soirée depuis 30 min avant le titre, hors auteur du titre), cumulé sur tous les passages. Gardé même quand les soirées sont supprimées.</p>
    </>
  );
}
