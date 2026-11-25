"use client";
/*
 * Backoffice — messages du formulaire de contact : à traiter d'abord, réponse
 * envoyée d'ici (de contact@) ou notée après coup, note interne, suppression.
 * Chargés une fois à l'ouverture (bouton Actualiser), aucune requête répétée.
 */
import { useCallback, useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import AppIcon from "@/components/AppIcon";
import { KINDS, STATUS, SITE_APP, appTitle, refOf, isLate, safeName } from "@/lib/contact";
import { adminToken } from "./session";

const when = (d) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const model = (m) => `Bonjour${safeName(m.name) ? ` ${m.name}` : ""},\n\n\n\nBien à vous,\napps360`;
const btn = "text-sm font-semibold px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-40";

export async function messagesApi(body) {
  const token = adminToken();
  if (!token) throw Object.assign(new Error("Session expirée : reconnectez-vous."), { status: 401 });
  const res = await fetch("/api/admin/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...body }) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Action impossible, réessayez."), { status: res.status });
  return r;
}

export default function Messages({ focus, onCount, onExpired }) {
  const [list, setList] = useState(null);
  const [tab, setTab] = useState("todo");
  const [app, setApp] = useState("");
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState(null);
  const [drafts, setDrafts] = useState({}); // réponses en cours, gardées au repli
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const { messages } = await messagesApi({ action: "list" });
      setList(messages);
      const m = focus && messages.find((x) => String(x.num) === focus);
      if (m) { setTab(m.status); setOpen(m.id); }
      else if (focus) setErr(`Message A-${focus} introuvable : il a peut-être été supprimé.`);
    } catch (e) { if (e.status === 401) onExpired(); else setErr(e.message); }
  }, [focus, onExpired]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (list) onCount({ todo: list.filter((m) => m.status === "todo").length, late: list.filter((m) => isLate(m)).length }); }, [list, onCount]);
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setDraft = (id, v) => setDrafts((d) => { const n = { ...d }; if (v === null) delete n[id]; else n[id] = v; return n; });
  const update = (m) => setList((l) => l.map((x) => (x.id === m.id ? m : x)));
  const remove = (id) => { setList((l) => l.filter((x) => x.id !== id)); setDraft(id, null); };

  if (!list) return err ? <p className="text-sm text-red-600">{err} <button onClick={load} className="underline">Réessayer</button></p> : <p className="text-sm text-gray-500">Chargement…</p>;
  const n = (s) => list.filter((m) => m.status === s).length;
  // le message ouvert reste affiché après un changement d'état
  const shown = list.filter((m) => (m.status === tab || m.id === open) && (!app || m.app === app) && (!kind || m.kind === kind));
  const select = "text-sm border-2 border-gray-200 rounded-xl px-2 py-1.5 max-w-full";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 rounded-full p-0.5 text-sm" role="group" aria-label="État">
          {Object.entries(STATUS).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setOpen(null); }} aria-pressed={tab === k} className={`px-3 py-1.5 rounded-full font-bold ${tab === k ? "bg-brand-navy text-white" : "text-gray-600"}`}>{l} {n(k)}</button>
          ))}
        </div>
        <select value={app} onChange={(e) => setApp(e.target.value)} aria-label="App" className={select}>
          <option value="">Toutes les apps</option>
          {[...new Set(list.map((m) => m.app))].map((k) => <option key={k} value={k}>{appTitle(k)}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Sujet" className={select}>
          <option value="">Tous les sujets</option>
          {Object.entries(KINDS).map(([k, x]) => <option key={k} value={k}>{x.short}</option>)}
        </select>
        <button onClick={load} className="text-sm text-gray-500 underline">Actualiser</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {shown.length === 0 && <p className="text-sm text-gray-500 py-2">{tab === "todo" && !app && !kind ? "Aucun message à traiter 👌" : "Aucun message."}</p>}
      <ul className="divide-y divide-gray-100">
        {shown.map((m) => (
          <li key={m.id} className="py-1">
            <button onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id} className="w-full flex items-start gap-2.5 text-left py-2">
              {m.app === SITE_APP ? <img src="/brand/apps360-symbole.svg" alt="" className="w-8 h-8 shrink-0" /> : <AppIcon app={m.app} className="w-8 h-8" />}
              <span className="flex-1 min-w-0">
                <span className="block text-sm"><b>{KINDS[m.kind]?.icon} {appTitle(m.app)}</b> · {m.name || m.email || "sans adresse"} <span className="text-gray-400">· {refOf(m.num)}</span></span>
                {open !== m.id && <span className="block text-sm text-gray-600 truncate">{m.message}</span>}
                <span className="block text-xs text-gray-500">{when(m.created_at)}{m.answered_at && ` · répondu le ${day(m.answered_at)}`}{m.note && " · 📝"}
                  {isLate(m) && <span className="ml-1.5 font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">en attente depuis plus de 3 jours</span>}
                  {drafts[m.id] != null && <span className="ml-1.5 font-semibold text-amber-700">réponse non envoyée</span>}
                  {m.status !== tab && <span className="ml-1.5 font-bold text-green-700">→ {STATUS[m.status]}</span>}</span>
              </span>
              <span className="text-gray-400" aria-hidden="true">{open === m.id ? "▾" : "▸"}</span>
            </button>
            {open === m.id && <Detail m={m} draft={drafts[m.id]} setDraft={(v) => setDraft(m.id, v)} onUpdate={update} onRemove={remove} onExpired={onExpired} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ m, draft, setDraft, onUpdate, onRemove, onExpired }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mark, setMark] = useState(null); // date de « J'ai répondu par mail »
  const [note, setNote] = useState(m.note || "");
  const run = async (body, ok, then) => {
    setBusy(true); setMsg(null);
    try {
      const r = await messagesApi({ id: m.id, ...body });
      then?.();
      if (body.action === "delete") return onRemove(m.id);
      onUpdate(r.message);
      setMsg({ ok: true, text: ok });
    } catch (e) { if (e.status === 401) onExpired(); else setMsg({ text: e.message }); } finally { setBusy(false); }
  };
  const writing = draft != null;
  return (
    <div className="pb-3 space-y-3 sm:pl-10">
      <p className="whitespace-pre-wrap break-words text-sm bg-gray-50 border border-gray-100 rounded-xl p-3">{m.message}</p>
      <p className="text-xs text-gray-500 break-words">{m.email || "Pas d'adresse laissée : pas de réponse possible."}{m.device && ` · ${m.device}`}</p>
      {(m.replies || []).map((r, i) => (
        <div key={i} className="text-sm border-l-4 border-green-500 pl-3">
          <p className="text-xs font-semibold text-green-700">{r.via === "back" ? `Réponse envoyée le ${when(r.at)}` : `Répondu par mail le ${day(r.at)}`}</p>
          {r.text && <p className="whitespace-pre-wrap break-words text-gray-700">{r.text}</p>}
        </div>
      ))}
      {writing && (
        <div className="space-y-2">
          <textarea autoFocus rows={9} value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)} aria-label="Réponse" className="w-full border-2 border-gray-200 rounded-xl p-3 text-base focus:border-brand-orange outline-none" />
          <p className="text-xs text-gray-500">Envoyée de contact@apps360.fr à <b>{m.email}</b>, son message rappelé dessous. Copie dans votre boîte contact@.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy || !draft.trim() || draft.trim() === model(m).trim()} onClick={() => run({ action: "reply", text: draft }, "✓ Réponse envoyée.", () => setDraft(null))} className="bg-brand-navy text-white font-bold px-5 py-2 rounded-full text-sm disabled:opacity-40">{busy ? "Envoi…" : "Envoyer la réponse"}</button>
            <button disabled={busy} onClick={() => (draft === model(m) || confirm("Abandonner cette réponse ?")) && setDraft(null)} className="text-sm text-gray-500 underline">Annuler</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {m.email && !writing && <button onClick={() => { setMsg(null); setDraft(model(m)); }} disabled={busy} className="text-sm font-bold px-4 py-1.5 rounded-full bg-gray-900 text-white disabled:opacity-40">{m.replies?.length ? "Répondre encore" : "Répondre"}</button>}
        {m.email && <button onClick={() => setMark(mark ? null : isoToday())} disabled={busy} className={btn}>J'ai répondu par mail</button>}
        {m.status !== "closed" && <button onClick={() => run({ action: "status", status: "closed" }, "✓ Classé.")} disabled={busy} className={btn}>Classer</button>}
        {m.status !== "todo" && <button onClick={() => run({ action: "status", status: "todo" }, "✓ Remis à traiter.")} disabled={busy} className={btn}>Remettre à traiter</button>}
        <button onClick={() => confirm(`Supprimer définitivement le message ${refOf(m.num)} et ses réponses ?\nLes copies de votre boîte mail ne sont pas supprimées.`) && run({ action: "delete" })} disabled={busy} className="text-xs text-red-500 underline ml-auto">Supprimer</button>
      </div>
      {mark && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Répondu le <DateInput value={mark} max={isoToday()} onChange={(e) => setMark(e.target.value)} aria-label="Date de réponse" className="border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white" />
          <button disabled={busy || !mark} onClick={() => run({ action: "mark", day: mark }, "✓ Noté comme répondu.", () => setMark(null))} className={btn}>Valider</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={note} maxLength={2000} disabled={busy} onChange={(e) => setNote(e.target.value)} placeholder="📝 Note interne (jamais envoyée)" aria-label="Note interne" className="flex-1 min-w-[12rem] border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm" />
        {note.trim() !== (m.note || "") && <button disabled={busy} onClick={() => run({ action: "note", note }, "✓ Note enregistrée.")} className={btn}>Enregistrer la note</button>}
      </div>
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
