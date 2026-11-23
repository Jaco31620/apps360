"use client";
/*
 * Ami Invisible — super-admin (/ami-invisible/super) : vue de tous les
 * tirages et dépannage (renvoi d'un e-mail, lien personnel, correction d'un
 * participant). Les paires restent masquées : leur affichage est volontaire
 * et tracé au journal du tirage. Une lecture à l'ouverture, puis seulement
 * sur « Actualiser » (pas de rafraîchissement automatique).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminBar from "@/components/admin/AdminBar";
import PasswordInput from "@/components/PasswordInput";

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
const ACTIONS = { reveal: "Paires affichées", send: "E-mail renvoyé", edit: "Participant corrigé", link: "Lien personnel créé" };
const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 outline-none";

export default function SuperApp() {
  const [token, setToken] = useState(undefined);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null); // { userId, id }
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

  if (open) return <Page><TirageDetail {...open} token={token} onBack={() => { setOpen(null); load(); }} onExpired={expired} /></Page>;

  const needle = q.trim().toLowerCase();
  const shown = (list || []).filter((t) => !needle || `${t.eventName} ${t.organizer || ""}`.toLowerCase().includes(needle));
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">Super-admin</p>
          <h1 className="text-3xl font-black text-gray-900">Tirages Ami Invisible</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="border-2 border-gray-200 font-bold px-4 py-2 rounded-full text-sm">↻ Actualiser</button>
          <button onClick={() => { ls.set(null); setToken(null); }} className="text-sm text-gray-400 underline">Se déconnecter</button>
        </div>
      </div>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {list && list.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (événement, organisateur)" className={`${input} mb-4`} />
      )}
      {!list && !err && <p className="text-gray-400 text-center py-10">Chargement…</p>}
      {list?.length === 0 && <p className="text-gray-400 text-center py-10">Aucun tirage.</p>}
      <div className="space-y-2">
        {shown.map((t) => (
          <button key={`${t.userId}:${t.id}`} onClick={() => setOpen({ userId: t.userId, id: t.id })}
            className="w-full text-left bg-white rounded-2xl border border-red-100 p-4 hover:border-red-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">{t.eventName}</p>
              <p className="text-xs text-gray-500">{fmtDay(t.date)} · {t.organizer || "compte supprimé"} · {t.total} participants</p>
            </div>
            <SendBadge t={t} />
          </button>
        ))}
      </div>
    </Page>
  );
}

function SendBadge({ t }) {
  if (!t.tracked) return <span className="text-xs text-gray-400">Envois non suivis (ancien tirage)</span>;
  const all = t.sent === t.total;
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${all ? "bg-green-100 text-green-700" : t.sent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
      {t.sent}/{t.total} envoyés{t.lastSentAt ? ` · ${fmtDay(t.lastSentAt)}` : ""}
    </span>
  );
}

function TirageDetail({ userId, id, token, onBack, onExpired }) {
  const [data, setData] = useState(null); // { tirage, organizer }
  const [pairs, setPairs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(null); // { index, person }
  const [link, setLink] = useState(null); // { index, url }

  const call = useCallback(async (body, key) => {
    setBusy(key ?? true); setMsg("");
    try {
      const r = await api({ userId, id, ...body }, token);
      if (r.tirage) setData((d) => ({ ...d, tirage: r.tirage, ...(r.organizer !== undefined ? { organizer: r.organizer } : {}) }));
      return r;
    } catch (e) { onExpired(e); setMsg(e.message); return null; }
    finally { setBusy(null); }
  }, [userId, id, token, onExpired]);

  useEffect(() => { call({ action: "get" }); }, [call]);

  if (!data?.tirage) return (
    <div><button onClick={onBack} className="text-sm text-gray-500 mb-4">← Tous les tirages</button>
      <p className="text-gray-400 text-center py-10">{msg || "Chargement…"}</p></div>
  );
  const t = data.tirage;

  const reveal = async () => {
    if (!confirm("Afficher qui offre à qui ? L'affichage est noté dans le journal du tirage.")) return;
    const r = await call({ action: "reveal" }, "reveal");
    if (r) setPairs(r.pairs);
  };
  const resend = async (index) => {
    const r = await call({ action: "send", index }, `send${index}`);
    if (r) setMsg(`E-mail renvoyé à ${t.participants[index].email}.`);
  };
  const makeLink = async (index) => {
    const r = await call({ action: "link", index }, `link${index}`);
    if (r) setLink({ index, url: r.url });
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    const r = await call({ action: "edit", index: edit.index, person: edit.person }, "edit");
    if (r) { setEdit(null); setPairs(null); setMsg("Participant corrigé. Renvoyez-lui son résultat si besoin."); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-500">← Tous les tirages</button>
      <div className="bg-white rounded-2xl border border-red-100 p-5 space-y-1">
        <h1 className="text-2xl font-black text-gray-900">{t.eventName}</h1>
        <p className="text-sm text-gray-500">{fmtDay(t.date)} · organisé par {data.organizer || "compte supprimé"} · {t.participants.length} participants</p>
        {!t.tracked && <p className="text-xs text-gray-400">Tirage d'avant le suivi des envois : l'état des envois n'est pas connu.</p>}
      </div>

      {msg && <p className="text-sm bg-gray-50 border rounded-xl px-3 py-2">{msg}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {!pairs
          ? <button onClick={reveal} disabled={!!busy} className="border-2 border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-full text-sm">🔒 Afficher les paires</button>
          : <>
              <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-1.5 rounded-full">⚠️ Paires visibles (affichage noté au journal)</span>
              <button onClick={() => setPairs(null)} className="text-sm text-gray-500 underline">Masquer</button>
            </>}
      </div>

      <div className="bg-white rounded-2xl border border-red-100 divide-y">
        {t.participants.map((p, i) => (
          <div key={i} className="p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{p.prenom} {p.nom}
                  {pairs && <span className="ml-2 text-purple-600">→ {pairs[i].receveur.prenom} {pairs[i].receveur.nom}</span>}</p>
                <p className="text-xs text-gray-500">{p.email}{p.tel ? ` · ${p.tel}` : ""}</p>
                <p className="text-xs text-gray-400">
                  {p.sentAt ? `Envoyé le ${fmt(p.sentAt)}${p.sends > 1 ? ` (${p.sends} envois)` : ""}` : t.tracked ? "Pas encore envoyé" : "Envoi non suivi"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => resend(i)} disabled={!!busy} className="text-xs border border-red-300 text-red-600 px-3 py-1 rounded-full disabled:opacity-40">
                  {busy === `send${i}` ? "⏳" : "Renvoyer l'e-mail"}</button>
                <button onClick={() => makeLink(i)} disabled={!!busy} className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full disabled:opacity-40">
                  {busy === `link${i}` ? "⏳" : "Lien personnel"}</button>
                <button onClick={() => setEdit({ index: i, person: { prenom: p.prenom, nom: p.nom, email: p.email, tel: p.tel } })} disabled={!!busy}
                  className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full disabled:opacity-40">Corriger</button>
              </div>
            </div>
            {link?.index === i && (
              <div className="bg-gray-50 border rounded-xl p-3 space-y-2">
                <p className="text-xs text-gray-500">Lien à envoyer à {p.prenom} (SMS, messagerie). Il affiche son résultat : ne l'ouvrez pas vous-même.</p>
                <div className="flex gap-2">
                  <input readOnly value={link.url} className={`${input} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                  <button onClick={() => navigator.clipboard?.writeText(link.url)} className="shrink-0 bg-gray-900 text-white text-xs font-bold px-3 rounded-xl">Copier</button>
                </div>
              </div>
            )}
            {edit?.index === i && (
              <form onSubmit={saveEdit} className="bg-gray-50 border rounded-xl p-3 grid grid-cols-2 gap-2">
                {[["prenom", "Prénom"], ["nom", "Nom"], ["email", "E-mail"], ["tel", "Téléphone"]].map(([k, l]) => (
                  <label key={k} className="text-xs text-gray-500">{l}
                    <input value={edit.person[k] || ""} onChange={(e) => setEdit((x) => ({ ...x, person: { ...x.person, [k]: e.target.value } }))} className={input} />
                  </label>
                ))}
                <div className="col-span-2 flex gap-2">
                  <button disabled={busy === "edit"} className="bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-full">Enregistrer</button>
                  <button type="button" onClick={() => setEdit(null)} className="text-sm text-gray-500 underline">Annuler</button>
                </div>
              </form>
            )}
            {pairs && <pre className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 whitespace-pre-wrap font-sans">{pairs[i].message}</pre>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-red-100 p-4">
        <h2 className="font-bold text-gray-800 mb-2">Journal</h2>
        {!(t.journal || []).length ? <p className="text-sm text-gray-400">Aucune action de dépannage ni affichage des paires.</p> : (
          <ul className="text-sm space-y-1">
            {[...t.journal].reverse().map((j, k) => (
              <li key={k} className="text-gray-600">
                <span className="text-gray-400">{fmt(j.at)}</span> · {ACTIONS[j.action] || j.action}
                {j.index !== undefined && t.participants[j.index] ? ` (${t.participants[j.index].prenom})` : ""} · {j.who}
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
          <img src="/icon-ami-invisible.svg" alt="" className="w-6 h-6 rounded-md" /> Ami Invisible
        </Link>
        {children}
      </div>
    </div>
  );
}
