"use client";
/*
 * Ami Invisible — super-admin (/ami-invisible/super) : vue de tous les
 * tirages (brouillons et tirés, envois, ouvertures, activité des organisateurs)
 * et dépannage : recherche d'un participant, renvoi ou copie de son lien,
 * correction (nouvel e-mail = nouveau lien), suppression d'un tirage. Les paires restent masquées : leur affichage est volontaire
 * et tracé au journal du tirage. Une lecture à l'ouverture, puis seulement
 * sur « Actualiser » (pas de rafraîchissement automatique).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminBar from "@/components/admin/AdminBar";
import PasswordInput from "@/components/PasswordInput";
import AppIcon from "@/components/AppIcon";

const KEY = "ai_super"; // même clé que components/admin/session.js
const ls = {
  get: () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { /* ignoré */ } },
};

async function api(body, token) {
  const res = await fetch("/api/ami-invisible/super", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-ai-super": token } : {}) },
    body: JSON.stringify(body),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Erreur."), { status: res.status });
  return r;
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const ACTIONS = { reveal: "Paires affichées", send: "Lien renvoyé", edit: "Participant corrigé", erase: "Coordonnées supprimées par le participant" };
const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 outline-none";

export default function SuperApp() {
  const [token, setToken] = useState(undefined);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null); // { id, pid? } tirage ouvert, personne dépliée
  const [found, setFound] = useState({}); // participants trouvés, par tirage
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { setToken(ls.get()); }, []);

  const expired = useCallback((e) => { if (e.status === 401) { ls.set(null); setToken(null); } else setErr(e.message); }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setErr("");
    try { setList((await api({ action: "list" }, token)).tirages); } catch (e) { expired(e); }
  }, [token, expired]);
  useEffect(() => { load(); }, [load]);

  // recherche d'un participant, une fois la saisie posée
  const needle = q.trim().toLowerCase();
  useEffect(() => {
    setFound({});
    if (!token || needle.length < 2) { setFinding(false); return undefined; }
    let off = false;
    setFinding(true);
    const id = setTimeout(async () => {
      try { const r = await api({ action: "find", q: needle }, token); if (!off) setFound(r.found); }
      catch (e) { if (!off) expired(e); }
      if (!off) setFinding(false);
    }, 400);
    return () => { off = true; clearTimeout(id); };
  }, [needle, token, expired]);

  const login = async (e) => {
    e.preventDefault();
    setErr("");
    try { const r = await api({ action: "login", password: pw }); ls.set(r.token); setToken(r.token); setPw(""); }
    catch (e2) { setErr(e2.message); }
  };

  if (token === undefined) return null;
  if (!token) {
    return (
      <Page>
        <form onSubmit={login} className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl p-7 mt-10 space-y-4">
          <h1 className="text-xl font-black">Super-admin Ami Invisible</h1>
          <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe" className={input} />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button className="w-full bg-gray-900 text-white font-bold py-3 rounded-full">Se connecter</button>
        </form>
      </Page>
    );
  }

  if (open) return <Page><TirageDetail id={open.id} person={open.pid} token={token} onBack={() => { setOpen(null); load(); }} onExpired={expired} /></Page>;

  const shown = (list || []).filter((t) => !needle || found[t.id] || `${t.name} ${t.organizer || ""}`.toLowerCase().includes(needle));
  const organizers = new Set((list || []).map((t) => t.userId)).size;
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">Super-admin</p>
          <h1 className="text-3xl font-black text-gray-900">Tirages Ami Invisible</h1>
          {list && <p className="text-sm text-gray-500">{list.length} tirage(s) · {organizers} organisateur(s)</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="border-2 border-gray-200 font-bold px-4 py-2 rounded-full text-sm">↻ Actualiser</button>
          <button onClick={() => { ls.set(null); setToken(null); }} className="text-sm text-gray-400 underline">Se déconnecter</button>
        </div>
      </div>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {list && list.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (participant, tirage, organisateur)" aria-label="Rechercher" className={`${input} mb-4`} />
      )}
      {!list && !err && <p className="text-gray-400 text-center py-10">Chargement…</p>}
      {list?.length === 0 && <p className="text-gray-400 text-center py-10">Aucun tirage.</p>}
      {list?.length > 0 && shown.length === 0 && <p className="text-gray-400 text-center py-10">{finding ? "Recherche…" : "Aucun résultat."}</p>}
      <div className="space-y-2">
        {shown.map((t) => (
         <div key={t.id} className="bg-white rounded-2xl border border-red-100 hover:border-red-300">
          <button onClick={() => setOpen({ id: t.id })} className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">{t.name || "Sans nom"}</p>
              <p className="text-xs text-gray-500">
                {t.status === "drawn" ? `Tiré le ${fmtDay(t.drawnAt)}` : `Brouillon, modifié le ${fmtDay(t.updatedAt)}`} · {t.organizer || "?"} (actif le {fmtDay(t.lastActive)}) · {t.total} participants
              </p>
            </div>
            <SendBadge t={t} />
          </button>
          {found[t.id] && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {found[t.id].slice(0, 8).map((p) => (
                <button key={p.id} onClick={() => setOpen({ id: t.id, pid: p.id })} className="text-xs bg-red-50 text-red-700 font-semibold px-3 py-1.5 rounded-full hover:bg-red-100">
                  🎁 {p.prenom} {p.nom}{p.email && <span className="font-normal"> · {p.email}</span>}
                </button>
              ))}
              {found[t.id].length > 8 && <span className="text-xs text-gray-400 py-1.5">+ {found[t.id].length - 8} autres</span>}
            </div>
          )}
         </div>
        ))}
      </div>
    </Page>
  );
}

function SendBadge({ t }) {
  if (t.status !== "drawn") return <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-500">Brouillon</span>;
  const all = t.sent === t.total;
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`text-xs font-bold px-3 py-1 rounded-full ${all ? "bg-green-100 text-green-700" : t.sent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>{t.sent}/{t.total} envoyés</span>
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">{t.opened}/{t.total} ouverts</span>
      {t.erased > 0 && <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-orange-700">{t.erased} coordonnée(s) supprimée(s)</span>}
    </span>
  );
}

const FILTERS = [["all", "Tous"], ["unsent", "Non envoyés"], ["unopened", "Non ouverts"]];

function TirageDetail({ id, person, token, onBack, onExpired }) {
  const [t, setT] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [pairs, setPairs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openP, setOpenP] = useState(person || null); // personne dépliée (une seule)
  const [edit, setEdit] = useState(null); // { prenom, nom, email } correction en cours
  const [note, setNote] = useState(null); // { at: id de personne | "org" | "pairs" | "delete", text, bad }
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const rowRef = useRef(null);

  const call = useCallback(async (body, at) => {
    setBusy(body.action); setNote(null);
    try {
      const r = await api({ id, ...body }, token);
      if (r.tirage) setT(r.tirage);
      return r;
    } catch (e) {
      if (e.status === 401) onExpired(e);
      else if (at) setNote({ at, text: e.message, bad: true });
      else setLoadErr(e.message);
      return null;
    } finally { setBusy(null); }
  }, [id, token, onExpired]);

  useEffect(() => { call({ action: "get" }); }, [call]);
  const loaded = !!t;
  useEffect(() => { if (loaded && person) rowRef.current?.scrollIntoView({ block: "center" }); }, [loaded, person]);

  const drawn = t?.status === "drawn";
  const people = !t ? [] : drawn ? t.participants : (t.draft || []).map((p) => ({ id: p.key, prenom: p.prenom, nom: p.nom, email: p.email, draft: true }));
  const cur = people.find((p) => p.id === openP);
  const dirty = !!(edit && cur && (edit.prenom !== cur.prenom || edit.nom !== cur.nom || edit.email !== (cur.email || "")));

  // correction non enregistrée : alerte avant fermeture, lien ou retour
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    const link = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!confirm("La correction n'est pas enregistrée. L'abandonner ?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", link, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", link, true); };
  }, [dirty]);
  const canLeave = () => !dirty || confirm("La correction n'est pas enregistrée. L'abandonner ?");
  const back = () => { if (canLeave()) onBack(); };

  if (!t) return (
    <div><button onClick={onBack} className="text-sm text-gray-500 mb-4">← Tous les tirages</button>
      <p className="text-gray-400 text-center py-10">{loadErr || "Chargement…"}</p></div>
  );
  const o = t.options || {};
  const toggle = (pid) => { if (!canLeave()) return; setEdit(null); setNote(null); setOpenP(openP === pid ? null : pid); };
  const copy = async (text, at, ok) => {
    try { await navigator.clipboard.writeText(text); setNote({ at, text: ok }); } catch (e) { window.prompt("À copier :", text); }
  };
  const reveal = async () => {
    if (!confirm("Afficher qui offre à qui ? L'affichage est noté dans le journal du tirage.")) return;
    const r = await call({ action: "reveal" }, "pairs");
    if (r) setPairs(r.pairs);
  };
  const resend = async (p) => {
    const r = await call({ action: "send", participantId: p.id }, p.id);
    if (r) setNote({ at: p.id, text: `E-mail envoyé à ${p.email}.` });
  };
  const save = async (p, send) => {
    const r = await call({ action: "edit", participantId: p.id, person: edit, send }, p.id);
    if (!r) return;
    setEdit(null);
    if (r.mailFailed) setNote({ at: p.id, text: "Correction enregistrée, mais l'e-mail n'est pas parti.", bad: true });
    else setNote({ at: p.id, text: `Correction enregistrée.${send ? " E-mail envoyé." : ""}${r.moved ? " L'ancien lien ne fonctionne plus." : ""}` });
  };
  const remove = async () => {
    if (!canLeave() || !confirm(`Supprimer définitivement le tirage « ${t.name || "Sans nom"} » ? Les liens envoyés ne fonctionneront plus.`)) return;
    const r = await call({ action: "delete" }, "delete");
    if (r) onBack();
  };
  const Note = ({ at }) => (note?.at === at ? <p role="status" className={`text-sm ${note.bad ? "text-red-600" : "text-green-600"}`}>{note.text}</p> : null);

  const needle = q.trim().toLowerCase();
  const shown = people.filter((p) => p.id === openP || (
    (!needle || `${p.prenom} ${p.nom} ${p.email || ""}`.toLowerCase().includes(needle))
    && (filter === "all" || (filter === "unsent" ? !p.sentAt : !p.openedAt))));
  const small = "text-sm font-bold px-3.5 py-1.5 rounded-full border border-gray-200 bg-white hover:border-gray-300 disabled:opacity-40";
  const box = "bg-white rounded-2xl border border-red-100";

  return (
    <div className="space-y-4">
      <button onClick={back} className="text-sm text-gray-500">← Tous les tirages</button>
      <div className={`${box} p-5 space-y-2`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{t.name || "Sans nom"}</h1>
            <p className="text-sm text-gray-500">{people.length} participants</p>
          </div>
          <SendBadge t={{ status: t.status, total: people.length, sent: people.filter((p) => p.sentAt).length, opened: people.filter((p) => p.openedAt).length, erased: people.filter((p) => p.erased).length }} />
        </div>
      </div>

      <div className={`${box} p-4 space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900">👤 Organisateur</p>
            <p className="text-sm text-gray-500 break-all">{t.organizer || "Adresse inconnue"}<span className="text-gray-400"> · {o.organizerPlays === false ? "ne participe pas" : "participe"} · actif le {fmtDay(t.lastActive)}</span></p>
          </div>
          {t.organizer && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy(t.organizer, "org", "Adresse copiée.")} className={small}>Copier l'e-mail</button>
              <a href={`mailto:${t.organizer}?subject=${encodeURIComponent(`Ami Invisible : ${t.name || "votre tirage"}`)}`} target="_blank" rel="noopener noreferrer" className={small}>Lui écrire</a>
            </div>
          )}
        </div>
        <Note at="org" />
      </div>

      <div className={box}>
        <div className="p-4 space-y-3">
          <p className="font-bold text-gray-900">🎁 Participants</p>
          {people.length > 6 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne" aria-label="Rechercher une personne" className={input} />}
          {drawn && (
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${filter === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{label}</button>
              ))}
            </div>
          )}
          {pairs && (
            <p className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-1.5 rounded-xl">
              ⚠️ Qui offre à qui est affiché (noté au journal) <button onClick={() => setPairs(null)} className="underline ml-1">Masquer</button>
            </p>
          )}
        </div>
        <div className="divide-y border-t">
          {shown.length === 0 && <p className="p-4 text-sm text-gray-400">Personne.</p>}
          {shown.map((p) => {
            const isOpen = openP === p.id;
            const info = (
              <span className="min-w-0 block">
                <span className="block text-sm font-semibold">{p.prenom} {p.nom}
                  {pairs && <span className="ml-2 text-purple-600">→ {pairs[p.id]?.prenom} {pairs[p.id]?.nom}</span>}</span>
                <span className={`block text-xs break-all ${p.erased ? "text-orange-600" : "text-gray-500"}`}>{p.erased ? "Coordonnées supprimées à sa demande" : p.email}</span>
                {!p.draft && <span className="block text-xs text-gray-400">
                  {p.sentAt ? `Envoyé le ${fmt(p.sentAt)}${p.sends > 1 ? ` (${p.sends} envois)` : ""}` : "Pas encore envoyé"}{p.openedAt ? ` · ouvert le ${fmt(p.openedAt)}` : ""}</span>}
              </span>
            );
            if (p.draft) return <div key={p.id} ref={isOpen ? rowRef : null} className={`p-4 ${isOpen ? "bg-red-50" : ""}`}>{info}</div>;
            return (
              <div key={p.id} ref={isOpen ? rowRef : null}>
                <button onClick={() => toggle(p.id)} aria-expanded={isOpen} className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-gray-50">
                  {info}<span className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {!edit ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => copy(p.link, p.id, "Lien copié. Il affiche le résultat de la personne : ne l'ouvrez pas, elle serait marquée « ouvert ».")} className={small}>Copier le lien</button>
                        {!p.erased && <button onClick={() => resend(p)} disabled={!!busy} className={small}>{busy === "send" ? "⏳" : `${p.sentAt ? "Renvoyer" : "Envoyer"} l'e-mail à ${p.email}`}</button>}
                        <button onClick={() => { setNote(null); setEdit({ prenom: p.prenom, nom: p.nom, email: p.email || "" }); }} disabled={!!busy} className={small}>Corriger</button>
                      </div>
                    ) : (
                      <form onSubmit={(e) => { e.preventDefault(); save(p, false); }} className="bg-gray-50 border rounded-xl p-3 space-y-2">
                        <div className="grid sm:grid-cols-3 gap-2">
                          {[["prenom", "Prénom"], ["nom", "Nom"], ...(p.erased ? [] : [["email", "E-mail"]])].map(([k, l]) => (
                            <label key={k} className="text-xs text-gray-500">{l}
                              <input value={edit[k]} onChange={(e) => setEdit((x) => ({ ...x, [k]: e.target.value }))} className={input} />
                            </label>
                          ))}
                        </div>
                        {dirty && <p className="text-xs font-semibold text-amber-700">Modifié, non enregistré{edit.email.trim().toLowerCase() !== (p.email || "") ? " · un nouveau lien remplacera l'ancien" : ""}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          <button disabled={!!busy || !dirty} className="bg-red-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 rounded-full">Enregistrer</button>
                          {!p.erased && <button type="button" onClick={() => save(p, true)} disabled={!!busy || !dirty} className={small}>Corriger et renvoyer</button>}
                          <button type="button" onClick={() => { setNote(null); setEdit(null); }} className="text-sm text-gray-500 underline">Annuler</button>
                        </div>
                      </form>
                    )}
                    <Note at={p.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <details className={`${box} p-4`}>
        <summary className="cursor-pointer font-bold text-gray-900">⚙️ Options</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-600">
            {[o.tone === "vous" ? "Vouvoiement" : "Tutoiement", o.organizerName && `organisé par ${o.organizerName}`, o.date && `échange le ${fmtDay(o.date + "T12:00:00")}`,
              o.place, o.budget && `budget ${o.budget}`, o.wishlist && "liste de souhaits", (o.mailSubject || o.mailText) && "e-mail personnalisé"].filter(Boolean).join(" · ")}
          </p>
          {drawn && !pairs && <button onClick={reveal} disabled={!!busy} className={small}>🔒 Afficher les paires</button>}
          {pairs && <button onClick={() => setPairs(null)} className={small}>Masquer les paires</button>}
          <Note at="pairs" />
        </div>
      </details>

      <div className={`${box} p-4`}>
        <h2 className="font-bold text-gray-800 mb-2">Journal</h2>
        {!(t.journal || []).length ? <p className="text-sm text-gray-400">Aucune action de dépannage ni affichage des paires.</p> : (
          <ul className="text-sm space-y-1">
            {[...t.journal].reverse().map((j, k) => (
              <li key={k} className="text-gray-600">
                <span className="text-gray-400">{fmt(j.at)}</span> · {ACTIONS[j.action] || j.action}{j.prenom ? ` (${j.prenom})` : ""} · {j.who}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs text-gray-400">Créé le {fmtDay(t.createdAt)}{drawn ? ` · tiré le ${fmt(t.drawnAt)}` : ` · brouillon, modifié le ${fmtDay(t.updatedAt)}`}</p>
        <button onClick={remove} disabled={!!busy} className="text-sm text-red-500 underline">Supprimer le tirage</button>
      </div>
      <Note at="delete" />
    </div>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <AdminBar current="ami" />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link href="/ami-invisible" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4">
          <AppIcon app="ami-invisible" /> Ami Invisible
        </Link>
        {children}
      </div>
    </div>
  );
}
