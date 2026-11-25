"use client";
/*
 * Backoffice — messages du formulaire de contact (/admin/messages, ?m=1042 : un message).
 * Ordinateur : liste à gauche, message à droite. Téléphone : un écran à la fois.
 * Chargés une fois (bouton Actualiser), aucune requête répétée. Réponses en cours
 * gardées sur l'appareil.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DateInput from "@/components/DateInput";
import AppIcon from "@/components/AppIcon";
import { KINDS, STATUS, SITE_APP, appTitle, refOf, isLate, safeName } from "@/lib/contact";
import AdminBar from "./AdminBar";
import Login from "./Login";
import { messagesApi } from "./messagesApi";
import { adminToken, REPLIES } from "./session";

const when = (d) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const model = (m) => `Bonjour${safeName(m.name) ? ` ${m.name}` : ""},\n\n\n\nBien à vous,\napps360`;
const flat = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const matches = (m, q) => { const t = flat([refOf(m.num), m.name, m.email, m.message, m.note, appTitle(m.app), ...(m.replies || []).map((r) => r.text)].join(" ")); return flat(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w)); };
const btn = "text-sm font-semibold px-3 py-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40";
const Icon = ({ app, className = "w-8 h-8" }) => (app === SITE_APP ? <img src="/brand/apps360-symbole.svg" alt="" className={`shrink-0 ${className}`} /> : <AppIcon app={app} className={className} />);
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(REPLIES)) || {}; } catch (e) { return {}; } };

export default function Messages() {
  const [authed, setAuthed] = useState(undefined);
  useEffect(() => { setAuthed(!!adminToken()); }, []);
  const expired = useCallback(() => setAuthed(false), []);
  if (authed === undefined) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Inbox onExpired={expired} />;
}

function Inbox({ onExpired }) {
  const num = useSearchParams().get("m");
  const [list, setList] = useState(null);
  const [tab, setTab] = useState("todo");
  const [app, setApp] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pushed = useRef(false); // message ouvert depuis la liste : « retour » = page précédente
  const listY = useRef(0);
  const num0 = useRef(num);

  const load = useCallback(async () => {
    setErr(""); setBusy(true);
    try {
      const { messages } = await messagesApi({ action: "list" });
      setList(messages);
      const first = messages.find((x) => String(x.num) === num0.current);
      if (first) setTab(first.status); // lien direct : l'onglet suit le message (première fois)
      num0.current = null;
    } catch (e) { if (e.status === 401) onExpired(); else setErr(e.message); } finally { setBusy(false); }
  }, [onExpired]);
  useEffect(() => { setDrafts(readDrafts()); load(); }, [load]);

  // téléphone : haut de page à l'ouverture d'un message, liste retrouvée au retour
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    window.scrollTo(0, num ? 0 : listY.current);
    if (!num) pushed.current = false;
  }, [num]);

  const setDraft = (id, v) => setDrafts((d) => {
    const n = { ...d };
    if (v === null) delete n[id]; else n[id] = v;
    try { localStorage.setItem(REPLIES, JSON.stringify(n)); } catch (e) { /* ignoré */ }
    return n;
  });
  const open = (n) => {
    const url = `/admin/messages?m=${n}`;
    if (num) window.history.replaceState(null, "", url);
    else { listY.current = window.scrollY; pushed.current = true; window.history.pushState(null, "", url); }
  };
  const close = () => {
    if (pushed.current) window.history.back();
    else window.history.replaceState(null, "", "/admin/messages");
  };
  const update = (m) => setList((l) => l.map((x) => (x.id === m.id ? m : x)));
  const remove = (m) => { setList((l) => l.filter((x) => x.id !== m.id)); setDraft(m.id, null); close(); };

  const all = list || [];
  const n = (s) => all.filter((m) => m.status === s).length;
  const late = all.filter((m) => isLate(m)).length;
  const search = q.trim();
  const pass = (m) => (!app || m.app === app) && (!kind || m.kind === kind) && (!search || matches(m, search));
  // recherche : dans tous les états ; message ouvert : reste affiché après un changement d'état
  const shown = all.filter((m) => (search ? pass(m) : (m.status === tab && pass(m)) || String(m.num) === num));
  const cur = num ? all.find((m) => String(m.num) === num) : null;
  const todo = cur ? all.filter((m) => m.status === "todo" && m.id !== cur.id) : [];
  // suivant : le plus ancien à traiter
  const next = todo[todo.length - 1];
  const select = "text-sm border-2 border-gray-200 rounded-xl px-2 py-2 bg-white flex-1 min-w-0";

  return (
    <div className="min-h-screen bg-brand-cream text-gray-900 md:h-screen md:flex md:flex-col">
      <AdminBar current="admin" />
      <main className="w-full max-w-6xl mx-auto px-4 py-4 md:flex-1 md:min-h-0 md:flex md:flex-col">
        <div className={`${num ? "hidden md:flex" : "flex"} flex-wrap items-baseline gap-x-4 gap-y-1 mb-3`}>
          <Link href="/admin" className="text-sm font-semibold text-gray-500 hover:text-brand-navy">← Backoffice</Link>
          <h1 className="font-outfit text-2xl font-extrabold text-brand-navy">Messages reçus</h1>
          {late > 0 && <span className="text-sm font-bold text-orange-700">{late} en attente depuis plus de 3 jours</span>}
          <button onClick={load} disabled={busy} className="ml-auto text-sm text-gray-500 underline disabled:opacity-40">{busy ? "Chargement…" : "Actualiser"}</button>
        </div>
        {err && <p role="alert" className="text-sm font-semibold text-red-600 mb-2">{err}</p>}

        <div className="md:flex-1 md:min-h-0 md:grid md:grid-cols-[21rem_minmax(0,1fr)] md:gap-4">
          <section aria-label="Liste" className={`${num ? "hidden md:flex" : "flex"} flex-col min-h-0 bg-white rounded-2xl border border-gray-200`}>
            <div className="p-3 space-y-2 border-b border-gray-100">
              <div className="flex gap-2">
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, A-1042, mot…" aria-label="Rechercher" className="flex-1 min-w-0 border-2 border-gray-200 rounded-xl px-3 py-2 text-base md:text-sm focus:border-brand-orange outline-none" />
                <button onClick={() => setFilters(!filters)} aria-expanded={filters} className={`${btn} ${app || kind ? "border-brand-orange text-brand-navy" : ""}`}>Filtres{app || kind ? " •" : ""}</button>
              </div>
              {filters && (
                <div className="flex gap-2">
                  <select value={app} onChange={(e) => setApp(e.target.value)} aria-label="App" className={select}>
                    <option value="">Toutes les apps</option>
                    {[...new Set(all.map((m) => m.app))].map((k) => <option key={k} value={k}>{appTitle(k)}</option>)}
                  </select>
                  <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Sujet" className={select}>
                    <option value="">Tous les sujets</option>
                    {Object.entries(KINDS).map(([k, x]) => <option key={k} value={k}>{x.short}</option>)}
                  </select>
                </div>
              )}
              {search
                ? <p className="text-xs text-gray-500">{shown.length} résultat{shown.length > 1 ? "s" : ""}, tous états confondus</p>
                : (
                  <div className="flex bg-gray-100 rounded-full p-0.5 text-sm" role="group" aria-label="État">
                    {Object.entries(STATUS).map(([k, l]) => (
                      <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`flex-1 whitespace-nowrap px-2 py-1.5 rounded-full font-bold ${tab === k ? "bg-brand-navy text-white" : "text-gray-600"}`}>{l} {n(k)}</button>
                    ))}
                  </div>
                )}
            </div>
            <ul className="divide-y divide-gray-100 md:overflow-y-auto md:flex-1">
              {list && shown.length === 0 && <li className="text-sm text-gray-500 p-4">{!search && tab === "todo" && !app && !kind ? "Aucun message à traiter 👌" : "Aucun message."}</li>}
              {!list && !err && <li className="text-sm text-gray-500 p-4">Chargement…</li>}
              {shown.map((m) => (
                <li key={m.id}>
                  <button onClick={() => open(m.num)} aria-current={String(m.num) === num ? "true" : undefined}
                    className={`w-full flex items-start gap-2.5 text-left px-3 py-3 ${String(m.num) === num ? "bg-[#E6ECF8]" : "hover:bg-gray-50"}`}>
                    <Icon app={m.app} />
                    <span className="flex-1 min-w-0">
                      <span className="flex gap-2 text-sm"><b className="truncate flex-1">{KINDS[m.kind]?.icon} {m.name || m.email || "Sans adresse"}</b><span className="text-xs text-gray-400 shrink-0">{refOf(m.num)}</span></span>
                      <span className="block text-sm text-gray-600 truncate">{m.message}</span>
                      <span className="block text-xs text-gray-500">{day(m.created_at)}{m.answered_at && ` · répondu le ${day(m.answered_at)}`}{m.note && " · 📝"}</span>
                      {(isLate(m) || drafts[m.id] != null || search || m.status !== tab) && (
                        <span className="flex flex-wrap gap-x-2 text-xs font-bold">
                          {isLate(m) && <span className="text-orange-700">En attente depuis plus de 3 jours</span>}
                          {drafts[m.id] != null && <span className="text-amber-700">Réponse non envoyée</span>}
                          {(search || m.status !== tab) && <span className="text-green-700">{STATUS[m.status]}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Message" className={`${num ? "block" : "hidden md:block"} bg-white rounded-2xl border border-gray-200 min-w-0 md:overflow-y-auto`}>
            {num && <button onClick={close} className="md:hidden block px-4 pt-4 text-sm font-bold text-gray-500">← Messages</button>}
            {cur
              ? <Detail key={cur.id} m={cur} draft={drafts[cur.id]} setDraft={(v) => setDraft(cur.id, v)} onUpdate={update} onRemove={remove} onExpired={onExpired} next={next} onNext={() => open(next.num)} />
              : <p className="p-6 text-sm text-gray-500">{!num ? "Choisissez un message." : !list ? "Chargement…" : `Message A-${num} introuvable : il a peut-être été supprimé.`}</p>}
          </section>
        </div>
      </main>
    </div>
  );
}

function Detail({ m, draft, setDraft, onUpdate, onRemove, onExpired, next, onNext }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mark, setMark] = useState(null); // date de « J'ai répondu par mail »
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState(null); // note en cours de modification
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const out = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !menuRef.current?.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", out); document.addEventListener("keydown", out);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", out); };
  }, [menu]);

  const run = async (body, ok, then) => {
    setBusy(true); setMsg(null); setMenu(false);
    try {
      const r = await messagesApi({ id: m.id, ...body });
      then?.();
      if (body.action === "delete") return onRemove(m);
      onUpdate(r.message);
      setMsg({ ok: true, text: ok });
    } catch (e) { if (e.status === 401) onExpired(); else setMsg({ text: e.message }); } finally { setBusy(false); }
  };
  const writing = draft != null;
  const item = "block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-40";
  return (
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Icon app={m.app} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg leading-tight break-words">{m.name || m.email || "Sans adresse"}</h2>
          <p className="text-sm text-gray-600 break-words">{KINDS[m.kind]?.icon} {KINDS[m.kind]?.short} · {appTitle(m.app)} · {refOf(m.num)} · <b className={m.status === "todo" ? "text-brand-navy" : "text-green-700"}>{STATUS[m.status]}</b></p>
          <p className="text-xs text-gray-500 break-all">{m.email || "Pas d'adresse laissée : pas de réponse possible."}</p>
          {m.device && <p className="text-xs text-gray-500">{m.device}</p>}
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button onClick={() => setMenu(!menu)} aria-label="Autres actions" aria-expanded={menu} className="w-10 h-10 rounded-full hover:bg-gray-100 text-xl font-bold">⋯</button>
          {menu && (
            <div className="absolute right-0 top-11 z-10 w-52 py-1 bg-white rounded-xl border border-gray-200 shadow-lg">
              <button onClick={() => { setMenu(false); setNote(m.note || ""); }} className={item}>📝 {m.note ? "Modifier la note" : "Ajouter une note"}</button>
              {m.status !== "closed" && <button disabled={busy} onClick={() => run({ action: "status", status: "closed" }, "✓ Classé.")} className={item}>🗂️ Classer</button>}
              {m.status !== "todo" && <button disabled={busy} onClick={() => run({ action: "status", status: "todo" }, "✓ Remis à traiter.")} className={item}>↩️ Remettre à traiter</button>}
              <button disabled={busy} onClick={() => confirm(`Supprimer définitivement le message ${refOf(m.num)} et ses réponses ?\nLes copies de votre boîte mail ne sont pas supprimées.`) && run({ action: "delete" })} className={`${item} text-red-600`}>🗑️ Supprimer</button>
            </div>
          )}
        </div>
      </div>

      {note !== null ? (
        <div className="space-y-2 bg-amber-50 rounded-xl p-3">
          <textarea autoFocus rows={3} value={note} maxLength={2000} disabled={busy} onChange={(e) => setNote(e.target.value)} aria-label="Note interne" placeholder="Note interne (jamais envoyée)" className="w-full border-2 border-amber-200 rounded-xl p-2 text-base md:text-sm bg-white outline-none" />
          <div className="flex gap-3 items-center">
            <button disabled={busy} onClick={() => run({ action: "note", note }, "✓ Note enregistrée.", () => setNote(null))} className={btn}>Enregistrer la note</button>
            <button disabled={busy} onClick={() => setNote(null)} className="text-sm text-gray-500 underline">Annuler</button>
          </div>
        </div>
      ) : m.note && <button onClick={() => setNote(m.note)} className="w-full text-left text-sm bg-amber-50 rounded-xl px-3 py-2 whitespace-pre-wrap break-words">📝 {m.note}</button>}

      {/* l'échange, dans l'ordre */}
      <ol className="space-y-3">
        <li className="mr-4 sm:mr-16">
          <p className="text-xs text-gray-500 mb-1">{when(m.created_at)}</p>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">{m.message}</p>
        </li>
        {(m.replies || []).map((r, i) => (
          <li key={i} className="ml-4 sm:ml-16">
            <p className="text-xs text-gray-500 mb-1 text-right">{r.via === "back" ? `Réponse envoyée le ${when(r.at)}` : `Répondu par mail le ${day(r.at)}`}</p>
            {r.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed bg-[#E6ECF8] rounded-2xl rounded-tr-sm px-4 py-3">{r.text}</p>}
          </li>
        ))}
      </ol>

      {writing && (
        <div className="space-y-2">
          <textarea autoFocus rows={10} value={draft} onFocus={(e) => { if (draft === model(m)) { const i = draft.indexOf("\n\n") + 2; e.target.setSelectionRange(i, i); } }} disabled={busy} onChange={(e) => setDraft(e.target.value)} aria-label="Réponse" className="w-full border-2 border-gray-200 rounded-xl p-3 text-base focus:border-brand-orange outline-none" />
          <p className="text-xs text-gray-500">Envoyée de contact@apps360.fr à <b className="break-all">{m.email}</b>, son message rappelé dessous. Une copie « [Copie] … » arrive dans la boîte contact@.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy || !draft.trim() || draft.trim() === model(m).trim()} onClick={() => run({ action: "reply", text: draft }, "✓ Réponse envoyée.", () => setDraft(null))} className="w-full sm:w-auto bg-brand-navy text-white font-bold px-6 py-2.5 rounded-full text-sm disabled:opacity-40">{busy ? "Envoi…" : "Envoyer la réponse"}</button>
            <button disabled={busy} onClick={() => (draft === model(m) || confirm("Abandonner cette réponse ?")) && setDraft(null)} className="text-sm text-gray-500 underline">Annuler</button>
          </div>
        </div>
      )}

      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {m.email && !writing && <button onClick={() => { setMsg(null); setDraft(model(m)); }} disabled={busy} className={`text-sm font-bold px-5 py-2 rounded-full disabled:opacity-40 ${m.replies?.length ? "border border-gray-300" : "bg-brand-navy text-white"}`}>{m.replies?.length ? "Répondre encore" : "Répondre"}</button>}
        {m.email && <button onClick={() => setMark(mark ? null : isoToday())} disabled={busy} className={btn}>J'ai répondu par mail</button>}
        {m.status !== "todo" && next && <button onClick={onNext} className="ml-auto text-sm font-bold px-5 py-2 rounded-full bg-brand-orange text-brand-navy">Message suivant →</button>}
      </div>
      {mark && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Répondu le <DateInput value={mark} max={isoToday()} onChange={(e) => setMark(e.target.value)} aria-label="Date de réponse" className="border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white" />
          <button disabled={busy || !mark} onClick={() => run({ action: "mark", day: mark }, "✓ Noté comme répondu.", () => setMark(null))} className={btn}>Valider</button>
          <span className="text-xs text-gray-500">N'envoie rien : note seulement la date.</span>
        </div>
      )}
    </div>
  );
}
