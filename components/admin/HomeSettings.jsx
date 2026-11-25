"use client";
/*
 * Backoffice — page d'accueil : état (publique / en test), étiquette et ordre
 * des apps. Rien n'est envoyé avant « Enregistrer ».
 */
import { useEffect, useState } from "react";
import AppIcon from "@/components/AppIcon";
import { STATES, BADGES } from "@/lib/homeConfig";
import { adminToken } from "./session";

const key = (l) => JSON.stringify(l.map(({ href, state, badge }) => [href, state, badge]));

export default function HomeSettings({ apps, onSaved, onDirty, onExpired }) {
  const [list, setList] = useState(apps);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const dirty = key(list) !== key(apps);

  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (i, patch) => { setMsg(null); setList((l) => l.map((a, k) => (k === i ? { ...a, ...patch } : a))); };
  const move = (i, d) => { setMsg(null); setList((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); };
  const save = async () => {
    const token = adminToken();
    if (!token) return onExpired();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/home", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, apps: list.map(({ href, state, badge }) => ({ href, state, badge })) }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || "Enregistrement impossible.");
      onSaved(list);
      setMsg({ ok: true, text: "✓ Enregistré : l'accueil est à jour à la prochaine visite." });
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  const arrow = "w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 font-bold disabled:opacity-30";
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100">
        {list.map((a, i) => (
          <li key={a.href} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Monter ${a.title}`} className={arrow}>↑</button>
              <button onClick={() => move(i, 1)} disabled={busy || i === list.length - 1} aria-label={`Descendre ${a.title}`} className={arrow}>↓</button>
            </div>
            <AppIcon app={a.icon} className="w-8 h-8" />
            <span className="flex-1 min-w-[8rem] font-bold text-gray-900">{a.title}</span>
            <select value={a.badge} onChange={(e) => set(i, { badge: e.target.value })} disabled={busy} aria-label={`Étiquette de ${a.title}`}
              className="text-sm border-2 border-gray-200 rounded-xl px-2 py-1.5">
              {BADGES.map((b) => <option key={b} value={b}>{b || "Sans étiquette"}</option>)}
            </select>
            <div className="flex bg-gray-100 rounded-full p-0.5 text-sm" role="group" aria-label={`Visibilité de ${a.title}`}>
              {Object.entries(STATES).map(([k, l]) => (
                <button key={k} onClick={() => set(i, { state: k })} disabled={busy} aria-pressed={a.state === k}
                  className={`px-3 py-1.5 rounded-full font-bold ${a.state === k ? (k === "public" ? "bg-green-600 text-white" : "bg-amber-400 text-gray-900") : "text-gray-500"}`}>{l}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">« En test » : absente de l'accueil public, visible sur l'accueil depuis un appareil connecté au backoffice. Son adresse directe reste ouverte à qui la connaît.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="bg-brand-navy text-white font-bold px-5 py-2 rounded-full text-sm disabled:opacity-40">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        {dirty && !busy && <button onClick={() => { setList(apps); setMsg(null); }} className="text-sm text-gray-500 underline">Annuler</button>}
        {dirty && !msg && <span className="text-sm font-semibold text-amber-700">Modifié, non enregistré</span>}
        {msg && <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
