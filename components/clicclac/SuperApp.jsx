"use client";
/*
 * Clic-Clac — super-admin (/clic-clac/super) : création des albums et de leurs
 * quotas, suivi du stockage, accès (une ligne par destinataire), réglages,
 * prolongation, suppression. Un seul album déplié à la fois.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import DateInput from "@/components/DateInput";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import AdminBar from "@/components/admin/AdminBar";
import PasswordInput from "@/components/PasswordInput";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { api, superToken, storage, formatBytes, formatDate } from "./client";
import { DEFAULT_SETTINGS } from "@/lib/clicclac/settings";
import { guestLink, liveLink, organizerLink, organizerMessage } from "@/lib/clicclac/messages";
import ShareActions from "@/components/jukebox/ShareActions";
import AppIcon from "@/components/AppIcon";

// Ordres de grandeur des offres gratuites (stockage)
const STORAGE_FREE = { supabase: 1e9, r2: 10e9 };
const SOON_DAYS = 7; // alerte avant suppression
const small = "text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-50 disabled:opacity-40";
const cell = "text-xs font-semibold px-2 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap disabled:opacity-40";
const cellOn = "text-xs font-semibold px-2 py-1.5 rounded-full border border-[#ff5a5f] bg-[#ff5a5f] text-white whitespace-nowrap";

export default function SuperApp() {
  const [token, setToken] = useState(undefined);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [openId, setOpenId] = useState(null); // album déplié
  const [fresh, setFresh] = useState(null); // album tout juste créé : panneau d'envoi ouvert
  const [pins, setPins] = useState({}); // codes organisateur connus (création, nouveau code) : jamais relisibles ensuite
  const [dirty, setDirty] = useState(false); // réglages de l'album déplié non enregistrés

  useEffect(() => { setToken(superToken()); setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try { setData(await api("/super/albums", { token })); setLoadErr(""); }
    catch (e) { if (e.status === 401) { storage.set("cc_super", null); setToken(null); } else setLoadErr(e.message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const canLeave = () => !dirty || confirm("Les réglages modifiés ne sont pas enregistrés. Les abandonner ?");
  const flip = (id) => { if (!canLeave()) return; setDirty(false); setFresh(null); setOpenId(openId === id ? null : id); };
  const onPin = (id, pin) => setPins((x) => ({ ...x, [id]: pin }));
  const onCreated = async (r) => {
    setCreating(false); setDirty(false);
    onPin(r.id, r.pin); setFresh(r.id); setOpenId(r.id);
    await load();
  };

  const login = async (e) => {
    e.preventDefault();
    setErr("");
    try { const r = await api("/super/login", { method: "POST", body: { password: pw } }); storage.set("cc_super", r.token); setToken(r.token); setPw(""); }
    catch (e2) { setErr(e2.message); }
  };

  if (token === undefined) return null;
  if (!token) {
    return (
      <Page>
        <form onSubmit={login} className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl p-7 mt-10 space-y-4">
          <h1 className="text-xl font-black">Super-admin Clic-Clac</h1>
          <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#ff5a5f] outline-none" />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button className="w-full bg-gray-900 text-white font-bold py-3 rounded-full">Se connecter</button>
        </form>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#ff5a5f]">Super-admin</p>
          <h1 className="text-3xl font-black text-gray-900">Albums Clic-Clac</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => { setCreating(true); }} className="bg-[#ff5a5f] text-white font-bold px-5 py-2.5 rounded-full">+ Nouvel album</button>
          <button onClick={() => { if (!canLeave()) return; setDirty(false); setOpenId(null); setPins({}); setData(null); storage.set("cc_super", null); setToken(null); }} className="text-sm text-gray-400 underline">Se déconnecter</button>
          <ChangePasswordForm accent="bg-[#ff5a5f]" note="Le même mot de passe sert au super-admin Jukebox."
            onSubmit={(current, next) => api("/super/password", { method: "POST", token, body: { current, next } })} />
        </div>
      </div>

      {data && (() => {
        const r2 = data.storage === "r2", free = STORAGE_FREE[r2 ? "r2" : "supabase"];
        return (
          <div className="bg-white rounded-2xl border border-orange-100 p-4 mb-5">
            <div className="flex justify-between text-sm"><span className="font-semibold">Stockage utilisé (tous albums) · {r2 ? "Cloudflare R2" : "Supabase"}</span><span>{formatBytes(data.totalBytes)} / {r2 ? "10 Go gratuits" : "~1 Go (offre gratuite)"}</span></div>
            <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className={`h-full ${data.totalBytes >= free * 0.8 ? "bg-red-600" : "bg-[#ff5a5f]"}`} style={{ width: `${Math.min(100, (data.totalBytes / free) * 100)}%` }} /></div>
            {data.totalBytes >= free * 0.8 && (
              <p className="text-xs font-semibold text-red-600 mt-1">⚠️ {data.totalBytes >= free ? "Offre gratuite dépassée" : "Plus de 80 % de l'offre gratuite utilisés"}{r2 ? " : au-delà de 10 Go, environ 0,015 $ par Go et par mois (pas de blocage)." : "."}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{r2
              ? "Au-delà de 10 Go : environ 0,015 $ par Go et par mois, sans blocage. Le volume téléchargé (galeries, écran d'affichage, ZIP) est gratuit et illimité."
              : "Le volume téléchargé (consultation des galeries) compte aussi dans l'offre gratuite Supabase (~5 Go/mois, partagés avec les autres applis)."}</p>
            <MigrateR2 token={token} />
          </div>
        );
      })()}

      {creating && <CreateForm token={token} canLeave={canLeave} onCancel={() => setCreating(false)} onCreated={onCreated} />}
      {loadErr && <p className="text-red-600 text-sm mb-3">{loadErr} <button onClick={load} className="underline">Réessayer</button></p>}

      <div className="space-y-2">
        {data?.albums.length === 0 && <p className="text-gray-400 text-center py-10">Aucun album.</p>}
        {data?.albums.map((a) => (
          <AlbumRow key={a.id} a={a} token={token} origin={origin} reload={load} open={openId === a.id} fresh={fresh === a.id}
            pin={pins[a.id]} onPin={(pin) => onPin(a.id, pin)} onFlip={() => flip(a.id)} canLeave={canLeave}
            dirty={openId === a.id && dirty} onDirty={setDirty} onRemoved={() => { setDirty(false); setOpenId(null); load(); }} />
        ))}
      </div>
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen bg-[#fff8f3]">
      <AdminBar current="clicclac" />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link href="/clic-clac" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4">
          <AppIcon app="clicclac" /> Clic-Clac
        </Link>
        {children}
      </div>
    </div>
  );
}

const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-[#ff5a5f] outline-none";

function QuotaFields({ v, set }) {
  return (
    <div className="grid sm:grid-cols-4 gap-3">
      <label className="text-sm">Photos max<input type="number" min={1} max={5000} value={v.maxPhotos} onChange={(e) => set({ maxPhotos: e.target.value })} className={input} /></label>
      <label className="text-sm">Par invité (0 = ∞)<input type="number" min={0} value={v.guestQuota} onChange={(e) => set({ guestQuota: e.target.value })} className={input} /></label>
      <label className="text-sm">Conservation (jours après)<input type="number" min={1} max={365} value={v.retentionDays} onChange={(e) => set({ retentionDays: e.target.value })} className={input} /></label>
      <label className="text-sm flex items-end gap-2 pb-2"><input type="checkbox" checked={v.keepHd} onChange={(e) => set({ keepHd: e.target.checked })} className="w-5 h-5 accent-[#ff5a5f]" /> Garder la HD (impression)</label>
    </div>
  );
}

function CreateForm({ token, canLeave, onCancel, onCreated }) {
  const [v, setV] = useState({ name: "", eventDate: "", adminEmail: "", ...DEFAULT_SETTINGS });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  const submit = async (e) => {
    e.preventDefault();
    if (!canLeave()) return;
    setErr(""); setBusy(true);
    try {
      const { maxPhotos, guestQuota, retentionDays, keepHd } = v;
      const r = await api("/super/albums", { method: "POST", token, body: { name: v.name, eventDate: v.eventDate, adminEmail: v.adminEmail, settings: { maxPhotos, guestQuota, retentionDays, keepHd } } });
      onCreated(r);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border-2 border-[#ff5a5f] p-6 mb-5 space-y-4">
      <h2 className="text-xl font-black">Nouvel album</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">Nom de l'événement<input required maxLength={40} value={v.name} onChange={(e) => set({ name: e.target.value })} className={input} /></label>
        <label className="text-sm">Date<DateInput value={v.eventDate} onChange={(e) => set({ eventDate: e.target.value })} className={input} /></label>
        <label className="text-sm">E-mail organisateur (facultatif : envoi et alertes)<input type="email" value={v.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} className={input} /></label>
      </div>
      <QuotaFields v={v} set={set} />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="bg-[#ff5a5f] text-white font-bold px-6 py-2.5 rounded-full disabled:opacity-50">Créer</button>
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-full bg-gray-100 font-semibold">Annuler</button>
      </div>
    </form>
  );
}

/* Réglages modifiables d'un album, tels qu'affichés (textes et nombres). */
const pick = (a) => ({
  name: a.name, eventDate: a.event_date || "", adminEmail: a.admin_email || "",
  maxPhotos: a.settings.maxPhotos, guestQuota: a.settings.guestQuota, retentionDays: a.settings.retentionDays, keepHd: a.settings.keepHd,
});
const same = (x, y) => Object.keys(x).every((k) => String(x[k]) === String(y[k]));

function AlbumRow({ a, token, origin, reload, open, fresh, pin, onPin, onFlip, canLeave, dirty, onDirty, onRemoved }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const s = a.settings;
  const daysLeft = a.expires_at ? Math.max(0, Math.ceil((new Date(a.expires_at) - Date.now()) / 864e5)) : null;
  const soon = daysLeft !== null && daysLeft <= SOON_DAYS;
  // action sur l'album ; une erreur s'affiche dans cet album
  const run = async (fn) => {
    setBusy(true); setErr("");
    try { return await fn(); } catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  };
  const patch = (body) => api(`/super/albums/${a.id}`, { method: "PATCH", token, body });
  const extend = () => run(async () => { await patch({ extendDays: 30 }); await reload(); });
  const newCode = () => confirm(`Générer un nouveau code organisateur pour « ${a.name} » ?\n\nL'ancien code et les liens déjà envoyés ne fonctionneront plus ; les appareils de l'organisateur et les bornes seront déconnectés.`)
    && run(async () => { const r = await patch({ regenPin: true }); onPin(r.pin); });
  const remove = () => confirm(`Supprimer définitivement « ${a.name} » et ses ${a.usage.photos} photos ?`)
    && run(async () => { await api(`/super/albums/${a.id}`, { method: "DELETE", token }); onRemoved(); });

  return (
    <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden">
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-x-3 gap-y-2 px-4 py-3">
        <button onClick={onFlip} className={`flex-1 min-w-0 text-left ${soon && !open ? "basis-full sm:basis-0" : ""}`} aria-expanded={open}>
          <span className="block font-bold text-gray-900 truncate">{a.name}</span>
          <span className="block text-xs text-gray-500">
            <span className="font-mono font-bold text-[#ff5a5f] tracking-wider">{a.code}</span>
            {a.event_date && ` · ${formatDate(a.event_date)}`} · {a.usage.photos} / {s.maxPhotos} photos · {formatBytes(a.usage.bytes)}
            {a.usage.pending > 0 && <span className="font-semibold text-amber-700"> · {a.usage.pending} à valider</span>}
            {soon && <span className="font-semibold text-red-600"> · ⚠️ supprimé {daysLeft ? `dans ${daysLeft} j` : "bientôt"}</span>}
          </span>
        </button>
        {soon && !open && <button onClick={extend} disabled={busy} className={`${small} shrink-0`}>+30 jours</button>}
        <Link href={`/clic-clac/${a.code}/admin`} onClick={(e) => { if (!canLeave()) e.preventDefault(); }}
          className="text-xs sm:text-sm font-bold bg-gray-900 text-white px-3 py-1.5 rounded-full shrink-0">Organiser</Link>
        <button onClick={onFlip} className="text-gray-400 text-sm shrink-0" aria-label={open ? "Replier" : "Déplier"}>{open ? "▲" : "▼"}</button>
      </div>
      {err && <p className="px-4 pb-3 text-sm text-red-600">{err}</p>}

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5 text-sm">
          <Access key={pin || "row"} a={a} token={token} origin={origin} pin={pin} fresh={fresh} busy={busy} dirty={dirty} onNewCode={newCode} canLeave={canLeave} reload={reload} />
          {/* toujours monté : les modifications survivent au repli */}
          <details className="border-t border-gray-100 pt-4">
            <summary className="cursor-pointer font-bold text-gray-900">⚙️ Réglages{dirty && <span className="ml-2 text-xs font-semibold text-amber-700">modifiés, non enregistrés</span>}</summary>
            <Edit a={a} patch={patch} reload={reload} onDirty={onDirty} />
          </details>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mr-auto">Créé le {formatDate(a.created_at)} · suppression le <b className={soon ? "text-red-600" : ""}>{formatDate(a.expires_at)}</b></p>
            <button onClick={extend} disabled={busy} className={small}>+30 jours</button>
            <button onClick={remove} disabled={busy} className="text-xs text-red-500 underline disabled:opacity-40">Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Edit({ a, patch, reload, onDirty }) {
  const [base, setBase] = useState(() => pick(a));
  const [v, setV] = useState(base);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = !same(v, base);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  // liste actualisée : reprise seulement s'il n'y a rien en cours de modification
  useEffect(() => {
    const now = pick(a);
    if (!dirty && !same(now, base)) { setBase(now); setV(now); }
  }, [a, dirty, base]);
  const set = (p) => { setV((x) => ({ ...x, ...p })); setSaved(false); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { maxPhotos, guestQuota, retentionDays, keepHd } = v;
      await patch({ name: v.name, eventDate: v.eventDate, adminEmail: v.adminEmail, settings: { maxPhotos, guestQuota, retentionDays, keepHd } });
      await reload(); // avant setBase : la liste à jour ne doit pas rétablir les anciennes valeurs
      setBase(v); setSaved(true);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="pt-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">Nom<input required maxLength={40} value={v.name} onChange={(e) => set({ name: e.target.value })} className={input} /></label>
        <label className="text-sm">Date<DateInput value={v.eventDate} onChange={(e) => set({ eventDate: e.target.value })} className={input} /></label>
        <label className="text-sm">E-mail organisateur<input type="email" value={v.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} className={input} /></label>
      </div>
      <QuotaFields v={v} set={set} />
      <p className="text-xs text-gray-400">Changer la date ou la durée de conservation recalcule la date de suppression (une prolongation est alors perdue). Modération, cadres, filtres : bouton Organiser.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || !dirty} className="bg-[#ff5a5f] disabled:opacity-40 text-white font-bold px-5 py-2 rounded-full text-sm">Enregistrer</button>
        {dirty && <button type="button" onClick={() => setV(base)} className={small}>Annuler</button>}
        {saved && !dirty && <span className="font-semibold text-green-600">✓ Enregistré</span>}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </form>
  );
}

/* Accès d'un album : une ligne par destinataire, mêmes actions dans le même ordre.
 * Le lien organisateur (connexion directe, 7 jours) est créé à la demande, puis
 * réutilisé ; un nouveau code l'annule (composant remonté : key). */
function Access({ a, token, origin, pin, fresh, busy, dirty, onNewCode, canLeave, reload }) {
  const [panel, setPanel] = useState(pin ? "organizer" : null); // organizer | qr
  const [link, setLink] = useState(null); // { pass, expiresAt }
  const [err, setErr] = useState("");
  const pending = useRef(null);
  const flip = (k) => setPanel(panel === k ? null : k);
  const getLink = useCallback(() => {
    pending.current ??= api(`/${a.code}/auth`, { method: "POST", token, body: { pass: true, long: true } })
      .then((l) => { setLink(l); setErr(""); return l; })
      .catch((e) => { pending.current = null; setErr(e.message); throw e; });
    return pending.current;
  }, [a.code, token]);
  useEffect(() => { if (panel === "organizer") getLink().catch(() => {}); }, [panel, getLink]);

  const rows = [
    { kind: "organizer", icon: "👤", title: "Organisateur", href: `/clic-clac/${a.code}/admin`,
      copy: async () => organizerLink(origin, a.code, (await getLink()).pass),
      hint: <>{pin ? <>Code organisateur <b className="font-mono tracking-wider text-gray-900">{pin}</b> (affiché une seule fois) · </> : "Lien de connexion directe, 7 jours · "}
        <button onClick={onNewCode} disabled={busy} className="underline">nouveau code</button></> },
    { kind: "guest", icon: "📱", title: "Invités", href: guestLink("", a.code), copy: async () => guestLink(origin, a.code), qr: true,
      hint: <>Prennent et voient les photos · code <b className="font-mono tracking-wider">{a.code}</b></> },
    { kind: "live", icon: "📺", title: "Écran d'affichage", href: liveLink("", a.code), copy: async () => liveLink(origin, a.code), tab: true,
      hint: <>Diaporama en direct ; sur une télé, ouvrir <b>apps360.fr/tv</b></> },
  ];
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-gray-900">Accès</h3>
      {fresh && <p className="font-semibold text-green-600">✓ Album créé : envoyez son accès à l'organisateur.</p>}
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
        {rows.map((r) => (
          <div key={r.kind} className="p-3 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{r.icon} {r.title}</p>
                <p className="text-xs text-gray-500">{r.hint}</p>
              </div>
              {/* colonnes de même largeur d'une ligne à l'autre */}
              <div className="grid grid-cols-[4fr_5fr_4fr] sm:grid-cols-[5.5rem_8.5rem_6.5rem] gap-1.5 text-center">
                {r.tab
                  ? <a href={r.href} target="_blank" rel="noopener" className={cell}>Ouvrir ↗</a>
                  : <Link href={r.href} onClick={(e) => { if (!canLeave()) e.preventDefault(); }} className={cell}>Ouvrir</Link>}
                <CopyLink get={r.copy} />
                {r.kind === "organizer" && <button onClick={() => flip("organizer")} aria-expanded={panel === "organizer"} className={panel === "organizer" ? cellOn : cell}>Envoyer {panel === "organizer" ? "▴" : "▾"}</button>}
                {r.qr && <button onClick={() => flip("qr")} aria-expanded={panel === "qr"} className={panel === "qr" ? cellOn : cell}>QR {panel === "qr" ? "▴" : "▾"}</button>}
              </div>
            </div>
            {r.kind === "organizer" && err && <p className="text-red-600">{err} <button onClick={() => getLink().catch(() => {})} className="underline">Réessayer</button></p>}
            {r.kind === "organizer" && panel === "organizer" && link && <Send a={a} token={token} origin={origin} link={link} pin={pin} busy={busy} dirty={dirty} onNewCode={onNewCode} reload={reload} />}
            {r.kind === "organizer" && panel === "organizer" && !link && !err && <p className="text-gray-400">Préparation…</p>}
            {r.qr && panel === "qr" && <Qr code={a.code} url={guestLink(origin, a.code)} />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* Copie ; si le navigateur refuse (Safari, après une attente), le lien s'affiche à copier. */
function CopyLink({ get }) {
  const [done, setDone] = useState(false);
  const [shown, setShown] = useState("");
  const copy = async () => {
    let url = "";
    try {
      url = await get();
      await navigator.clipboard.writeText(url);
      setShown(""); setDone(true); setTimeout(() => setDone(false), 2000);
    } catch (e) { if (url) setShown(url); }
  };
  return (
    <>
      <button type="button" onClick={copy} className={cell}>{done ? "✓ Copié" : "Copier le lien"}</button>
      {shown && <input readOnly autoFocus value={shown} onFocus={(e) => e.target.select()} aria-label="Lien à copier" className={`${input} order-last col-span-full font-mono text-xs`} />}
    </>
  );
}

/* QR code des invités, à télécharger. */
function Qr({ code, url }) {
  const qr = useRef(null);
  const save = () => {
    const l = document.createElement("a");
    l.href = qr.current.toDataURL("image/png");
    l.download = `clic-clac-${code}-qr.png`;
    l.click();
  };
  return (
    <div className="flex items-center gap-4">
      <QRCodeCanvas ref={qr} value={url} size={512} marginSize={2} style={{ width: 112, height: 112 }} />
      <button onClick={save} className={small}>⬇ Télécharger (PNG)</button>
    </div>
  );
}

/* Message prêt à envoyer à l'organisateur (QR code invités joint à l'e-mail d'apps360). */
function Send({ a, token, origin, link, pin, busy, dirty, onNewCode, reload }) {
  const [to, setTo] = useState(a.admin_email || "");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const qrRef = useRef(null);
  const m = organizerMessage(origin, a, link, pin);
  const send = async (e) => {
    e.preventDefault();
    setSending(true); setSent(""); setErr("");
    try {
      const qr = qrRef.current?.querySelector("canvas")?.toDataURL("image/png").split(",")[1];
      const r = await api(`/super/albums/${a.id}/recap`, { method: "POST", token, body: { to, message, qr, ...(pin ? { pin } : {}) } });
      setSent(`✓ Envoyé à ${r.to}`);
      reload();
    } catch (e2) { setErr(e2.message); } finally { setSending(false); }
  };
  return (
    <div className="bg-gray-50 border rounded-xl p-3 space-y-3">
      <div ref={qrRef} className="hidden"><QRCodeCanvas value={guestLink(origin, a.code)} size={512} marginSize={2} /></div>
      {dirty && <p className="text-amber-700">Réglages modifiés non enregistrés : le message reprend les anciens.</p>}
      <pre className="whitespace-pre-wrap break-words font-sans text-sm">{m.text}</pre>
      {!pin && <p className="text-xs text-amber-700">Message sans code organisateur (il n'est pas relisible). Si l'organisateur ne l'a plus : <button onClick={onNewCode} disabled={busy} className="underline font-semibold">inclure un nouveau code</button> (l'ancien et les liens déjà envoyés ne fonctionneront plus).</p>}
      <ShareActions subject={m.subject} message={m.text} />
      <form onSubmit={send} className="space-y-2">
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message personnel" placeholder="Message personnel (facultatif, e-mail apps360 seulement)" className={`${input} bg-white resize-none`} />
        <div className="flex flex-wrap items-center gap-2">
          <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} aria-label="Adresse e-mail" placeholder="adresse@exemple.fr" className={`${input} bg-white flex-1 min-w-48`} />
          <button disabled={sending || busy} className="bg-[#ff5a5f] disabled:opacity-40 text-white font-bold px-4 py-2 rounded-full text-sm">{sending ? "Envoi…" : "Envoyer depuis apps360"}</button>
        </div>
        <p className="text-xs text-gray-400">L'e-mail d'apps360 contient aussi le QR code des invités en pièce jointe, les quotas et la date de suppression.</p>
      </form>
      {sent && <p className="font-semibold text-green-600">{sent}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}

/* Copie des fichiers Supabase → R2 (par lots, relancée jusqu'au bout). */
function MigrateR2({ token }) {
  const [state, setState] = useState(null);
  const run = async () => {
    let offset = 0, copied = 0, skipped = 0, missing = [];
    setState({ running: true, offset: 0, total: null, copied, skipped, missing });
    try {
      for (;;) {
        const r = await api("/super/migrate-r2", { method: "POST", token, body: { offset } });
        offset = r.offset; copied += r.copied; skipped += r.skipped; missing = missing.concat(r.missing);
        setState({ running: !r.done, offset, total: r.total, copied, skipped, missing });
        if (r.done) break;
      }
    } catch (e) {
      setState((s) => ({ ...s, running: false, error: e.message }));
    }
  };
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-gray-500">Copie des photos vers Cloudflare R2</summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-gray-400">Copie dans R2 les fichiers stockés chez Supabase (rien n'est supprimé chez Supabase). Les fichiers déjà copiés sont sautés : on peut relancer sans risque.</p>
        <button disabled={state?.running} onClick={run} className="bg-gray-900 text-white font-semibold px-4 py-2 rounded-full disabled:opacity-50">
          {state?.running ? "Copie en cours…" : "Lancer la copie"}
        </button>
        {state && (
          <p className="text-xs">
            {state.total != null && <>{state.offset} / {state.total} fichiers vérifiés · </>}
            {state.copied} copiés · {state.skipped} déjà présents
            {state.missing.length > 0 && <> · <span className="text-red-500">{state.missing.length} introuvables chez Supabase</span></>}
            {!state.running && !state.error && state.total != null && <> · <b className="text-green-600">terminé ✓</b></>}
            {state.error && <> · <span className="text-red-500">{state.error}</span></>}
          </p>
        )}
      </div>
    </details>
  );
}
