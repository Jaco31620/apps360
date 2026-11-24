"use client";
/*
 * Ami Invisible — super-admin (/ami-invisible/super) : vue de tous les
 * tirages (brouillons et tirés, envois, ouvertures, activité des organisateurs)
 * et dépannage (renvoi ou copie du lien personnel, correction d'un participant,
 * suppression d'un tirage). Les paires restent masquées : leur affichage est volontaire
 * et tracé au journal du tirage. Une lecture à l'ouverture, puis seulement
 * sur « Actualiser » (pas de rafraîchissement automatique).
 */
import { useCallback, useEffect, useState } from "react";
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
  const [open, setOpen] = useState(null); // id du tirage ouvert
  const [q, setQ] = useState("");

  useEffect(() => { setToken(ls.get()); }, []);

  const expired = useCallback((e) => { if (e.status === 401) { ls.set(null); setToken(null); } else setErr(e.message); }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setErr("");
    try { setList((await api({ action: "list" }, token)).tirages); } catch (e) { expired(e); }
  }, [token, expired]);
  useEffect(() => { load(); }, [load]);

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

  if (open) return <Page><TirageDetail id={open} token={token} onBack={() => { setOpen(null); load(); }} onExpired={expired} /></Page>;

  const needle = q.trim().toLowerCase();
  const shown = (list || []).filter((t) => !needle || `${t.name} ${t.organizer || ""}`.toLowerCase().includes(needle));
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (tirage, organisateur)" className={`${input} mb-4`} />
      )}
      {!list && !err && <p className="text-gray-400 text-center py-10">Chargement…</p>}
      {list?.length === 0 && <p className="text-gray-400 text-center py-10">Aucun tirage.</p>}
      <div className="space-y-2">
        {shown.map((t) => (
          <button key={t.id} onClick={() => setOpen(t.id)}
            className="w-full text-left bg-white rounded-2xl border border-red-100 p-4 hover:border-red-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">{t.name || "Sans nom"}</p>
              <p className="text-xs text-gray-500">
                {t.status === "drawn" ? `Tiré le ${fmtDay(t.drawnAt)}` : `Brouillon, modifié le ${fmtDay(t.updatedAt)}`} · {t.organizer || "?"} (actif le {fmtDay(t.lastActive)}) · {t.total} participants
              </p>
            </div>
            <SendBadge t={t} />
          </button>
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

function TirageDetail({ id, token, onBack, onExpired }) {
  const [t, setT] = useState(null);
  const [pairs, setPairs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(null); // { pid, person, erased }
  const [copied, setCopied] = useState(null);

  const call = useCallback(async (body, key) => {
    setBusy(key ?? true); setMsg("");
    try {
      const r = await api({ id, ...body }, token);
      if (r.tirage) setT(r.tirage);
      return r;
    } catch (e) { onExpired(e); setMsg(e.message); return null; }
    finally { setBusy(null); }
  }, [id, token, onExpired]);

  useEffect(() => { call({ action: "get" }); }, [call]);

  if (!t) return (
    <div><button onClick={onBack} className="text-sm text-gray-500 mb-4">← Tous les tirages</button>
      <p className="text-gray-400 text-center py-10">{msg || "Chargement…"}</p></div>
  );
  const o = t.options || {};
  const drawn = t.status === "drawn";
  const people = drawn ? t.participants : (t.draft || []).map((p) => ({ id: p.key, prenom: p.prenom, nom: p.nom, email: p.email, draft: true }));

  const reveal = async () => {
    if (!confirm("Afficher qui offre à qui ? L'affichage est noté dans le journal du tirage.")) return;
    const r = await call({ action: "reveal" }, "reveal");
    if (r) setPairs(r.pairs);
  };
  const resend = async (p) => {
    const r = await call({ action: "send", participantId: p.id }, `send${p.id}`);
    if (r) setMsg(`Lien renvoyé à ${p.email}.`);
  };
  const copy = async (p) => {
    try { await navigator.clipboard.writeText(p.link); setCopied(p.id); setTimeout(() => setCopied(null), 2000); } catch (e) { window.prompt("Lien à copier :", p.link); }
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    const r = await call({ action: "edit", participantId: edit.pid, person: edit.person }, "edit");
    if (r) { setEdit(null); setMsg("Participant corrigé. Renvoyez-lui son lien si son e-mail a changé."); }
  };
  const remove = async () => {
    if (!confirm(`Supprimer définitivement le tirage « ${t.name} » ? Les liens envoyés ne fonctionneront plus.`)) return;
    const r = await call({ action: "delete" }, "delete");
    if (r) onBack();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-500">← Tous les tirages</button>
      <div className="bg-white rounded-2xl border border-red-100 p-5 space-y-1">
        <h1 className="text-2xl font-black text-gray-900">{t.name || "Sans nom"}</h1>
        <p className="text-sm text-gray-500">
          {drawn ? `Tiré le ${fmt(t.drawnAt)}` : "Brouillon"} · organisé par {t.organizer || "?"} (dernière activité le {fmtDay(t.lastActive)}) · {people.length} participants
        </p>
        <p className="text-xs text-gray-400">
          {[o.organizerPlays === false ? "L'organisateur ne participe pas" : "L'organisateur participe", o.tone === "vous" ? "vouvoiement" : "tutoiement",
            o.date && `échange le ${fmtDay(o.date + "T12:00:00")}`, o.place, o.budget && `budget ${o.budget}`, o.wishlist && "liste de souhaits"].filter(Boolean).join(" · ")}
        </p>
      </div>

      {msg && <p className="text-sm bg-gray-50 border rounded-xl px-3 py-2">{msg}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {drawn && (!pairs
          ? <button onClick={reveal} disabled={!!busy} className="border-2 border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-full text-sm">🔒 Afficher les paires</button>
          : <>
              <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-1.5 rounded-full">⚠️ Paires visibles (affichage noté au journal)</span>
              <button onClick={() => setPairs(null)} className="text-sm text-gray-500 underline">Masquer</button>
            </>)}
        <button onClick={remove} disabled={!!busy} className="text-sm text-red-500 underline ml-auto">Supprimer le tirage</button>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 divide-y">
        {people.map((p) => (
          <div key={p.id} className="p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{p.prenom} {p.nom}
                  {pairs && <span className="ml-2 text-purple-600">→ {pairs[p.id]?.prenom} {pairs[p.id]?.nom}</span>}</p>
                {p.erased ? <p className="text-xs text-orange-600">Coordonnées supprimées à sa demande</p> : <p className="text-xs text-gray-500">{p.email}</p>}
                {!p.draft && (
                  <p className="text-xs text-gray-400">
                    {p.sentAt ? `Envoyé le ${fmt(p.sentAt)}${p.sends > 1 ? ` (${p.sends} envois)` : ""}` : "Pas encore envoyé"}
                    {p.openedAt ? ` · ouvert le ${fmt(p.openedAt)}` : ""}
                  </p>
                )}
              </div>
              {!p.draft && (
                <div className="flex flex-wrap gap-2">
                  {!p.erased && (
                    <button onClick={() => resend(p)} disabled={!!busy} className="text-xs border border-red-300 text-red-600 px-3 py-1 rounded-full disabled:opacity-40">
                      {busy === `send${p.id}` ? "⏳" : "Renvoyer le lien"}</button>
                  )}
                  <button onClick={() => copy(p)} className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full">{copied === p.id ? "Copié ✓" : "Copier le lien"}</button>
                  <button onClick={() => setEdit({ pid: p.id, erased: p.erased, person: { prenom: p.prenom, nom: p.nom, email: p.email || "" } })} disabled={!!busy}
                    className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full disabled:opacity-40">Corriger</button>
                </div>
              )}
            </div>
            {edit?.pid === p.id && (
              <form onSubmit={saveEdit} className="bg-gray-50 border rounded-xl p-3 grid sm:grid-cols-3 gap-2">
                {[["prenom", "Prénom"], ["nom", "Nom"], ...(edit.erased ? [] : [["email", "E-mail"]])].map(([k, l]) => (
                  <label key={k} className="text-xs text-gray-500">{l}
                    <input value={edit.person[k] || ""} onChange={(e) => setEdit((x) => ({ ...x, person: { ...x.person, [k]: e.target.value } }))} className={input} />
                  </label>
                ))}
                <div className="sm:col-span-3 flex gap-2">
                  <button disabled={busy === "edit"} className="bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-full">Enregistrer</button>
                  <button type="button" onClick={() => setEdit(null)} className="text-sm text-gray-500 underline">Annuler</button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
      {drawn && <p className="text-xs text-gray-400">Le lien personnel affiche le résultat de la personne : envoyez-le-lui (SMS, messagerie) sans l'ouvrir vous-même.</p>}

      <div className="bg-white rounded-2xl border border-red-100 p-4">
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
