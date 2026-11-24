"use client";
/*
 * Nuage de mots — super-admin (/nuage/super) : tous les nuages, accès à leur
 * écran présentateur (modération, réglages), nouveau lien présentateur si
 * l'organisateur a perdu le sien, fermeture, suppression.
 * Connexion commune du backoffice (components/admin/session.js) : déjà connecté
 * au backoffice → aucun mot de passe. Une lecture à l'ouverture, puis seulement
 * sur « Actualiser ».
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminBar from "@/components/admin/AdminBar";
import { appToken, dropApp, ensureApp, login, logout } from "@/components/admin/session";
import PasswordInput from "@/components/PasswordInput";
import ShareActions from "@/components/jukebox/ShareActions";
import AppIcon from "@/components/AppIcon";
import { formatCode } from "./storage";
import { maxLabel } from "@/lib/nuage";

async function api(body) {
  const res = await fetch("/api/nuage/super", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nuage-super": appToken("nuage") || "" },
    body: JSON.stringify(body),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Erreur."), { status: res.status });
  return r;
}

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none";
const small = "text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-50 disabled:opacity-40";
const FILTERS = [["all", "Tous"], ["open", "Ouverts"], ["closed", "Fermés"], ["empty", "Sans mot"]];
const keep = { all: () => true, open: (n) => n.status === "open", closed: (n) => n.status !== "open", empty: (n) => !n.words };

export default function SuperApp() {
  const [authed, setAuthed] = useState(undefined);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // { total, nuages }
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null); // { code, message }

  useEffect(() => { ensureApp("nuage").then(() => setAuthed(!!appToken("nuage"))); }, []);

  const call = useCallback(async (body) => {
    setErr(""); setBusy(true);
    try {
      if (!appToken("nuage")) await ensureApp("nuage"); // jeton expiré page ouverte
      return await api(body);
    } catch (e) {
      if (e.status === 401) { dropApp("nuage"); setAuthed(false); setErr("Session expirée : reconnectez-vous."); }
      else setErr(e.message);
      return null;
    } finally { setBusy(false); }
  }, []);

  const load = useCallback(async () => {
    const r = await call({ action: "list" });
    if (r) setData(r);
  }, [call]);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(pw); setPw(""); setAuthed(true); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const toggle = async (n) => {
    const action = n.status === "open" ? "close" : "open";
    if (await call({ action, code: n.code }))
      setData((d) => ({ ...d, nuages: d.nuages.map((x) => (x.code === n.code ? { ...x, status: action === "open" ? "open" : "closed" } : x)) }));
  };
  const relink = async (n) => {
    if (!confirm(`Créer un nouveau lien présentateur pour « ${n.question} » ?\nL'ancien lien et les appareils déjà présentateurs perdront l'accès.`)) return;
    const r = await call({ action: "relink", code: n.code });
    if (r) setLink({
      code: n.code,
      message: [
        `☁️ Nuage de mots « ${n.question} » : votre nouveau lien présentateur.`,
        "",
        `👉 ${window.location.origin}/nuage/${n.code}/presenter#t=${r.token}`,
        "",
        "Gardez ce message pour vous : il donne les commandes du nuage.",
      ].join("\n"),
    });
  };
  const remove = async (n) => {
    if (!confirm(`Supprimer définitivement « ${n.question} » (${plural(n.words, "mot")}) ?`)) return;
    if (await call({ action: "delete", code: n.code })) {
      setData((d) => ({ total: d.total - 1, nuages: d.nuages.filter((x) => x.code !== n.code) }));
      if (link?.code === n.code) setLink(null);
    }
  };

  if (authed === undefined) return null;
  if (!authed) {
    return (
      <Page>
        <form onSubmit={submit} className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl p-7 mt-10 space-y-4">
          <h1 className="text-xl font-black">Super-admin Nuage de mots</h1>
          <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe" className={input} />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button disabled={busy || !pw} className="w-full bg-gray-900 text-white font-bold py-3 rounded-full disabled:opacity-50">Se connecter</button>
        </form>
      </Page>
    );
  }

  const all = data?.nuages || [];
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\s/g, "");
  const shown = all.filter((n) => keep[filter](n) && (!needle || n.question.toLowerCase().includes(needle) || n.code.includes(digits)));
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Super-admin</p>
          <h1 className="text-3xl font-black text-gray-900">Nuages de mots</h1>
          {data && (
            <p className="text-sm text-gray-500">
              {plural(data.total, "nuage")}{data.total > all.length ? ` (${all.length} affichés)` : ""} · {plural(all.reduce((s, n) => s + n.words, 0), "mot")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={busy} className="border-2 border-gray-200 font-bold px-4 py-2 rounded-full text-sm disabled:opacity-40">↻ Actualiser</button>
          <button onClick={() => { logout(); setData(null); setLink(null); setAuthed(false); }} className="text-sm text-gray-400 underline" title="Déconnecte aussi le backoffice et les autres super-admins">Se déconnecter</button>
        </div>
      </div>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {all.length > 0 && (
        <div className="space-y-3 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (question, code)" className={`${input} bg-white`} />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={`text-xs font-bold px-3 py-1.5 rounded-full ${filter === k ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
                {label} ({all.filter(keep[k]).length})
              </button>
            ))}
          </div>
        </div>
      )}
      {!data && !err && <p className="text-gray-400 text-center py-10">Chargement…</p>}
      {data && shown.length === 0 && <p className="text-gray-400 text-center py-10">Aucun nuage.</p>}
      <div className="space-y-2">
        {shown.map((n) => (
          <div key={n.code} className="bg-white rounded-2xl border border-sky-100 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 break-words">{n.question}</p>
                <p className="text-xs text-gray-500">
                  <span className="font-mono font-bold text-violet-600">{formatCode(n.code)}</span> · créé le {fmtDay(n.createdAt)}
                  {n.activeAt && ` · actif le ${fmtDay(n.activeAt)}`} · mots par participant : {maxLabel(n.max).toLowerCase()}
                </p>
                {n.purgeAt && <p className="text-xs text-gray-400">Suppression automatique le {fmtDay(n.purgeAt)} sans nouvelle activité</p>}
              </div>
              <span className="flex flex-wrap gap-1.5">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">{plural(n.words, "mot")}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${n.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{n.status === "open" ? "Ouvert" : "Fermé"}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/nuage/${n.code}/presenter?super`} target="_blank" rel="noopener"
                className="text-xs font-bold px-3 py-1 rounded-full bg-gray-900 text-white">Ouvrir et modérer ↗</a>
              <Link href={`/nuage/${n.code}`} className={small}>Page participant</Link>
              <button onClick={() => toggle(n)} disabled={busy} className={small}>{n.status === "open" ? "Fermer les envois" : "Ouvrir les envois"}</button>
              <button onClick={() => relink(n)} disabled={busy} className={small}>Nouveau lien présentateur</button>
              <button onClick={() => remove(n)} disabled={busy} className="text-xs text-red-500 underline ml-auto disabled:opacity-40">Supprimer</button>
            </div>
            {link?.code === n.code && (
              <div className="bg-gray-50 border rounded-xl p-3 space-y-2">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm">{link.message}</pre>
                <ShareActions subject="Nuage de mots" message={link.message} />
                <p className="text-xs text-gray-500">Ce lien n'est affiché qu'une fois. <button onClick={() => setLink(null)} className="underline">Masquer</button></p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-violet-50">
      <AdminBar current="nuage" />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link href="/nuage" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4">
          <AppIcon app="nuage" /> Nuage de mots
        </Link>
        {children}
      </div>
    </div>
  );
}
