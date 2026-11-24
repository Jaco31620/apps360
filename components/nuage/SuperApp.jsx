"use client";
/*
 * Nuage de mots — super-admin (/nuage/super) : tous les nuages, accès à leur
 * écran organisateur (modération, réglages), création, duplication, envoi des
 * accès (avec ou sans compte), note, conservation, fermeture, suppression.
 * Connexion commune du backoffice (components/admin/session.js) : déjà connecté
 * au backoffice → aucun mot de passe. Une lecture à l'ouverture, puis seulement
 * sur « Actualiser ».
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import AdminBar from "@/components/admin/AdminBar";
import { appToken, dropApp, ensureApp, login, logout } from "@/components/admin/session";
import PasswordInput from "@/components/PasswordInput";
import ShareActions from "@/components/jukebox/ShareActions";
import AppIcon from "@/components/AppIcon";
import { formatCode } from "./storage";
import DateInput from "@/components/DateInput";
import { DEFAULT_MAX_PER_PARTICIPANT, MAX_CHOICES, MAX_QUESTION_LEN, maxLabel } from "@/lib/nuage";
import { nuageMessage, guestLink, presenterLink, viewLink, fmtPresenterCode } from "@/lib/nuageMessages";

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

function ago(iso) {
  const d = Date.now() - Date.parse(iso);
  if (d < 90e3) return "à l'instant";
  if (d < 3600e3) return `il y a ${Math.round(d / 60e3)} min`;
  if (d < 48 * 3600e3) return `il y a ${Math.round(d / 3600e3)} h`;
  return `il y a ${Math.round(d / 86400e3)} j`;
}
/* Jours avant suppression automatique, si c'est pour bientôt (30 jours). */
const soon = (n) => {
  const d = n.purgeAt ? Math.max(0, Math.ceil((Date.parse(n.purgeAt) - Date.now()) / 86400e3)) : Infinity;
  return d <= 30 ? d : null;
};
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none";
const small = "text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-50 disabled:opacity-40";
const cell = "text-xs font-semibold px-2 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap";
const cellOn = "text-xs font-semibold px-2 py-1.5 rounded-full border border-violet-600 bg-violet-600 text-white whitespace-nowrap";
const FILTERS = [["all", "Tous"], ["open", "Ouverts"], ["closed", "Fermés"], ["empty", "Sans mot"], ["keep", "Conservés"]];
const keep = { all: () => true, open: (n) => n.status === "open", closed: (n) => n.status !== "open", empty: (n) => !n.words, keep: (n) => n.keep };

export default function SuperApp() {
  const [authed, setAuthed] = useState(undefined);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // { total, nuages }
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [openCode, setOpenCode] = useState(null); // nuage dont les accès sont dépliés
  const [start, setStart] = useState(null); // accès ouverts d'office après création { code, to, ok, error }
  const [rowErr, setRowErr] = useState(""); // erreur affichée dans le nuage déplié
  const [dirty, setDirty] = useState(false); // réglages du nuage déplié non enregistrés
  const [creating, setCreating] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [found, setFound] = useState(null); // { q, codes } : recherche dans les mots

  useEffect(() => { ensureApp("nuage").then(() => setAuthed(!!appToken("nuage"))); }, []);

  // onErr : où afficher l'erreur (sinon en haut de page)
  const call = useCallback(async (body, onErr) => {
    setErr(""); onErr?.(""); setBusy(true);
    try {
      if (!appToken("nuage")) await ensureApp("nuage"); // jeton expiré page ouverte
      return await api(body);
    } catch (e) {
      if (e.status === 401) { dropApp("nuage"); setAuthed(false); setErr("Session expirée : reconnectez-vous."); }
      else (onErr || setErr)(e.message);
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

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const canLeave = () => !dirty || confirm("Les réglages modifiés ne sont pas enregistrés. Les abandonner ?");
  const show = (code) => { setDirty(false); setRowErr(""); setStart(null); setOpenCode(code); };
  const flip = (n) => { if (canLeave()) show(openCode === n.code ? null : n.code); };
  const toggle = async (n) => {
    const action = n.status === "open" ? "close" : "open";
    if (await call({ action, code: n.code }, setRowErr)) patch(n.code, { status: action === "open" ? "open" : "closed", activeAt: new Date().toISOString(), purgeAt: n.keep ? null : new Date(Date.now() + 183 * 86400e3).toISOString() });
  };
  const patch = (code, p) => setData((d) => ({ ...d, nuages: d.nuages.map((x) => (x.code === code ? { ...x, ...p } : x)) }));
  const newCode = async (n) => {
    if (!confirm(`Nouveau code organisateur pour « ${n.question} » ?\nL'ancien code et tous les appareils organisateurs perdront l'accès.`)) return;
    const r = await call({ action: "newcode", code: n.code }, setRowErr);
    if (r) patch(n.code, { presenterCode: r.presenterCode });
  };
  const added = (n, after = {}) => { // nouveau nuage en tête, accès dépliés
    setData((d) => ({ total: d.total + 1, nuages: [n, ...d.nuages] }));
    setQ(""); setFilter("all"); setFrom(""); setTo(""); setFound(null);
    show(n.code);
    setStart({ code: n.code, ...after });
  };
  const duplicate = async (n) => {
    if (!canLeave()) return;
    const r = await call({ action: "duplicate", code: n.code }, setRowErr);
    if (r) added(r.nuage);
  };
  const findWord = async () => { const r = await call({ action: "find", q }); if (r) setFound({ q, codes: new Set(r.codes) }); };
  const remove = async (n) => {
    if (!confirm(`Supprimer définitivement « ${n.question} » (${plural(n.words, "mot")}) ?`)) return;
    if (await call({ action: "delete", code: n.code }, setRowErr)) {
      setData((d) => ({ total: d.total - 1, nuages: d.nuages.filter((x) => x.code !== n.code) }));
      show(null);
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
  const day = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const inPeriod = (n) => (!from || day(n.activeAt) >= from) && (!to || day(n.createdAt) <= to); // vie du nuage ∩ période
  const matches = (n) => !needle || [n.question, n.note].some((x) => x.toLowerCase().includes(needle)) || (digits && n.code.includes(digits)) || (found?.q === q && found.codes.has(n.code));
  const shown = all.filter((n) => (n.code === openCode && dirty) // en cours de modification : reste affiché
    || (keep[filter](n) && inPeriod(n) && matches(n)));
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
          <button onClick={() => setCreating(true)} disabled={creating} className="bg-violet-600 text-white font-bold px-4 py-2 rounded-full text-sm disabled:opacity-40">+ Nouveau nuage</button>
          <button onClick={load} disabled={busy} className="border-2 border-gray-200 font-bold px-4 py-2 rounded-full text-sm disabled:opacity-40">↻ Actualiser</button>
          <button onClick={() => { logout(); setData(null); setOpenCode(null); setAuthed(false); }} className="text-sm text-gray-400 underline" title="Déconnecte aussi le backoffice et les autres super-admins">Se déconnecter</button>
        </div>
      </div>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {creating && <Create call={call} busy={busy} canLeave={canLeave} onCreated={(n, after) => { setCreating(false); added(n, after); }} onCancel={() => setCreating(false)} />}
      {all.length > 0 && (
        <div className="space-y-3 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (question, code, note)" className={`${input} bg-white`} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            Actif entre <DateInput value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Du" className="border border-gray-200 rounded-lg px-2 py-1 bg-white" />
            et <DateInput value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Au" className="border border-gray-200 rounded-lg px-2 py-1 bg-white" />
            {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="underline">Effacer</button>}
            {needle.length > 1 && <button onClick={findWord} disabled={busy} className={small}>Chercher aussi dans les mots envoyés</button>}
            {found?.q === q && <span>{plural(found.codes.size, "nuage")} avec ce mot</span>}
          </div>
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
          <div key={n.code} className="bg-white rounded-2xl border border-sky-100 overflow-hidden">
            {/* ligne compacte */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => flip(n)} className="flex-1 min-w-0 flex items-center gap-3 text-left" aria-expanded={openCode === n.code}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${n.status === "open" ? "bg-green-500" : "bg-gray-300"}`} title={n.status === "open" ? "Envois ouverts" : "Envois fermés"} />
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900 truncate">{n.question}</span>
                  {n.note && <span className="block text-xs text-violet-700 truncate">📝 {n.note}</span>}
                  <span className="block text-xs text-gray-500">
                    <span className="font-mono font-bold text-violet-600">{formatCode(n.code)}</span>
                    {n.status !== "open" && " · 🔒 fermé"} · {plural(n.words, "mot")} · actif {ago(n.activeAt)}
                    {n.owned && " · 👤 compte"}{n.keep && " · 📌 conservé"}
                    {soon(n) !== null && <span className="font-semibold text-amber-700"> · ⚠️ supprimé {soon(n) ? `dans ${soon(n)} j` : "bientôt"}</span>}
                  </span>
                </span>
              </button>
              <a href={`/nuage/${n.code}/presenter?super`} target="_blank" rel="noopener" className="text-xs sm:text-sm font-bold bg-gray-900 text-white px-3 py-1.5 rounded-full shrink-0">Organiser ↗</a>
              <button onClick={() => flip(n)} className="text-gray-400 text-sm shrink-0" aria-label={openCode === n.code ? "Replier" : "Déplier"}>{openCode === n.code ? "▲" : "▼"}</button>
            </div>

            {openCode === n.code && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-5 text-sm">
                {rowErr && <p className="text-red-600">{rowErr}</p>}
                <Access key={start?.code === n.code ? "new" : "row"} n={n} call={call} busy={busy} dirty={dirty} start={start?.code === n.code ? start : null}
                  onToggle={() => toggle(n)} onNewCode={() => newCode(n)} canLeave={canLeave} />
                {/* toujours monté : les modifications survivent au repli */}
                <details className="border-t border-gray-100 pt-4">
                  <summary className="cursor-pointer font-bold text-gray-900">⚙️ Réglages{dirty && <span className="ml-2 text-xs font-semibold text-amber-700">modifiés, non enregistrés</span>}</summary>
                  <div className="pt-3"><Edit n={n} call={call} busy={busy} onDirty={setDirty} onSaved={(x) => patch(n.code, x)} /></div>
                </details>
                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 mr-auto">
                    Créé le {fmtDay(n.createdAt)} · {n.keep ? "conservé : jamais supprimé automatiquement" : `suppression automatique le ${fmtDay(n.purgeAt)} sans nouvelle activité`}
                  </p>
                  <button onClick={() => duplicate(n)} disabled={busy} className={small}>Dupliquer</button>
                  <button onClick={() => remove(n)} disabled={busy} className="text-xs text-red-500 underline disabled:opacity-40">Supprimer</button>
                </div>
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

/* Champ avec étiquette. */
function Field({ label, children }) {
  return <label className="block space-y-1"><span className="text-xs font-semibold text-gray-600">{label}</span>{children}</label>;
}
const Optional = () => <span className="font-normal text-gray-400">(facultatif)</span>;

/* Champs communs à la création et aux réglages. */
function Fields({ v, set, children }) {
  return (
    <>
      <Field label="Question"><textarea rows={2} maxLength={MAX_QUESTION_LEN} value={v.question} onChange={(e) => set({ question: e.target.value })} className={input} /></Field>
      <Field label={<>Note interne <Optional /></>}><input value={v.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="Organisateur, événement…" className={input} /></Field>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
        <label>Mots par participant{" "}
          <select value={v.max} onChange={(e) => set({ max: Number(e.target.value) })} className="border-2 border-gray-200 rounded-xl px-2 py-1">
            {MAX_CHOICES.map((m) => <option key={m} value={m}>{maxLabel(m)}</option>)}
          </select>
        </label>
        {children}
        <Check label="Autoriser l'envoi de l'image par e-mail, même sans compte" checked={v.mailOk} onChange={(mailOk) => set({ mailOk })} />
      </div>
    </>
  );
}
function Check({ label, checked, onChange }) {
  return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-violet-600" /> {label}</label>;
}

/* Réglages modifiables sur place (style et modération : écran organisateur). */
const KEYS = ["question", "max", "note", "keep", "mailOk"];
const pick = (n) => Object.fromEntries(KEYS.map((k) => [k, n[k]]));
const same = (a, b) => KEYS.every((k) => a[k] === b[k]);
function Edit({ n, call, busy, onDirty, onSaved }) {
  const [base, setBase] = useState(() => pick(n));
  const [v, setV] = useState(base);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const dirty = !same(v, base);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  // liste actualisée : reprise seulement s'il n'y a rien en cours de modification
  useEffect(() => {
    const fresh = pick(n);
    if (!dirty && !same(fresh, base)) { setBase(fresh); setV(fresh); }
  }, [n, dirty, base]);
  const set = (p) => { setV({ ...v, ...p }); setSaved(false); };
  const submit = async (e) => {
    e.preventDefault();
    const r = await call({ action: "edit", code: n.code, ...v }, setErr);
    if (!r) return;
    const fresh = pick(r.nuage);
    onSaved(r.nuage);
    setBase(fresh); setV(fresh); setSaved(true);
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Fields v={v} set={set}>
        <Check label="Conserver (jamais supprimé automatiquement)" checked={v.keep} onChange={(keepIt) => set({ keep: keepIt })} />
      </Fields>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || !dirty || !v.question.trim()} className="bg-violet-600 disabled:opacity-40 text-white font-bold px-5 py-2 rounded-full text-sm">Enregistrer</button>
        {dirty && <button type="button" onClick={() => setV(base)} className={small}>Annuler</button>}
        {saved && !dirty && <span className="font-semibold text-green-600">✓ Enregistré</span>}
        {err && <span className="text-red-600">{err}</span>}
        <span className="text-xs text-gray-400">Style et modération des mots : bouton Organiser.</span>
      </div>
    </form>
  );
}

/* Création ; « Créer et envoyer » si une adresse est donnée (non gardée). */
function Create({ call, busy, canLeave, onCreated, onCancel }) {
  const [v, setV] = useState({ question: "", note: "", max: DEFAULT_MAX_PER_PARTICIPANT, open: true, mailOk: true });
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");
  const set = (p) => setV({ ...v, ...p });
  const mail = to.trim();
  const submit = async (e) => {
    e.preventDefault();
    if (!canLeave()) return;
    const r = await call({ action: "create", ...v }, setErr);
    if (!r) return;
    if (!mail) return onCreated(r.nuage, { ok: "✓ Nuage créé" });
    // envoi raté : le nuage est gardé, l'envoi se refait depuis ses accès
    let error = "";
    const sent = await call({ action: "send", code: r.nuage.code, kind: "presenter", to: mail }, (m) => { error = m; });
    onCreated(r.nuage, sent ? { ok: `✓ Nuage créé, accès envoyé à ${mail}` } : { to: mail, ok: "✓ Nuage créé", error: `L'e-mail n'est pas parti : ${error || "service indisponible."} Réessayez ci-dessous.` });
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-violet-200 p-4 space-y-3 mb-4">
      <h2 className="font-bold">Nouveau nuage</h2>
      <Fields v={v} set={set}>
        <Check label="Envois ouverts" checked={v.open} onChange={(open) => set({ open })} />
      </Fields>
      <Field label={<>Envoyer l'accès organisateur à <Optional /></>}>
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="adresse@exemple.fr (non gardée)" className={input} />
      </Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy || !v.question.trim()} className="bg-violet-600 disabled:opacity-40 text-white font-bold px-5 py-2 rounded-full text-sm">{mail ? "Créer et envoyer" : "Créer"}</button>
        <button type="button" onClick={onCancel} className={small}>Annuler</button>
      </div>
    </form>
  );
}

/* Accès d'un nuage : une ligne par destinataire, mêmes actions dans le même
 * ordre (ouvrir, copier le lien, envoyer). Un seul panneau ouvert à la fois. */
function Access({ n, call, busy, dirty, start, onToggle, onNewCode, canLeave }) {
  const [panel, setPanel] = useState(start ? "presenter" : null); // presenter | guest | view | qr
  const origin = window.location.origin;
  const open = n.status === "open";
  const flip = (k) => setPanel(panel === k ? null : k);
  const rows = [
    { kind: "presenter", icon: "👤", title: "Organisateur", url: presenterLink(origin, n), href: `/nuage/${n.code}/presenter?super`, tab: true,
      hint: <>Pilote le nuage · code <b className="font-mono tracking-wider">{fmtPresenterCode(n.presenterCode)}</b> <button onClick={onNewCode} disabled={busy} className="underline">changer</button></> },
    { kind: "guest", icon: "📱", title: "Participants", url: guestLink(origin, n.code), href: guestLink("", n.code), qr: true,
      hint: <>Envoient leurs mots · code <b className="font-mono tracking-wider">{formatCode(n.code)}</b></> },
    { kind: "view", icon: "📺", title: "Écran d'affichage", url: viewLink(origin, n.code), href: viewLink("", n.code), tab: true,
      hint: "Le nuage sans réglages, pour une télé ou pour le revoir" },
  ];
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-gray-900 mr-auto">Accès</h3>
        <span className="text-xs text-gray-600">{open ? "🟢 Envois ouverts" : "🔒 Envois fermés"}</span>
        <button onClick={onToggle} disabled={busy} className={`${small} font-bold`}>{open ? "Fermer" : "Ouvrir"}</button>
      </div>
      {start?.ok && <p className="font-semibold text-green-600">{start.ok}</p>}
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
        {rows.map((r) => (
          <div key={r.kind} className="p-3 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{r.icon} {r.title}</p>
                <p className="text-xs text-gray-500">{r.hint}</p>
              </div>
              {/* colonnes de même largeur d'une ligne à l'autre */}
              <div className="grid grid-cols-3 sm:grid-cols-[5.5rem_8.5rem_6.5rem_4.5rem] gap-1.5 text-center">
                {r.tab
                  ? <a href={r.href} target="_blank" rel="noopener" className={cell}>Ouvrir ↗</a>
                  : <Link href={r.href} onClick={(e) => { if (!canLeave()) e.preventDefault(); }} className={cell}>Ouvrir</Link>}
                <CopyLink label="Copier le lien" url={r.url} />
                <button onClick={() => flip(r.kind)} aria-expanded={panel === r.kind} className={panel === r.kind ? cellOn : cell}>Envoyer {panel === r.kind ? "▴" : "▾"}</button>
                {r.qr && <button onClick={() => flip("qr")} aria-expanded={panel === "qr"} className={panel === "qr" ? cellOn : cell}>QR {panel === "qr" ? "▴" : "▾"}</button>}
              </div>
            </div>
            {r.qr && panel === "qr" && <Qr n={n} url={r.url} />}
            {panel === r.kind && <Send n={n} kind={r.kind} call={call} busy={busy} dirty={dirty} start={r.kind === "presenter" ? start : null} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function CopyLink({ label, url }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); } catch (e) { /* refusé */ }
  };
  return <button type="button" onClick={copy} className={cell}>{done ? "✓ Copié" : label}</button>;
}

/* QR code des participants, à télécharger. */
function Qr({ n, url }) {
  const qr = useRef(null);
  const save = () => {
    const a = document.createElement("a");
    a.href = qr.current.toDataURL("image/png");
    a.download = `nuage-${n.code}-qr.png`;
    a.click();
  };
  return (
    <div className="flex items-center gap-4">
      <QRCodeCanvas ref={qr} value={url} size={512} marginSize={2} style={{ width: 112, height: 112 }} />
      <button onClick={save} className={small}>⬇ Télécharger (PNG)</button>
    </div>
  );
}

/* Message prêt à envoyer à un destinataire. */
function Send({ n, kind, call, busy, dirty, start }) {
  const [to, setTo] = useState(start?.to || "");
  const [sent, setSent] = useState("");
  const [err, setErr] = useState(start?.error || "");

  useEffect(() => { // organisateur avec un compte : adresse préremplie
    let alive = true;
    if (n.owned && kind === "presenter") call({ action: "owner", code: n.code }, () => {}).then((r) => { if (alive && r?.email) setTo((t) => t || r.email); });
    return () => { alive = false; };
  }, [n.code, n.owned, kind, call]);

  if (dirty) return <p className="text-amber-700">Enregistrez d'abord les réglages modifiés : le message reprendrait l'ancienne question.</p>;
  const m = nuageMessage(kind, window.location.origin, n);
  const send = async (e) => {
    e.preventDefault();
    setSent("");
    if (await call({ action: "send", code: n.code, kind, to }, setErr)) setSent(`✓ Envoyé à ${to}`);
  };
  return (
    <div className="bg-gray-50 border rounded-xl p-3 space-y-3">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm">{m.text}</pre>
      {kind === "guest" && n.status !== "open" && <p className="text-xs text-amber-700">Les envois sont fermés : les participants ne pourront pas répondre pour l'instant.</p>}
      {kind === "view" && n.status === "open" && <p className="text-xs text-amber-700">Les envois sont ouverts : cette page affiche le QR code pour participer.</p>}
      <ShareActions subject={m.subject} message={m.text} />
      <form onSubmit={send} className="flex flex-wrap items-center gap-2">
        <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} aria-label="Adresse e-mail" placeholder="adresse@exemple.fr (non gardée)" className={`${input} bg-white flex-1 min-w-48`} />
        <button disabled={busy} className="bg-sky-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-full text-sm">Envoyer depuis apps360</button>
      </form>
      {sent && <p className="font-semibold text-green-600">{sent}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
