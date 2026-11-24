/*
 * Super-admin — liste des soirées : statut (en cours / prête / passée) avec
 * filtres, ligne compacte dépliable. Dépliée : état et suivi (prolonger,
 * rouvrir), accès (une ligne par destinataire, un seul panneau d'envoi),
 * réglages repliés, appareils et journal repliés, dates / fermer / supprimer.
 * Même présentation que le super-admin Nuage, dans un ordre propre au Jukebox
 * (on vient ici surtout surveiller, dépanner et prolonger).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCode } from "../storage";
import { fmtRegieCode } from "../Access";
import ShareActions from "../ShareActions";
import { FEATURES, MAX_NAME_LEN } from "@/lib/jukebox";
import { inviteText, guestText } from "@/lib/jukeboxMessages";
import { fmtDate, SearchInput, ValiditySelect } from "./shared";
import { Journal } from "./Journal";

const LIVE_MS = 3 * 60e3; // lecteur actif il y a moins de 3 min : soirée en cours

export const soireeStatus = (s) => (s.endsAt && s.endsAt <= Date.now() ? "ended" : s.player && Date.now() - s.player.at < LIVE_MS ? "live" : s.played === 0 ? "ready" : "past");
const fmtWhen = (ms) => new Date(ms).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const STATUSES = [
  { id: "all", label: "Toutes" },
  { id: "live", label: "🟢 En cours", hint: "La musique joue (lecteur actif il y a moins de 3 min)." },
  { id: "ready", label: "🟡 Prêtes", hint: "Aucun titre joué pour l'instant." },
  { id: "past", label: "⚪ Passées", hint: "Des titres ont été joués, plus de lecteur actif." },
  { id: "stale", label: "💤 Inactives", hint: "Sans activité depuis le délai choisi dans les Réglages, ou terminées : à supprimer si elles ne servent plus." },
  { id: "ended", label: "🔒 Fermées", hint: "Fermée automatiquement (délai après création dépassé) : plus accessible. Rouvrez-la en allongeant le délai, ou supprimez-la." },
];
const DOT = { live: "bg-green-500 animate-pulse", ready: "bg-amber-400", past: "bg-gray-300", ended: "bg-red-400" };
const STATE = { live: "🟢 En cours", ready: "🟡 Prête", past: "⚪ Passée", ended: "🔒 Fermée" };

function ago(ms) {
  const d = Date.now() - ms;
  if (d < 90e3) return "à l'instant";
  if (d < 3600e3) return `il y a ${Math.round(d / 60e3)} min`;
  if (d < 48 * 3600e3) return `il y a ${Math.round(d / 3600e3)} h`;
  return `il y a ${Math.round(d / 86400e3)} j`;
}
const DAY = 864e5;
const inactiveDays = (s) => Math.floor((Date.now() - s.lastActivity) / DAY);
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

/* created : { code, to?, sent?, error? } soirée qui vient d'être créée. */
export function Soirees({ sessions, activations = [], staleDays = 7, origin, action, filter, setFilter, onShowCode, created }) {
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(null); // code de la soirée dépliée
  const [panel, setPanel] = useState(null); // "orga" | "guests" : panneau d'envoi de la soirée dépliée
  const [errors, setErrors] = useState({}); // par soirée (gardées ici : une suppression refusée fait réapparaître la ligne)
  useEffect(() => {
    if (!created) return;
    setStatus("all"); setFilter(""); setOpen(created.code); setPanel("orga");
  }, [created, setFilter]);

  const q = filter.trim().toLowerCase();
  const emailOf = Object.fromEntries((activations || []).map((a) => [a.id, a.email || ""]));
  const matches = (s) => !q || s.name.toLowerCase().includes(q) || s.code.includes(q.replace(/\s/g, "")) || (s.organizer || "").toLowerCase().includes(q) || (emailOf[s.activationId] || "").toLowerCase().includes(q);
  const counts = { all: sessions.length };
  const isStale = (s) => soireeStatus(s) !== "live" && (soireeStatus(s) === "ended" || inactiveDays(s) >= staleDays);
  for (const s of sessions) counts[soireeStatus(s)] = (counts[soireeStatus(s)] || 0) + 1;
  counts.stale = sessions.filter(isStale).length;
  const shown = sessions.filter((s) => matches(s) && (status === "all" || (status === "stale" ? isStale(s) : soireeStatus(s) === status)));

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap bg-white border border-purple-100 rounded-2xl p-0.5 text-sm">
          {STATUSES.map((st) => (
            <button key={st.id} onClick={() => setStatus(st.id)} title={st.hint}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap ${status === st.id ? "bg-fuchsia-600 text-white" : "text-gray-500 hover:text-gray-900"}`}>
              {st.label} <span className="font-normal opacity-70">{counts[st.id] || 0}</span>
            </button>
          ))}
        </div>
        {(sessions.length > 5 || filter) && (
          <SearchInput value={filter} onChange={setFilter} placeholder="Nom, code, organisateur ou e-mail" className="flex-1 min-w-[200px]" />
        )}
      </div>

      {sessions.length === 0 && <p className="text-gray-400 text-center py-10">Aucune soirée.</p>}
      {sessions.length > 0 && shown.length === 0 && <p className="text-gray-400 text-center py-6">Aucune soirée ne correspond.</p>}

      {shown.map((s) => (
        <Soiree key={s.code} s={s} isOpen={open === s.code} panel={open === s.code ? panel : null} setPanel={setPanel}
          onToggle={() => { setOpen(open === s.code ? null : s.code); setPanel(null); }}
          onInvite={() => { setOpen(s.code); setPanel("orga"); }}
          stale={isStale(s)} quickDelete={status === "stale" || status === "ended"} email={emailOf[s.activationId] || ""}
          origin={origin} created={created?.code === s.code ? created : null} onShowCode={onShowCode}
          error={errors[s.code]}
          act={(body, confirmText) => {
            const say = (m) => setErrors((e) => ({ ...e, [s.code]: m }));
            say("");
            return action({ ...body, code: s.code }, confirmText, say);
          }} />
      ))}
    </div>
  );
}

const cell = "text-xs font-bold px-2 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 whitespace-nowrap text-center";
const cellOn = "text-xs font-bold px-2 py-2 rounded-full bg-fuchsia-600 text-white whitespace-nowrap text-center";
const small = "text-xs font-bold bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full";

function Soiree({ s, isOpen, panel, setPanel, onToggle, onInvite, stale, quickDelete, email, origin, created, onShowCode, error, act }) {
  const box = useRef(null);
  useEffect(() => { if (created) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [created]);
  const st = soireeStatus(s);
  const used = (s.devices || []).length > 0;
  const idle = inactiveDays(s);
  const del = () => act({ action: "delete" }, `Supprimer définitivement « ${s.name} » ?${idle >= 1 ? `\n\nInactive depuis ${plural(idle, "jour")}.` : ""}`);

  return (
    <div ref={box} className={`bg-white rounded-2xl border ${isOpen ? "border-fuchsia-300 shadow-md" : "border-purple-100"}`}>
      {/* ligne compacte */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[st]}`} title={STATUSES.find((x) => x.id === st)?.hint} />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">
              <span className={`inline-block align-middle mr-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${st === "ended" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{st === "ended" ? "🔒 Fermée" : "Ouverte"}</span>
              {s.name} <span className="font-mono text-fuchsia-600 text-sm ml-1">{formatCode(s.code)}</span>
              {s.status !== "open" && st !== "ended" && <span className="ml-1.5 align-middle text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded" title="L'organisateur a bloqué les propositions des invités">🚫 ajouts bloqués</span>}
            </p>
            <p className="text-xs text-gray-500">
              {s.organizer ? `👤 ${s.organizer} · ` : ""}
              {st === "live" ? `🔊 en cours sur ${s.player.kind === "tv" ? "la télé" : "l'ordinateur"}` : (stale ? <span className="text-amber-700">💤 inactive depuis {idle} j</span> : `activité ${ago(s.lastActivity)}`)}
              {" · "}{plural(s.played, "titre")}
              {" · "}{used ? <span className="text-green-700">lien ouvert</span>
                : <button onClick={(e) => { e.stopPropagation(); onInvite(); }} title="Envoyer l'accès à l'organisateur" className="text-amber-700 underline underline-offset-2">⚠️ lien jamais ouvert</button>}
            </p>
          </div>
        </div>
        {quickDelete && stale && <button onClick={del} title="Supprimer la soirée" aria-label={`Supprimer ${s.name}`} className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1.5 rounded-full shrink-0">🗑️ <span className="hidden sm:inline">Supprimer</span></button>}
        <Link href={`/jukebox/${s.code}/organiser`} className="text-xs sm:text-sm font-bold bg-gray-900 text-white px-3 py-1.5 rounded-full shrink-0">Organiser</Link>
        <button onClick={onToggle} className="text-gray-400 text-sm shrink-0" aria-expanded={isOpen} aria-label={isOpen ? "Replier" : "Déplier"}>{isOpen ? "▲" : "▼"}</button>
      </div>

      {error && <p className="px-4 pb-3 text-sm font-semibold text-red-600">{error}</p>}

      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 text-sm">
          <State s={s} st={st} act={act} />
          {created?.sent && <p className="font-semibold text-green-600">✓ Soirée créée, accès envoyé à {created.to}</p>}
          <Access s={s} st={st} panel={panel} setPanel={setPanel} email={email} origin={origin} created={created} act={act} />
          <Settings s={s} st={st} act={act} />
          <Details s={s} />
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mr-auto">
              Créée le {fmtDate(Date.parse(s.createdAt))}{s.organizer && <> par <b>{s.organizer}</b> <button onClick={() => onShowCode(s.organizer)} className="text-fuchsia-600 underline">voir son code</button></>}
            </p>
            {st !== "ended" && <button onClick={() => act({ action: "close", closed: true }, `Fermer « ${s.name} » maintenant ?\n\nInvités, organisateur et écran d'affichage n'y auront plus accès. Vous pourrez la rouvrir.`)}
              className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">🔒 Fermer</button>}
            <button onClick={del} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full">Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* État et suivi, date de fin, prolonger, rouvrir. */
function State({ s, st, act }) {
  const reopen = () => (s.closedReason === "auto"
    ? act({ action: "prolong", days: 1 }, `« ${s.name} » est fermée par son délai.\n\nLa rouvrir jusqu'à demain 8 h ? (Ensuite : boutons +1 j / +7 j pour prolonger.)`)
    : act({ action: "close", closed: false }));
  return (
    <section className="space-y-2">
      <p className="text-gray-600">
        <b className="text-gray-900">{STATE[st]}</b> · {plural(s.played, "titre")} joué{s.played > 1 ? "s" : ""}, {s.queued} en attente · dernière activité {ago(s.lastActivity)}
        {s.player && <> · 🔊 son {st === "live" ? "en ce moment" : ago(s.player.at)} sur {s.player.kind === "tv" ? "la télé" : "l'ordinateur"}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={st === "ended" ? "text-red-600 font-semibold" : "text-gray-600"}>
          {!s.endsAt ? "⏳ Sans date de fin" : st === "ended" ? `🔒 Fermée le ${fmtWhen(s.endsAt)}${s.closedReason === "manual" ? " (à la main)" : ""}` : `⏳ Ouverte jusqu'au ${fmtWhen(s.endsAt)}`}
        </span>
        {s.endsAt && [1, 7].map((n) => (
          <button key={n} onClick={() => act({ action: "prolong", days: n })} title={`Prolonger de ${plural(n, "jour")}${st === "ended" ? " (rouvre la soirée)" : ""}`}
            className="text-xs font-bold bg-fuchsia-50 text-fuchsia-700 px-2.5 py-1.5 rounded-full">+{n} j</button>
        ))}
        {st === "ended" && <button onClick={reopen} className="text-xs font-bold bg-green-100 text-green-800 px-3 py-1.5 rounded-full">🔓 Rouvrir</button>}
      </div>
    </section>
  );
}

/* Une ligne par destinataire, actions en colonnes, un seul panneau ouvert. */
function Access({ s, st, panel, setPanel, email, origin, created, act }) {
  const base = `${origin}/jukebox/${s.code}`;
  // soirée ancienne sans code : créé à la demande
  const regie = async () => s.regieCode || (await act({ action: "regie" }))?.regieCode || null;
  const flip = async (kind) => {
    if (panel === kind) return setPanel(null);
    if (kind === "orga" && !(await regie())) return;
    setPanel(kind);
  };
  const newCode = async () => {
    if (!s.regieCode) return act({ action: "regie" });
    if (!confirm(`Nouveau code organisateur pour « ${s.name} » ? L'ancien ne fonctionnera plus.`)) return;
    await act({ action: "regie", reset: true, logoutAll: confirm("Déconnecter aussi tous les appareils déjà autorisés ?\n\nOK : déconnecter · Annuler : les garder connectés") });
  };
  const send = (kind) => <button onClick={() => flip(kind)} aria-expanded={panel === kind} className={panel === kind ? cellOn : cell}>Envoyer {panel === kind ? "▴" : "▾"}</button>;
  const open = (path) => <Link href={path} target="_blank" className={cell}>Ouvrir ↗</Link>;
  const rows = [
    { kind: "orga", icon: "👤", title: "Organisateur",
      hint: <>Code <b className="font-mono tracking-wider">{s.regieCode ? fmtRegieCode(s.regieCode) : "—"}</b> <button onClick={newCode} className="underline">{s.regieCode ? "changer" : "créer"}</button>{(s.devices || []).length === 0 && <span className="text-amber-700"> · ⚠️ lien jamais ouvert</span>}</>,
      cells: <><span className="hidden sm:block" /><Copy label="Copier lien + code" text={async () => { const c = await regie(); return c && `${base}/organiser\n🔑 Code organisateur : ${fmtRegieCode(c)}`; }} />{send("orga")}</> },
    { kind: "guests", icon: "📱", title: "Invités",
      hint: <>Proposent leurs titres · code <b className="font-mono tracking-wider">{formatCode(s.code)}</b></>,
      cells: <>{open(`/jukebox/${s.code}`)}<Copy label="Copier le lien" text={() => base} />{send("guests")}<Link href={`/jukebox/${s.code}/affiche`} target="_blank" className={cell} title="Affiche à imprimer, avec le QR code">Affiche ↗</Link></> },
    { kind: "screen", icon: "📺", title: "Écran d'affichage",
      hint: "Sur place, pour une télé ou un vidéoprojecteur",
      cells: <>{open(`/jukebox/${s.code}/ecran`)}<Copy label="Copier le lien" text={() => `${base}/ecran`} /></> },
  ];
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-gray-900">Accès</h3>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
        {rows.map((r) => (
          <div key={r.kind} className="p-3 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{r.icon} {r.title}</p>
                <p className="text-xs text-gray-500">{r.hint}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-[5.5rem_9.5rem_6.5rem_5.5rem] gap-1.5">{r.cells}</div>
            </div>
            {panel === r.kind && (
              <Send s={s} kind={r.kind} closed={st === "ended"} origin={origin} act={act} created={created}
                to={created?.to || email} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Copy({ label, text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      const t = await text();
      if (!t) return;
      await navigator.clipboard.writeText(t);
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch (e) { /* refusé */ }
  };
  return <button type="button" onClick={copy} className={cell}>{done ? "✓ Copié" : label}</button>;
}

/* Message prêt à transmettre ; organisateur : envoi par apps360 en plus. */
function Send({ s, kind, closed, origin, act, created, to: first }) {
  const [to, setTo] = useState(first || "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const orga = kind === "orga";
  const message = orga ? inviteText({ origin, code: s.code, name: s.name, regieCode: s.regieCode }) : guestText({ origin, code: s.code, name: s.name });
  const submit = async (e) => {
    e.preventDefault();
    setSent(""); setBusy(true);
    const d = await act({ action: "sendAccess", to: to.trim(), origin });
    if (d) setSent(`✓ Envoyé à ${d.to}`);
    setBusy(false);
  };
  return (
    <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-2xl p-3 space-y-3">
      {closed && <p className="text-xs text-amber-700">La soirée est fermée : le lien ne fonctionnera qu'une fois rouverte.</p>}
      <pre className="whitespace-pre-wrap break-words bg-white rounded-xl px-3 py-2 text-xs text-gray-700 font-sans">{message}</pre>
      <ShareActions subject={orga ? `Jukebox · soirée « ${s.name} »` : `Jukebox « ${s.name} »`} message={message} />
      {orga && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} aria-label="Adresse e-mail de l'organisateur" placeholder="adresse@exemple.fr (non gardée)"
            className="flex-1 min-w-48 bg-white border-2 border-gray-200 rounded-xl px-3 py-1.5 focus:border-fuchsia-500 outline-none" />
          <button disabled={busy || !s.regieCode} className="bg-fuchsia-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-full">{busy ? "Envoi…" : "Envoyer depuis apps360"}</button>
        </form>
      )}
      {sent && <p className="font-semibold text-green-600">{sent}</p>}
      {orga && created?.error && !sent && <p className="text-red-600 font-semibold">Soirée créée, mais e-mail non envoyé : {created.error}</p>}
    </div>
  );
}

/* Réglages : le nom s'enregistre avec son bouton, délai et fonctions au clic. */
function Settings({ s, st, act }) {
  const [name, setName] = useState(s.name);
  useEffect(() => { setName(s.name); }, [s.name]);
  const dirty = name.trim() && name.trim() !== s.name;
  const rename = (e) => { e.preventDefault(); if (dirty) act({ action: "rename", name: name.trim() }); };
  return (
    <details className="border border-gray-100 rounded-xl">
      <summary className="px-3 py-2.5 font-bold text-gray-900 cursor-pointer">⚙️ Réglages</summary>
      <div className="px-3 pb-3 space-y-4">
        <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-48"><span className="block text-xs font-semibold text-gray-500 mb-1">Nom de la soirée</span>
            <input maxLength={MAX_NAME_LEN} value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-1.5 focus:border-fuchsia-500 outline-none" />
          </label>
          <button disabled={!dirty} className="bg-gray-900 disabled:opacity-30 text-white font-bold px-4 py-2 rounded-full">Enregistrer le nom</button>
        </form>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Fermeture automatique</p>
          <ValiditySelect value={s.validDays} className="text-xs" onChange={(days) => act({ action: "validity", days }, st === "live" ? "La soirée est en cours : changer son délai de fermeture maintenant ?" : null)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Fonctions (cliquer pour activer / désactiver)</p>
          <div className="flex flex-wrap gap-1.5">
            {FEATURES.map((f) => {
              const on = s.features?.[f.id];
              return (
                <button key={f.id} title={`${f.hint}\nCliquer pour ${on ? "désactiver" : "activer"}.`}
                  onClick={() => act({ action: "features", features: { [f.id]: !on } }, st === "live" ? `La soirée est en cours : ${on ? "désactiver" : "activer"} « ${f.label} » maintenant ?` : null)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${on ? "bg-fuchsia-100 text-fuchsia-700" : "bg-gray-100 text-gray-400 line-through"}`}>
                  {f.icon} {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}

function Details({ s }) {
  const [journal, setJournal] = useState(false); // chargé seulement à la demande
  const devices = s.devices || [];
  return (
    <details className="border border-gray-100 rounded-xl">
      <summary className="px-3 py-2.5 font-bold text-gray-900 cursor-pointer">📋 Appareils et journal <span className="font-normal text-xs text-gray-400">({plural(devices.length, "appareil")})</span></summary>
      <div className="px-3 pb-3 space-y-3">
        {devices.length > 0 ? (
          <ul className="space-y-1">
            {devices.map((d, i) => (
              <li key={i} className="text-gray-600">
                {/télé/i.test(d.label) ? "📺" : "📱"} {d.label} <span className="text-xs text-gray-400">· ajouté le {fmtDate(Date.parse(d.createdAt))}, vu {ago(Date.parse(d.lastSeen))}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-gray-500">Aucun appareil connecté avec le lien organisateur.</p>}
        <button onClick={() => setJournal((v) => !v)} aria-expanded={journal} className={small}>📜 {journal ? "Masquer" : "Afficher"} le journal</button>
        {journal && <Journal code={s.code} />}
      </div>
    </details>
  );
}
