"use client";
/*
 * Backoffice — page d'accueil : état (publique / en test), accès, accroche
 * (texte, couleur, dates, aperçu) et ordre des apps. Rien n'est envoyé avant « Enregistrer ».
 */
import { useEffect, useImperativeHandle, useState } from "react";
import AppIcon from "@/components/AppIcon";
import DateInput from "@/components/DateInput";
import HomeCard, { TagChip, TAG_CLS } from "@/components/HomeCard";
import { STATES, ACCESS, TAG_VIVID, TAG_SOFT, VIVID_MAX, TAG_MAX, TAG_PRESETS, cleanTag, activeTag, today } from "@/lib/homeConfig";
import { adminToken } from "./session";

const send = (l) => l.map(({ href, state, access, tag }) => ({ href, state, access, tag: cleanTag(tag) }));
const key = (l) => JSON.stringify(send(l));
const short = (d) => d.split("-").reverse().join("/"); // 25/12/2026
/* Période d'une accroche, en clair. */
const period = (t) => (t.from && t.to ? `du ${short(t.from)} au ${short(t.to)}` : t.to ? `jusqu'au ${short(t.to)}` : t.from ? `à partir du ${short(t.from)}` : "sans limite");
const status = (t) => (activeTag(t) ? "" : t.to && t.to < today() ? " · terminée" : " · pas encore affichée");

export default function HomeSettings({ ref, apps, onSaved, onDirty }) {
  const [list, setList] = useState(apps);
  const [edit, setEdit] = useState(null); // app dont l'accroche est ouverte
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const dirty = key(list) !== key(apps);

  const vivid = list.filter((a) => { const t = cleanTag(a.tag); return a.state === "public" && t && TAG_VIVID[t.color] && activeTag(t); }).length;

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
    // pas de retour à l'écran de connexion : les modifications seraient perdues
    const expired = "Session expirée. Reconnectez-vous au backoffice dans un autre onglet, puis enregistrez ici.";
    if (!token) { setMsg({ ok: false, text: expired }); return false; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/home", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, apps: send(list) }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 ? expired : r.error || "Enregistrement impossible.");
      const saved = list.map((a) => ({ ...a, tag: cleanTag(a.tag) }));
      setList(saved); onSaved(saved);
      setMsg({ ok: true, text: "✓ Enregistré : l'accueil est à jour à la prochaine visite." });
      return true;
    } catch (e) { setMsg({ ok: false, text: e.message }); return false; } finally { setBusy(false); }
  };

  const cancel = () => { setList(apps); setMsg(null); };
  useImperativeHandle(ref, () => ({ save, cancel }));

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
            <span className="flex-1 min-w-[8rem]">
              <span className="block font-bold text-gray-900">{a.title}</span>
              {a.tag?.text?.trim() && <span className="text-xs text-gray-500"><TagChip tag={{ ...a.tag, text: a.tag.text.trim() }} className="text-[11px] px-2 py-0.5 mr-1.5" />{period(a.tag)}{status(a.tag)}</span>}
            </span>
            <button onClick={() => setEdit(edit === a.href ? null : a.href)} aria-expanded={edit === a.href} aria-label={`Accroche de ${a.title}`}
              className="text-sm font-semibold px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50">{edit === a.href ? "▾" : "▸"} Accroche</button>
            <select value={a.access} onChange={(e) => set(i, { access: e.target.value })} disabled={busy} aria-label={`Accès de ${a.title}`}
              className="text-sm border-2 border-gray-200 rounded-xl px-2 py-1.5">
              {Object.entries(ACCESS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div className="flex bg-gray-100 rounded-full p-0.5 text-sm" role="group" aria-label={`Visibilité de ${a.title}`}>
              {Object.entries(STATES).map(([k, l]) => (
                <button key={k} onClick={() => set(i, { state: k })} disabled={busy} aria-pressed={a.state === k}
                  className={`px-3 py-1.5 rounded-full font-bold ${a.state === k ? (k === "public" ? "bg-green-600 text-white" : "bg-amber-400 text-gray-900") : "text-gray-500"}`}>{l}</button>
              ))}
            </div>
            {a.href === "/jukebox" && <p className="w-full text-xs text-gray-500">Accès : à garder d'accord avec « Qui peut créer une soirée ? » (super-admin Jukebox, Réglages).</p>}
            {edit === a.href && <TagEditor app={a} busy={busy} onChange={(tag) => set(i, { tag })} />}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">« En test » : absente de l'accueil public, visible sur l'accueil depuis un appareil connecté au backoffice. Son adresse directe reste ouverte à qui la connaît.</p>
      {vivid > VIVID_MAX && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">💡 {vivid} accroches vives affichées en même temps : elles se font concurrence. Passez-en en couleur douce.</p>}
      {!dirty && msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      {/* toujours visible tant qu'il reste des modifications */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white border-t-2 border-brand-orange shadow-[0_-4px_16px_rgba(0,0,0,0.12)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p role="status" className={`flex-1 min-w-[12rem] text-sm font-semibold ${msg && !msg.ok ? "text-red-600" : "text-amber-700"}`}>{msg && !msg.ok ? msg.text : "Page d'accueil : modifications non enregistrées"}</p>
            <button onClick={cancel} disabled={busy} className="text-sm text-gray-500 underline">Annuler</button>
            <button onClick={save} disabled={busy} className="bg-brand-navy text-white font-bold px-6 py-2.5 rounded-full text-sm disabled:opacity-40">{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Accroche d'une app : texte libre, couleur, dates facultatives, aperçu de la carte. */
function TagEditor({ app, busy, onChange }) {
  const t = app.tag || { text: "", color: "orange", from: "", to: "" };
  const set = (p) => onChange({ ...t, ...p });
  const size = [...t.text].length;
  const wrong = t.from && t.to && t.from > t.to;
  const field = "border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm";
  return (
    <div className="w-full grid gap-4 md:grid-cols-2 bg-gray-50 rounded-xl p-3">
      <div className="space-y-3 text-sm">
        <label className="block space-y-1"><span className="text-xs font-semibold text-gray-600">Texte <span className="font-normal text-gray-400">({size}/{TAG_MAX}, vide : aucune accroche)</span></span>
          <input value={t.text} disabled={busy} placeholder="🎄 Idéal pour Noël" onChange={(e) => set({ text: [...e.target.value].slice(0, TAG_MAX).join("") })} className={`${field} w-full bg-white`} /></label>
        <div className="flex flex-wrap gap-2">
          {TAG_PRESETS.map((x) => <button key={x} type="button" disabled={busy} onClick={() => set({ text: x })} className="text-xs px-3 py-1 rounded-full border border-gray-300 bg-white">{x}</button>)}
          {t.text && <button type="button" disabled={busy} onClick={() => onChange(null)} className="text-xs text-red-600 underline">Retirer</button>}
        </div>
        {[["Vives, pour un temps fort", TAG_VIVID], ["Douces, pour informer", TAG_SOFT]].map(([l, set2]) => (
          <div key={l} role="group" aria-label={`Couleurs ${l}`}>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">{l}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(set2).map(([k, c]) => (
                <button key={k} type="button" disabled={busy} onClick={() => set({ color: k })} aria-pressed={t.color === k}
                  className={`text-xs font-bold px-3 py-1 rounded-full ${TAG_CLS[k]} ${t.color === k ? "ring-2 ring-offset-2 ring-gray-900" : ""}`}>{c}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 text-gray-600">
          Du <DateInput value={t.from} max={t.to || undefined} disabled={busy} onChange={(e) => set({ from: e.target.value })} aria-label="Début" className={`${field} bg-white`} />
          au <DateInput value={t.to} min={t.from || undefined} disabled={busy} onChange={(e) => set({ to: e.target.value })} aria-label="Fin" className={`${field} bg-white`} />
          {(t.from || t.to) && <button type="button" onClick={() => set({ from: "", to: "" })} className="text-xs underline">Sans limite</button>}
        </div>
        {wrong && <p className="text-red-600">La date de début est après la date de fin.</p>}
        <p className="text-xs text-gray-500">Dates facultatives, jours compris. Conseil : une ou deux accroches en tout sur l'accueil.</p>
      </div>
      <div><p className="text-xs font-semibold text-gray-600 mb-1">Aperçu</p><HomeCard app={{ ...app, tag: cleanTag(t) }} preview /></div>
    </div>
  );
}
