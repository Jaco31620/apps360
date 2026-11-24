"use client";
/*
 * Nuage de mots — super-admin (/nuage/super) : tous les nuages, accès à leur
 * écran présentateur (modération, réglages), création, duplication, envoi des
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
import { nuageMessage, guestLink, viewLink, fmtPresenterCode } from "@/lib/nuageMessages";

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
  const [creating, setCreating] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [found, setFound] = useState(null); // { q, codes } : recherche dans les mots

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

  const flip = (n) => setOpenCode(openCode === n.code ? null : n.code);
  const patch = (code, p) => setData((d) => ({ ...d, nuages: d.nuages.map((x) => (x.code === code ? { ...x, ...p } : x)) }));
  const newCode = async (n) => {
    if (!confirm(`Nouveau code présentateur pour « ${n.question} » ?\nL'ancien code et tous les appareils présentateurs perdront l'accès.`)) return;
    const r = await call({ action: "newcode", code: n.code });
    if (r) patch(n.code, { presenterCode: r.presenterCode });
  };
  const added = (n) => { // nouveau nuage en tête, accès dépliés
    setData((d) => ({ total: d.total + 1, nuages: [n, ...d.nuages] }));
    setQ(""); setFilter("all"); setFrom(""); setTo(""); setFound(null);
    setOpenCode(n.code);
  };
  const duplicate = async (n) => { const r = await call({ action: "duplicate", code: n.code }); if (r) added(r.nuage); };
  const findWord = async () => { const r = await call({ action: "find", q }); if (r) setFound({ q, codes: new Set(r.codes) }); };
  const remove = async (n) => {
    if (!confirm(`Supprimer définitivement « ${n.question} » (${plural(n.words, "mot")}) ?`)) return;
    if (await call({ action: "delete", code: n.code })) {
      setData((d) => ({ total: d.total - 1, nuages: d.nuages.filter((x) => x.code !== n.code) }));
      if (openCode === n.code) setOpenCode(null);
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
  const shown = all.filter((n) => keep[filter](n) && inPeriod(n) && matches(n));
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
          <button onClick={() => setCreating(!creating)} className="bg-violet-600 text-white font-bold px-4 py-2 rounded-full text-sm">+ Nouveau nuage</button>
          <button onClick={load} disabled={busy} className="border-2 border-gray-200 font-bold px-4 py-2 rounded-full text-sm disabled:opacity-40">↻ Actualiser</button>
          <button onClick={() => { logout(); setData(null); setOpenCode(null); setAuthed(false); }} className="text-sm text-gray-400 underline" title="Déconnecte aussi le backoffice et les autres super-admins">Se déconnecter</button>
        </div>
      </div>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {creating && <Create call={call} busy={busy} onCreated={(n) => { setCreating(false); added(n); }} onCancel={() => setCreating(false)} />}
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
                  <span className="block font-bold text-gray-900 truncate">
                    {n.question} <span className="font-mono text-violet-600 text-sm ml-1">{formatCode(n.code)}</span>
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {n.status === "open" ? "ouvert" : "fermé"} · {plural(n.words, "mot")} · actif le {fmtDay(n.activeAt)}
                    {n.owned && " · 👤 compte"}{n.keep && " · 📌 conservé"}{n.note && ` · 📝 ${n.note}`}
                  </span>
                </span>
              </button>
              <Link href={`/nuage/${n.code}/presenter?super`} className="text-xs sm:text-sm font-bold bg-gray-900 text-white px-3 py-1.5 rounded-full shrink-0">Organiser</Link>
              <button onClick={() => flip(n)} className="text-gray-400 text-sm shrink-0" aria-label={openCode === n.code ? "Replier" : "Déplier"}>{openCode === n.code ? "▲" : "▼"}</button>
            </div>

            {openCode === n.code && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-5 text-sm">
                <Edit n={n} call={call} busy={busy} onSaved={(x) => patch(n.code, x)} />
                <section className="space-y-2">
                  <h3 className="font-bold text-gray-900">Accès et envoi</h3>
                  <div className="flex flex-wrap gap-2">
                    <a href={viewLink("", n.code)} target="_blank" rel="noopener" className={small}>📺 Écran d'affichage ↗</a>
                    <Link href={`/nuage/${n.code}`} className={small}>Page participant</Link>
                  </div>
                  <Send n={n} call={call} busy={busy} />
                </section>
                <section className="space-y-2">
                  <h3 className="font-bold text-gray-900">Gestion</h3>
                  <p className="text-xs text-gray-500">
                    Créé le {fmtDay(n.createdAt)} · {n.keep ? "conservé : jamais supprimé automatiquement" : `suppression automatique le ${fmtDay(n.purgeAt)} sans nouvelle activité`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => duplicate(n)} disabled={busy} className={small}>Dupliquer</button>
                    <button onClick={() => newCode(n)} disabled={busy} className={small}>Nouveau code présentateur</button>
                    <button onClick={() => remove(n)} disabled={busy} className="text-xs text-red-500 underline ml-auto disabled:opacity-40">Supprimer</button>
                  </div>
                </section>
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

/* Réglages modifiables sur place (style et modération : écran présentateur). */
function Edit({ n, call, busy, onSaved }) {
  const init = { question: n.question, max: n.max, status: n.status, note: n.note, keep: n.keep, mailOk: n.mailOk };
  const [v, setV] = useState(init);
  const [saved, setSaved] = useState(false);
  const dirty = Object.keys(init).some((k) => v[k] !== init[k]);
  const set = (p) => { setV({ ...v, ...p }); setSaved(false); };
  const submit = async (e) => {
    e.preventDefault();
    const r = await call({ action: "edit", code: n.code, ...v });
    if (!r) return;
    const { question, max, status, note, keep, mailOk } = r.nuage;
    setV({ question, max, status, note, keep, mailOk });
    setSaved(true);
    onSaved(r.nuage);
  };
  const check = (k, label) => (
    <label className="flex items-center gap-2"><input type="checkbox" checked={v[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {label}</label>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-bold text-gray-900">Réglages</h3>
      <textarea rows={2} maxLength={MAX_QUESTION_LEN} value={v.question} onChange={(e) => set({ question: e.target.value })} aria-label="Question" className={input} />
      <input value={v.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="Note interne (organisateur, événement…)" aria-label="Note interne" className={input} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-gray-600">
        <label>Mots par participant{" "}
          <select value={v.max} onChange={(e) => set({ max: Number(e.target.value) })} className="border-2 border-gray-200 rounded-xl px-2 py-1">
            {MAX_CHOICES.map((m) => <option key={m} value={m}>{maxLabel(m)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.status === "open"} onChange={(e) => set({ status: e.target.checked ? "open" : "closed" })} /> Envois ouverts</label>
        {check("keep", "Conserver (jamais supprimé automatiquement)")}
        {check("mailOk", "Image par e-mail sans compte")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || !dirty || !v.question.trim()} className="bg-violet-600 disabled:opacity-40 text-white font-bold px-5 py-2 rounded-full text-sm">Enregistrer</button>
        {saved && !dirty && <span className="font-semibold text-green-600">✓ Enregistré</span>}
        <span className="text-xs text-gray-400">Style et modération des mots : bouton Organiser.</span>
      </div>
    </form>
  );
}

/* Création par le super-admin (image par e-mail autorisée d'office). */
function Create({ call, busy, onCreated, onCancel }) {
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [max, setMax] = useState(DEFAULT_MAX_PER_PARTICIPANT);
  const [closed, setClosed] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const r = await call({ action: "create", question, note, max, closed });
    if (r) onCreated(r.nuage);
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-violet-200 p-4 space-y-3 mb-4">
      <h2 className="font-bold">Nouveau nuage</h2>
      <textarea autoFocus rows={2} maxLength={MAX_QUESTION_LEN} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" className={input} />
      <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (organisateur, événement…)" className={input} />
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <label>Mots par participant{" "}
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="border-2 border-gray-200 rounded-xl px-2 py-1">
            {MAX_CHOICES.map((m) => <option key={m} value={m}>{maxLabel(m)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Envois fermés au départ</label>
      </div>
      <div className="flex gap-2">
        <button disabled={busy || !question.trim()} className="bg-violet-600 disabled:opacity-40 text-white font-bold px-5 py-2 rounded-full text-sm">Créer</button>
        <button type="button" onClick={onCancel} className={small}>Annuler</button>
      </div>
    </form>
  );
}

/* Accès d'un nuage : message présentateur ou consultation, e-mail, QR. */
function Send({ n, call, busy }) {
  const [kind, setKind] = useState("presenter");
  const [to, setTo] = useState("");
  const [sent, setSent] = useState("");
  const qr = useRef(null);
  const origin = window.location.origin;
  const m = nuageMessage(kind, origin, n);

  useEffect(() => { // compte rattaché : adresse préremplie
    let alive = true;
    if (n.owned) call({ action: "owner", code: n.code }).then((r) => { if (alive && r?.email) setTo((t) => t || r.email); });
    return () => { alive = false; };
  }, [n.code, n.owned, call]);

  const send = async (e) => {
    e.preventDefault();
    setSent("");
    if (await call({ action: "send", code: n.code, kind, to })) setSent(`✓ Envoyé à ${to}`);
  };
  const saveQr = () => {
    const a = document.createElement("a");
    a.href = qr.current.toDataURL("image/png");
    a.download = `nuage-${n.code}-qr.png`;
    a.click();
  };
  return (
    <div className="bg-gray-50 border rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {[["presenter", "Accès présentateur"], ["view", "Consultation seule"]].map(([k, label]) => (
          <button key={k} onClick={() => { setKind(k); setSent(""); }} aria-pressed={kind === k}
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${kind === k ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{label}</button>
        ))}
      </div>
      <pre className="whitespace-pre-wrap break-words font-sans text-sm">{m.text}</pre>
      {kind === "view" && n.status === "open" && <p className="text-xs text-amber-700">Les envois sont ouverts : cette page affiche le QR code pour participer.</p>}
      <ShareActions subject={m.subject} message={m.text} />
      <form onSubmit={send} className="flex flex-wrap items-center gap-2">
        <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="Envoyer par e-mail à… (adresse non gardée)" className={`${input} bg-white flex-1 min-w-48`} />
        <button disabled={busy} className="bg-sky-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-full text-sm">Envoyer</button>
        {sent && <span className="text-sm font-semibold text-green-600">{sent}</span>}
      </form>
      <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-gray-600">
        <QRCodeCanvas ref={qr} value={guestLink(origin, n.code)} size={512} marginSize={2} style={{ width: 96, height: 96 }} />
        <div className="space-y-1 min-w-0">
          <p className="break-all">Participants : {guestLink(origin, n.code)}</p>
          <p className="break-all">Écran d'affichage : {viewLink(origin, n.code)}</p>
          <p>Code présentateur : <b className="font-mono">{fmtPresenterCode(n.presenterCode)}</b></p>
          <button onClick={saveQr} className={small}>⬇ QR participants (PNG)</button>
        </div>
      </div>
    </div>
  );
}
