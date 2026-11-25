"use client";
/*
 * Backoffice apps360 (/admin) : point d'entrée unique.
 *  - connexion avec le mot de passe super-admin commun (7 jours sur l'appareil),
 *    qui ouvre aussi les super-admins Jukebox, Clic-Clac, Ami Invisible et Nuage ;
 *  - une carte par app : super-admin, liens à envoyer (copier, QR), message
 *    prêt à envoyer (mêmes boutons que dans les apps) ;
 *  - développements hors cadre, ressources externes.
 * Sobriété : page statique (lib/backoffice.js), aucune lecture en base, aucune
 * requête répétée — seulement la connexion et, au clic, le renouvellement d'un
 * jeton de super-admin expiré.
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import PasswordInput from "@/components/PasswordInput";
import ShareActions from "@/components/jukebox/ShareActions";
import AdminBar from "./AdminBar";
import HomeSettings from "./HomeSettings";
import { applyHome } from "@/lib/homeConfig";
import { adminToken, login, logout, ensureApp } from "./session";
import { backofficeApps, siteCard, horsCadre, resources, hostOf } from "@/lib/backoffice";
import AppIcon from "@/components/AppIcon";

/* Cartes dans l'ordre, l'état et l'étiquette réglés pour l'accueil. */
const ordered = (home) => applyHome(backofficeApps, { order: home.map((h) => h.href), apps: Object.fromEntries(home.map((h) => [h.href, h])) });

function summary(list) {
  const test = list.filter((a) => a.state === "test");
  const n = list.length - test.length;
  return `${n} app${n > 1 ? "s" : ""} publique${n > 1 ? "s" : ""}${test.length ? ` · ${test.length} en test (${test.map((a) => a.title).join(", ")})` : ""}`;
}

export default function Backoffice({ home = [] }) {
  const [list, setList] = useState(() => ordered(home));
  const [dirty, setDirty] = useState(false); // réglage de l'accueil non enregistré
  const homeRef = useRef(null);
  const openHome = () => { // étiquette « En test » d'une carte : ouvre le réglage (jamais de bascule directe)
    if (!homeRef.current) return;
    homeRef.current.open = true;
    homeRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [authed, setAuthed] = useState(undefined);
  const [origin, setOrigin] = useState("");
  const [supaRef, setSupaRef] = useState("");
  const [qr, setQr] = useState(null); // { label, url }

  useEffect(() => {
    setAuthed(!!adminToken());
    setOrigin(window.location.origin);
    const m = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
    setSupaRef(m ? m[1] : "");
  }, []);

  if (authed === undefined) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-brand-cream text-gray-900">
      <AdminBar current="admin" />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <img src="/brand/apps360-logo.svg" alt="apps360.fr" className="h-8 w-auto mb-2" />
            <h1 className="font-outfit text-3xl font-extrabold text-brand-navy">Backoffice</h1>
          </div>
          <button onClick={() => { logout(); setAuthed(false); }} className="text-sm text-gray-500 underline">Se déconnecter</button>
        </div>

        {/* le site : en premier, pleine largeur, fond distinct */}
        <AppCard app={siteCard} site origin={origin} onQr={setQr} summary={summary(list)}>
          <details ref={homeRef} className="rounded-xl bg-white border border-brand-navy/15">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-brand-navy">
              ⚙️ Page d'accueil : visibilité, étiquettes et ordre{" "}
              {dirty && <span className="ml-2 text-xs font-semibold text-amber-700">modifié, non enregistré</span>}
            </summary>
            <div className="px-3 pb-3"><HomeSettings apps={list} onSaved={setList} onDirty={setDirty} onExpired={() => setAuthed(false)} /></div>
          </details>
        </AppCard>

        <Section title="Apps">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {list.map((a) => <AppCard key={a.href} app={a} origin={origin} onQr={setQr} onState={openHome} />)}
          </div>
        </Section>

        <Section title="Développements hors cadre" sub="Absents de la page d'accueil publique.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {horsCadre.map((a) => <AppCard key={a.title} app={a} origin={origin} onQr={setQr} />)}
          </div>
        </Section>

        <Section title="Ressources">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {resources(supaRef).map((g) => (
              <div key={g.group} className="min-w-0 break-words bg-white rounded-2xl border border-gray-200 p-4">
                <p className="font-bold text-brand-navy mb-2">{g.group}</p>
                <ul className="space-y-1.5 text-sm">
                  {g.items.map((it) => (
                    <li key={it.url}>
                      <a href={it.url} target={it.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                        className="text-gray-700 hover:text-brand-navy underline decoration-gray-300 hover:decoration-brand-orange">{it.label}</a>
                    </li>
                  ))}
                </ul>
                {g.note && <p className="text-xs text-gray-500 mt-2">{g.note}</p>}
              </div>
            ))}
          </div>
        </Section>
      </main>

      {qr && <QrModal {...qr} onClose={() => setQr(null)} />}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section>
      <h2 className="font-outfit text-xl font-extrabold text-brand-navy">{title}</h2>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AppCard({ app, origin, onQr, onState, site = false, summary, children }) {
  const [msg, setMsg] = useState(false);
  const [copied, setCopied] = useState("");
  const links = app.links ? app.links(origin) : [];
  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(""), 2000); } catch (e) { /* refusé */ }
  };
  const openSuper = async (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    await ensureApp(app.superAdmin.startsWith("/jukebox") ? "jukebox" : app.superAdmin.startsWith("/ami-invisible") ? "ami" : app.superAdmin.startsWith("/nuage") ? "nuage" : "clicclac");
    window.location.href = app.superAdmin;
  };
  return (
    <div className={`min-w-0 rounded-2xl p-4 space-y-3 ${site ? "bg-[#E6ECF8] border-2 border-brand-navy/40" : "bg-white border border-gray-200"}`}>
      <div className="flex items-start gap-3">
        {app.icon
          ? <AppIcon app={app.icon} className="w-9 h-9" />
          : <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{app.emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className="font-outfit text-lg font-extrabold text-brand-navy leading-tight">{app.title}</p>
          {app.badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">{app.badge}</span>}
          {app.state === "test" && <button onClick={onState} title="Régler la visibilité sur l'accueil" className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200">En test ⚙️</button>}
        </div>
        {site && <a href="/" target="_blank" rel="noopener" className="shrink-0 text-sm font-bold px-3.5 py-2 rounded-full bg-brand-navy text-white hover:bg-[#1c3f86]">Ouvrir le site ↗</a>}
        {app.superAdmin && (
          <a href={app.superAdmin} onClick={openSuper}
            className="shrink-0 text-sm font-bold px-3.5 py-2 rounded-full bg-brand-navy text-white hover:bg-[#1c3f86]">Super-admin →</a>
        )}
      </div>
      {summary && <p className="text-sm text-gray-600">{summary}</p>}
      {app.desc && !app.href && <p className="text-sm text-gray-600">{app.desc}</p>}
      {app.note && <p className="text-xs text-gray-500">{app.note}</p>}

      {links.length > 0 && (
        <ul className={`divide-y ${site ? "divide-brand-navy/10 bg-white rounded-xl px-3" : "divide-gray-100 border-y border-gray-100"}`}>
          {links.map((l) => (
            <li key={l.url} className="flex items-center gap-2 py-1.5 text-sm">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                <span className="font-semibold text-gray-800">{l.label}</span>
                <span className="block text-xs text-gray-400 truncate">{hostOf(l.url)}</span>
              </a>
              <button onClick={() => copy(l.url)} className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200">{copied === l.url ? "✓ Copié" : "Copier"}</button>
              <button onClick={() => onQr(l)} className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200">QR</button>
            </li>
          ))}
        </ul>
      )}

      {children}
      {app.message && (
        <div>
          <button onClick={() => setMsg((v) => !v)} className="text-sm font-semibold text-brand-navy">
            {msg ? "▾" : "▸"} ✉️ Message à envoyer
          </button>
          {msg && (
            <div className="mt-2 space-y-2">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm bg-gray-50 border border-gray-100 rounded-xl p-3">{app.message(origin)}</pre>
              <ShareActions subject={app.title} message={app.message(origin)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QrModal({ label, url, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const download = (e) => {
    const canvas = e.currentTarget.closest("[data-qr]").querySelector("canvas");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${hostOf(url).replace(/[^\w]+/g, "-").replace(/-+$/, "")}.png`;
    a.click();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div data-qr className="bg-white rounded-3xl p-6 w-full max-w-sm text-center space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-brand-navy">{label}</p>
        <QRCodeCanvas value={url} size={512} marginSize={2} className="mx-auto w-full h-auto max-w-[280px]" />
        <p className="text-xs text-gray-500 break-all">{url}</p>
        <div className="flex justify-center gap-2">
          <button onClick={download} className="text-sm font-bold px-3.5 py-2 rounded-full bg-gray-900 text-white">Télécharger</button>
          <button onClick={onClose} className="text-sm font-bold px-3.5 py-2 rounded-full bg-white border border-gray-200">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(pw); setPw(""); onDone(); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-brand-cream flex items-start justify-center px-4 pt-16">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-4">
        <img src="/brand/apps360-logo.svg" alt="apps360.fr" className="h-8 w-auto" />
        <h1 className="font-outfit text-xl font-extrabold text-brand-navy">Backoffice</h1>
        <p className="text-sm text-gray-500">Mot de passe super-admin (le même que Jukebox, Clic-Clac, Ami Invisible et Nuage de mots).</p>
        <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-brand-orange outline-none" />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button disabled={busy || !pw} className="w-full bg-brand-navy text-white font-bold py-3 rounded-full disabled:opacity-50">Se connecter</button>
      </form>
    </div>
  );
}
