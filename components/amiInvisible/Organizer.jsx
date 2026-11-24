"use client";
/*
 * Ami Invisible — espace organisateur (/ami-invisible), compte apps360.
 *  - Accueil : brouillons et tirages faits (envois, ouvertures), « Repartir de
 *    ce tirage », suppression d'un tirage ou de toutes ses données.
 *  - Préparation en 5 étapes, sauvegardée au fil de la saisie (brouillon en base).
 *  - Tirage fait : envoi des liens personnels, suivi envoyé / ouvert, paires
 *    visibles seulement si l'organisateur ne participe pas.
 * Tout passe par /api/ami-invisible : le navigateur ne reçoit jamais les paires
 * (sauf « je n'y participe pas »). Interface au vouvoiement ; les textes vus
 * par les participants suivent le ton choisi (lib/amiInvisible.js → texts).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import DateInput, { todayInput } from "@/components/DateInput";
import SoutenirLink from "@/components/SoutenirLink";
import ShareActions from "@/components/jukebox/ShareActions";
import AppIcon from "@/components/AppIcon";
import {
  LIMITS, TONE_LABELS, defaultTemplate, isDefaultTemplate, fillMessage, SECRET, parseList, isEmail, fmtDay, drawProblem,
  MAIL_VARS, DEFAULT_SUBJECT, defaultMailText, mailSubjectOf, mailTextOf, buildLinkMail, relayMessage,
} from "@/lib/amiInvisible";

async function call(action, body = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch("/api/ami-invisible", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(r.error || "Service momentanément indisponible.");
  return r;
}

const newKey = () => Math.random().toString(36).slice(2, 10);
const fmtShort = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const input = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 outline-none bg-white";
const btn = "bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold rounded-full";
const btnLine = "border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 font-bold rounded-full";

// ── Racine ───────────────────────────────────────────────────────
export default function Organizer() {
  const { user, signOut, loading } = useAuth();
  const [data, setData] = useState(null); // { email, carnet, tirages }
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    try { setData(await call("load")); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading) return <Shell><p className="text-center text-gray-400 py-20 animate-pulse">Chargement…</p></Shell>;
  if (!user) return <Login />;

  return (
    <Shell user={user} signOut={signOut}>
      {err && <Alert>{err}</Alert>}
      {openId
        ? <Editor id={openId} carnet={data?.carnet || []} history={data?.tirages || []}
            setCarnet={(carnet) => setData((d) => ({ ...d, carnet }))}
            onBack={() => { setOpenId(null); load(); }} />
        : <Home data={data} onOpen={setOpenId} reload={load} setErr={setErr} />}
    </Shell>
  );
}

function Shell({ children, user, signOut }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4 text-xs gap-3">
          <Link href="/" className="text-gray-400 hover:underline shrink-0">← apps360.fr</Link>
          {user && (
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-gray-500 truncate">{user.email}</span>
              <button onClick={signOut} className="text-red-500 hover:underline shrink-0">Déconnexion</button>
            </div>
          )}
        </div>
        <div className="text-center mb-6">
          {!user && <AppIcon app="ami-invisible" className="w-20 h-20 mb-3 shadow-lg" />}
          <h1 className="text-3xl font-extrabold text-red-600 flex items-center justify-center gap-2.5">
            {user && <AppIcon app="ami-invisible" className="w-9 h-9" />}Ami Invisible
          </h1>
          <p className="text-gray-500 text-sm mt-1">Le tirage au sort de vos cadeaux, en toute confidentialité</p>
          <Link href="/ami-invisible/aide" className="inline-block mt-1 text-xs text-red-600 font-semibold hover:underline">❓ Mode d'emploi</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function Login() {
  return (
    <Shell>
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-8 text-center space-y-5">
        <p className="text-gray-600 leading-relaxed">
          Préparez votre tirage, envoyez à chacun son lien personnel et suivez qui l'a ouvert. Vos tirages restent
          disponibles d'une année sur l'autre, sur tous vos appareils.
        </p>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-left text-sm text-gray-600">
          <p className="font-semibold text-gray-800 mb-1">💡 Pourquoi votre e-mail ?</p>
          <p>Pour retrouver vos tirages. Vous recevez un lien de connexion, vous cliquez, c'est fait : aucun mot de passe à retenir.</p>
        </div>
        <Link href="/connexion?next=/ami-invisible" className={`block w-full py-3.5 ${btn}`}>Se connecter</Link>
      </div>
    </Shell>
  );
}

function Alert({ children, tone = "red" }) {
  const c = tone === "green" ? "bg-green-50 border-green-200 text-green-700" : tone === "yellow" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-red-50 border-red-200 text-red-600";
  return <div className={`border text-sm rounded-2xl p-3 mb-4 ${c}`}>{children}</div>;
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-3xl shadow p-5 space-y-4 ${className}`}>{children}</div>;
}

// ── Accueil ──────────────────────────────────────────────────────
function Home({ data, onOpen, reload, setErr }) {
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // id | "all"

  const create = async (fromId) => {
    setBusy(true); setErr("");
    try { const r = await call("create", fromId ? { fromId } : {}); onOpen(r.tirage.id); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true); setErr("");
    try { await call(confirmDel === "all" ? "deleteAll" : "delete", confirmDel === "all" ? {} : { id: confirmDel }); setConfirmDel(null); reload(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!data) return <p className="text-center text-gray-400 py-10">Chargement…</p>;
  const drafts = data.tirages.filter((t) => t.status === "draft");
  const done = data.tirages.filter((t) => t.status === "drawn");

  return (
    <div className="space-y-5">
      <button onClick={() => create()} disabled={busy} className={`w-full py-4 text-lg ${btn}`}>＋ Nouveau tirage</button>

      {drafts.length > 0 && (
        <Section title="En préparation">
          {drafts.map((t) => (
            <Row key={t.id} title={t.name || "Sans nom"} sub={`Modifié le ${fmtDate(t.updatedAt)} · ${t.total} participant(s)`}>
              <button onClick={() => onOpen(t.id)} className="text-sm text-red-600 font-bold hover:underline">Continuer</button>
              <button onClick={() => setConfirmDel(t.id)} className="text-gray-400 hover:text-red-500" aria-label="Supprimer">🗑</button>
            </Row>
          ))}
        </Section>
      )}

      <Section title="Tirages effectués">
        {done.length === 0 && <p className="text-sm text-gray-400 px-1">Aucun tirage pour l'instant.</p>}
        {done.map((t) => (
          <Row key={t.id} title={t.name}
            sub={`${t.date ? fmtDay(t.date) : `Tiré le ${fmtDate(t.drawnAt)}`} · ${t.total} participants · ${t.sent}/${t.total} envoyés · ${t.opened}/${t.total} ouverts`}>
            <button onClick={() => onOpen(t.id)} className="text-sm text-red-600 font-bold hover:underline">Ouvrir</button>
            <button onClick={() => create(t.id)} disabled={busy} className="text-sm text-gray-600 font-bold hover:underline">Repartir de ce tirage</button>
            <button onClick={() => setConfirmDel(t.id)} className="text-gray-400 hover:text-red-500" aria-label="Supprimer">🗑</button>
          </Row>
        ))}
      </Section>

      {data.tirages.length > 0 && (
        <p className="text-center"><button onClick={() => setConfirmDel("all")} className="text-xs text-gray-400 underline">Supprimer toutes mes données Ami Invisible</button></p>
      )}
      <p className="text-center text-xs text-gray-400 px-4">Vos tirages sont conservés tant que vous utilisez Ami Invisible (au moins une fois par an). Les listes de souhaits sont effacées un mois après l'échange. <Link href="/ami-invisible/confidentialite" className="underline">Confidentialité</Link></p>

      {confirmDel && (
        <Modal title={confirmDel === "all" ? "Supprimer toutes vos données ?" : "Supprimer ce tirage ?"} onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-gray-600">
            {confirmDel === "all"
              ? "Tous vos tirages, leurs participants, les listes de souhaits et votre carnet seront effacés. Les liens déjà envoyés ne fonctionneront plus."
              : "Le tirage, ses participants et leurs listes de souhaits seront effacés. Les liens déjà envoyés ne fonctionneront plus."} Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <button onClick={remove} disabled={busy} className={`flex-1 py-2.5 text-sm ${btn}`}>Supprimer</button>
            <button onClick={() => setConfirmDel(null)} className={`flex-1 py-2.5 text-sm ${btnLine}`}>Annuler</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">{title}</h2>
      {children}
    </div>
  );
}

function Row({ title, sub, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-3xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center gap-3">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Un tirage ────────────────────────────────────────────────────
const STEPS = ["Infos", "Participants", "Exclusions", "Messages", "Tirage"];

function Editor({ id, carnet, setCarnet, history, onBack }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState("idle"); // idle | pending | saved | error
  const pending = useRef({});
  const timer = useRef(null);

  useEffect(() => {
    call("get", { id }).then((r) => setT(r.tirage)).catch((e) => setErr(e.message));
  }, [id]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return true;
    try {
      const r = await call("save", { id, patch });
      if (!Object.keys(pending.current).length) setSaving("saved");
      return r.tirage;
    } catch (e) { setSaving("error"); setErr(e.message); return false; }
  }, [id]);

  // modification locale immédiate + sauvegarde groupée 700 ms plus tard
  const change = useCallback((fields) => {
    setT((x) => ({ ...x, ...fields }));
    pending.current = { ...pending.current, ...fields };
    setSaving("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }, [flush]);
  useEffect(() => () => { clearTimeout(timer.current); if (Object.keys(pending.current).length) call("save", { id, patch: pending.current }).catch(() => {}); }, [id]);

  const back = async () => { await flush(); onBack(); };

  if (!t) return <div>{err ? <Alert>{err}</Alert> : <p className="text-center text-gray-400 py-10">Chargement…</p>}<button onClick={onBack} className="text-sm text-gray-500">← Mes tirages</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={back} className="text-sm text-gray-500 hover:text-gray-700">← Mes tirages</button>
        {t.status === "draft" && (
          <span className="text-xs text-gray-400">
            {saving === "pending" ? "Enregistrement…" : saving === "saved" ? "Brouillon enregistré ✓" : saving === "error" ? "⚠️ Non enregistré" : ""}
          </span>
        )}
      </div>
      {err && <Alert>{err}</Alert>}
      {t.status === "draft"
        ? <Draft t={t} change={change} flush={flush} step={step} setStep={setStep} carnet={carnet} setCarnet={setCarnet} history={history} setErr={setErr}
            onDrawn={(tirage, c) => { setT(tirage); if (c) setCarnet(c); }} />
        : <Drawn t={t} setT={setT} setErr={setErr} />}
    </div>
  );
}

function Draft({ t, change, flush, step, setStep, carnet, setCarnet, history, setErr, onDrawn }) {
  return (
    <>
      <div className="flex bg-white rounded-2xl shadow-sm overflow-hidden">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)}
            className={`flex-1 py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${step === i ? "bg-red-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <span className="block text-base leading-none mb-0.5">{i + 1}</span>{s}
          </button>
        ))}
      </div>
      {step === 0 && <StepEvent t={t} change={change} />}
      {step === 1 && <StepPeople t={t} change={change} carnet={carnet} />}
      {step === 2 && <StepExclusions t={t} change={change} history={history} />}
      {step === 3 && <StepMessage t={t} change={change} />}
      {step === 4 && <StepDraw t={t} flush={flush} setErr={setErr} onDrawn={onDrawn} setStep={setStep} />}
      {step < 4 && (
        <div className="flex justify-between">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className={`px-5 py-2 text-sm ${btnLine}`}>← Précédent</button> : <span />}
          <button onClick={() => setStep(step + 1)} className={`px-5 py-2 text-sm ${btn}`}>Suivant →</button>
        </div>
      )}
    </>
  );
}

// 1. Le tirage
function StepEvent({ t, change }) {
  const o = t.options;
  const setO = (patch) => {
    const options = { ...o, ...patch };
    const fields = { options };
    // changement de ton : le message par défaut suit
    if (patch.tone && patch.tone !== o.tone && isDefaultTemplate(t.template)) fields.template = defaultTemplate(patch.tone);
    change(fields);
  };
  return (
    <Card>
      <Field label="Nom du tirage *">
        <input className={input} value={t.name} maxLength={LIMITS.field} onChange={(e) => change({ name: e.target.value })} placeholder="Ex : Noël famille 2026" />
      </Field>
      <Field label="Votre prénom, affiché aux participants" hint="« Le tirage organisé par … a eu lieu ! »">
        <input className={input} value={o.organizerName} maxLength={LIMITS.field} onChange={(e) => setO({ organizerName: e.target.value })} placeholder="Ex : Sophie" />
      </Field>
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-semibold">Participez-vous au tirage ?</p>
        <Choice checked={o.organizerPlays} onChange={() => setO({ organizerPlays: true })} title="Oui, je participe"
          desc="Ajoutez-vous à la liste des participants. Le résultat ne vous est pas affiché : vous jouez comme tout le monde." />
        <Choice checked={!o.organizerPlays} onChange={() => setO({ organizerPlays: false })} title="Non, j'organise seulement"
          desc="Vous pourrez voir qui offre à qui (chaque affichage est enregistré)." />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-semibold">Messages aux participants</p>
        <div className="flex gap-2">
          {["tu", "vous"].map((tone) => (
            <button key={tone} onClick={() => setO({ tone })}
              className={`flex-1 py-2 text-sm font-bold rounded-full border-2 ${o.tone === tone ? "border-red-500 bg-red-50 text-red-600" : "border-gray-200 text-gray-500"}`}>
              {TONE_LABELS[tone]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Date de l'échange">
          <DateInput className={input} value={o.date} min={todayInput()} onChange={(e) => setO({ date: e.target.value })} />
        </Field>
        <Field label="Lieu"><input className={input} value={o.place} maxLength={LIMITS.field} onChange={(e) => setO({ place: e.target.value })} placeholder="Facultatif" /></Field>
        <Field label="Budget"><input className={input} value={o.budget} maxLength={40} onChange={(e) => setO({ budget: e.target.value })} placeholder="Ex : 20 €" /></Field>
      </div>
      <Toggle checked={o.wishlist} onChange={(v) => setO({ wishlist: v })} title="Liste de souhaits"
        desc="Chaque participant peut écrire ses idées de cadeaux ; seule la personne qui lui offre un cadeau les voit." />
    </Card>
  );
}

// 2. Participants
function StepPeople({ t, change, carnet }) {
  const [form, setForm] = useState({ prenom: "", nom: "", email: "" });
  const [editKey, setEditKey] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [modal, setModal] = useState(null); // "carnet" | "paste"
  const people = t.draft;
  const emails = new Set(people.map((p) => p.email.toLowerCase()));

  const setPeople = (draft) => change({ draft });
  const save = () => {
    const p = { prenom: form.prenom.trim(), nom: form.nom.trim(), email: form.email.trim().toLowerCase() };
    if (!p.prenom) return setFormErr("Prénom requis.");
    if (!isEmail(p.email)) return setFormErr("E-mail valide requis.");
    if (people.some((x) => x.email === p.email && x.key !== editKey)) return setFormErr("Cette adresse est déjà dans la liste.");
    if (!editKey && people.length >= LIMITS.participants) return setFormErr(`${LIMITS.participants} participants au maximum.`);
    setPeople(editKey ? people.map((x) => (x.key === editKey ? { ...x, ...p } : x)) : [...people, { key: newKey(), ...p }]);
    setForm({ prenom: "", nom: "", email: "" }); setEditKey(null); setFormErr("");
  };
  const add = (list) => {
    const seen = new Set(emails);
    const fresh = list.filter((p) => { const e = p.email.toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true; });
    setPeople([...people, ...fresh.map((p) => ({ key: newKey(), prenom: p.prenom, nom: p.nom || "", email: p.email.toLowerCase() }))].slice(0, LIMITS.participants));
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h2 className="font-bold text-gray-800">{editKey ? "Modifier" : "Ajouter un participant"}</h2>
          {!editKey && (
            <div className="flex gap-2">
              <button onClick={() => setModal("paste")} className="text-xs border-2 border-red-200 text-red-600 font-bold px-3 py-1 rounded-full">📋 Coller une liste</button>
              <button onClick={() => setModal("carnet")} disabled={!carnet.length} className="text-xs border-2 border-red-200 text-red-600 font-bold px-3 py-1 rounded-full disabled:opacity-40">📖 Carnet ({carnet.length})</button>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={input} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prénom *" />
          <input className={input} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" />
          <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="E-mail *" />
        </div>
        {formErr && <p className="text-red-500 text-xs">{formErr}</p>}
        <div className="flex gap-2">
          <button onClick={save} className={`px-5 py-2 text-sm ${btn}`}>{editKey ? "Mettre à jour" : "Ajouter"}</button>
          {editKey && <button onClick={() => { setEditKey(null); setForm({ prenom: "", nom: "", email: "" }); setFormErr(""); }} className={`px-5 py-2 text-sm ${btnLine}`}>Annuler</button>}
        </div>
        {t.options.organizerPlays && <p className="text-xs text-gray-400">Vous participez : pensez à vous ajouter à la liste.</p>}
      </Card>
      <Card>
        <h2 className="font-bold text-gray-800">Participants ({people.length})</h2>
        {people.length === 0 ? <p className="text-sm text-gray-400">Aucun participant pour l'instant.</p> : (
          <div className="divide-y">
            {people.map((p) => (
              <div key={p.key} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.prenom} {p.nom}</p>
                  <p className={`text-xs truncate ${isEmail(p.email) ? "text-gray-400" : "text-red-500"}`}>{p.email || "e-mail manquant"}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => { setForm({ prenom: p.prenom, nom: p.nom, email: p.email }); setEditKey(p.key); }} className="text-xs text-blue-600 hover:underline">Modifier</button>
                  <button onClick={() => change({ draft: people.filter((x) => x.key !== p.key), exclusions: t.exclusions.filter((e) => e.from !== p.key && e.to !== p.key) })} className="text-xs text-red-500 hover:underline">Retirer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {modal === "paste" && <PasteModal onAdd={(l) => { add(l); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "carnet" && <CarnetModal carnet={carnet} taken={emails} onAdd={(l) => { add(l); setModal(null); }} onClose={() => setModal(null)} />}
    </>
  );
}

function PasteModal({ onAdd, onClose }) {
  const [text, setText] = useState("");
  const parsed = parseList(text);
  return (
    <Modal title="📋 Coller une liste" onClose={onClose}>
      <p className="text-xs text-gray-500">Une personne par ligne : prénom, nom puis e-mail. Par exemple :</p>
      <pre className="bg-gray-50 rounded-xl p-2 text-xs text-gray-600">Sophie Martin sophie@exemple.fr{"\n"}Paul paul.dupont@exemple.fr</pre>
      <textarea rows={8} className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Collez votre liste ici" autoFocus />
      {text.trim() && (
        <p className="text-xs text-gray-500">
          {parsed.people.length} personne(s) reconnue(s)
          {parsed.rejected.length > 0 && <span className="text-red-500"> · {parsed.rejected.length} ligne(s) sans e-mail ignorée(s) : {parsed.rejected.slice(0, 3).join(" ; ")}{parsed.rejected.length > 3 ? "…" : ""}</span>}
        </p>
      )}
      <button onClick={() => onAdd(parsed.people)} disabled={!parsed.people.length} className={`w-full py-2.5 text-sm ${btn}`}>Ajouter {parsed.people.length || ""}</button>
    </Modal>
  );
}

function CarnetModal({ carnet, taken, onAdd, onClose }) {
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState("");
  const shown = carnet.filter((p) => `${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (e) => setSel((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]));
  return (
    <Modal title="📖 Carnet" onClose={onClose}>
      {carnet.length > 8 && <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" />}
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {shown.map((p) => {
          const already = taken.has(p.email), on = sel.includes(p.email);
          return (
            <button key={p.email} disabled={already} onClick={() => toggle(p.email)}
              className={`w-full text-left flex items-center gap-3 border-2 rounded-xl px-3 py-2 ${already ? "opacity-40" : on ? "border-red-400 bg-red-50" : "border-gray-100"}`}>
              <span className={`w-4 h-4 rounded border-2 shrink-0 ${on || already ? "bg-red-500 border-red-500" : "border-gray-300"}`} />
              <span className="min-w-0"><span className="block text-sm font-semibold">{p.prenom} {p.nom}</span><span className="block text-xs text-gray-400 truncate">{p.email}</span></span>
              {already && <span className="ml-auto text-xs text-gray-400">Déjà ajouté</span>}
            </button>
          );
        })}
      </div>
      <button onClick={() => onAdd(carnet.filter((p) => sel.includes(p.email)))} disabled={!sel.length} className={`w-full py-2.5 text-sm ${btn}`}>Ajouter {sel.length || ""}</button>
    </Modal>
  );
}

// 3. Exclusions + paires à éviter
function StepExclusions({ t, change, history }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [both, setBoth] = useState(true);
  const [msg, setMsg] = useState("");
  const people = t.draft;
  const name = (k) => { const p = people.find((x) => x.key === k); return p ? `${p.prenom} ${p.nom}`.trim() : "?"; };
  const past = history.filter((h) => h.status === "drawn" && h.id !== t.id);

  const add = () => {
    if (!from || !to) return setMsg("Choisissez deux participants.");
    if (from === to) return setMsg("Choisissez deux personnes différentes.");
    if (t.exclusions.some((e) => (e.from === from && e.to === to) || (e.both && e.from === to && e.to === from))) return setMsg("Cette exclusion existe déjà.");
    change({ exclusions: [...t.exclusions, { from, to, both }] });
    setFrom(""); setTo(""); setMsg("");
  };
  const toggleAvoid = (id) => change({ avoid: t.avoid.includes(id) ? t.avoid.filter((x) => x !== id) : [...t.avoid, id] });

  return (
    <>
      <Card>
        <div>
          <h2 className="font-bold text-gray-800">Exclusions</h2>
          <p className="text-xs text-gray-500">Par exemple, pour qu'un couple ne s'offre pas de cadeau. Facultatif.</p>
        </div>
        <div className="space-y-2">
          <select className={input} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Personne A</option>
            {people.map((p) => <option key={p.key} value={p.key}>{p.prenom} {p.nom}</option>)}
          </select>
          <p className="text-xs text-gray-500 font-semibold text-center">ne peut pas offrir à</p>
          <select className={input} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Personne B</option>
            {people.map((p) => <option key={p.key} value={p.key}>{p.prenom} {p.nom}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="w-4 h-4 accent-red-500" />
            Dans les deux sens (B ne peut pas offrir à A non plus)
          </label>
        </div>
        {msg && <p className="text-red-500 text-xs">{msg}</p>}
        <button onClick={add} disabled={people.length < 2} className={`px-5 py-2 text-sm ${btn}`}>Ajouter l'exclusion</button>
        {t.exclusions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {t.exclusions.map((e) => (
              <span key={`${e.from}>${e.to}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                {name(e.from)} {e.both ? "⇄" : "↛"} {name(e.to)}
                <button onClick={() => change({ exclusions: t.exclusions.filter((x) => x !== e) })} aria-label="Retirer" className="hover:opacity-60">✕</button>
              </span>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div>
          <h2 className="font-bold text-gray-800">Éviter les paires d'anciens tirages</h2>
          <p className="text-xs text-gray-500">Personne n'offrira à la même personne que lors des tirages cochés (reconnue par son e-mail, ou à défaut par son nom). Le résultat des anciens tirages n'est pas affiché.</p>
        </div>
        {past.length === 0 ? <p className="text-sm text-gray-400">Aucun ancien tirage.</p> : (
          <div className="space-y-1.5">
            {past.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={t.avoid.includes(h.id)} onChange={() => toggleAvoid(h.id)} className="w-4 h-4 accent-red-500" />
                {h.name} <span className="text-xs text-gray-400">({h.date ? fmtDay(h.date) : fmtDate(h.drawnAt)})</span>
              </label>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// 4. Messages : e-mail d'envoi + message de la page personnelle
function StepMessage({ t, change }) {
  const [preview, setPreview] = useState(0);
  const people = t.draft;
  const sample = people[preview] || { prenom: "Sophie", nom: "" };
  return (
    <>
    <Card>
      <div>
        <h2 className="font-bold text-gray-800">E-mail envoyé à chaque participant</h2>
        <p className="text-xs text-gray-500">Il contient seulement son lien personnel, jamais le résultat. Vous pourrez encore le modifier juste avant l'envoi.</p>
      </div>
      <MailEditor t={t} options={t.options} people={people} onChange={(patch) => change({ options: { ...t.options, ...patch } })} />
    </Card>
    <Card>
      <div>
        <h2 className="font-bold text-gray-800">Message affiché à chaque participant</h2>
        <p className="text-xs text-gray-500">
          Il apparaît sur sa page personnelle, quand il découvre son résultat. Variables :{" "}
          {["{prenom_offreur}", "{nom_offreur}", "{prenom_receveur}", "{nom_receveur}"].map((v) => <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>)}
        </p>
      </div>
      <textarea rows={8} maxLength={LIMITS.template} className={`${input} font-mono`} value={t.template} onChange={(e) => change({ template: e.target.value })} />
      <button onClick={() => change({ template: defaultTemplate(t.options.tone) })} className="text-xs text-gray-400 underline">Revenir au message par défaut ({TONE_LABELS[t.options.tone].toLowerCase()})</button>
      <div>
        <p className="text-xs text-gray-500 font-semibold mb-2">Aperçu</p>
        {people.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {people.map((p, i) => (
              <button key={p.key} onClick={() => setPreview(i)} className={`text-xs px-2 py-1 rounded-full border ${preview === i ? "bg-red-500 text-white border-red-500" : "text-gray-600"}`}>{p.prenom}</button>
            ))}
          </div>
        )}
        <pre className="bg-gray-50 border rounded-2xl p-3 text-sm whitespace-pre-wrap font-sans text-gray-700">{fillMessage(t.template, sample, SECRET)}</pre>
      </div>
    </Card>
    </>
  );
}

/* E-mail d'envoi : objet et texte modifiables, aperçu fidèle (le même code
 * fabrique l'e-mail envoyé), avec un lien factice. */
const PREVIEW_LINK = "https://apps360.fr/ami-invisible/p/apercu";
function MailEditor({ t, options, people, onChange }) {
  const [who, setWho] = useState(0);
  // saisie locale : un champ vidé reste vide pendant la frappe (vide = texte par défaut une fois enregistré)
  const [subject, setSubject] = useState(mailSubjectOf(options));
  const [text, setText] = useState(mailTextOf(options));
  const sample = people[who] || { prenom: "Sophie", nom: "Martin" };
  const mail = buildLinkMail({ name: t.name || "Mon tirage", options: { ...options, mailSubject: subject, mailText: text } }, sample, PREVIEW_LINK);
  const custom = subject !== DEFAULT_SUBJECT || text !== defaultMailText(options);
  const reset = () => { setSubject(DEFAULT_SUBJECT); setText(defaultMailText(options)); onChange({ mailSubject: "", mailText: "" }); };
  return (
    <div className="space-y-3">
      <Field label="Objet">
        <input className={input} maxLength={LIMITS.mailSubject} value={subject} onChange={(e) => { setSubject(e.target.value); onChange({ mailSubject: e.target.value }); }} />
      </Field>
      <Field label="Texte" hint="Le bouton vers le lien personnel, les infos de l'échange (date, lieu, budget) et le pied de page (confidentialité, suppression des coordonnées) sont ajoutés automatiquement.">
        <textarea rows={6} maxLength={LIMITS.mailText} className={input} value={text} onChange={(e) => { setText(e.target.value); onChange({ mailText: e.target.value }); }} />
      </Field>
      <p className="text-xs text-gray-500">Variables : {MAIL_VARS.map((v) => <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>)}</p>
      {custom && <button onClick={reset} className="text-xs text-gray-400 underline">Revenir à l'e-mail par défaut ({TONE_LABELS[options.tone].toLowerCase()})</button>}
      <div>
        <p className="text-xs text-gray-500 font-semibold mb-2">Aperçu</p>
        {people.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {people.map((p, i) => (
              <button key={p.key || p.id} onClick={() => setWho(i)} className={`text-xs px-2 py-1 rounded-full border ${who === i ? "bg-red-500 text-white border-red-500" : "text-gray-600"}`}>{p.prenom}</button>
            ))}
          </div>
        )}
        <div className="border rounded-2xl overflow-hidden">
          <p className="bg-gray-50 border-b px-3 py-2 text-xs text-gray-600"><span className="text-gray-400">Objet :</span> <b>{mail.subject}</b></p>
          <iframe title="Aperçu de l'e-mail" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${mail.html}</body>`} className="w-full h-[440px] bg-white pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function MailModal({ t, toSend, busy, onSave, onSend, onClose }) {
  const [draft, setDraft] = useState({ mailSubject: t.options.mailSubject || "", mailText: t.options.mailText || "" });
  const options = { ...t.options, ...draft };
  const changed = draft.mailSubject !== (t.options.mailSubject || "") || draft.mailText !== (t.options.mailText || "");
  return (
    <Modal wide title="✉️ L'e-mail des participants" onClose={onClose}>
      <MailEditor t={t} options={options} people={t.participants.filter((p) => !p.erased)} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      <div className="flex flex-col sm:flex-row gap-2">
        {toSend > 0 && (
          <button onClick={() => onSend(changed ? draft : null)} disabled={!!busy} className={`flex-1 py-3 text-sm ${btn}`}>
            {busy ? "⏳ Envoi…" : `📨 Envoyer à ${toSend} personne${toSend > 1 ? "s" : ""}`}
          </button>
        )}
        <button onClick={() => onSave(changed ? draft : null)} disabled={!!busy} className={`flex-1 py-3 text-sm ${btnLine}`}>
          {toSend > 0 ? "Enregistrer sans envoyer" : "Enregistrer"}
        </button>
      </div>
      <p className="text-xs text-gray-400">Les renvois à une personne utilisent aussi ce texte.</p>
    </Modal>
  );
}

// 5. Tirage
function StepDraw({ t, flush, setErr, onDrawn, setStep }) {
  const [busy, setBusy] = useState(false);
  const problem = drawProblem(t.name, t.draft);
  const o = t.options;
  const draw = async () => {
    setBusy(true); setErr("");
    try {
      if ((await flush()) === false) throw new Error("Brouillon non enregistré : réessayez.");
      const r = await call("draw", { id: t.id });
      onDrawn(r.tirage, r.carnet);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const lines = [
    ["Tirage", t.name || "—", 0],
    ["Participants", `${t.draft.length}`, 1],
    ["Exclusions", `${t.exclusions.length}${t.avoid.length ? ` · ${t.avoid.length} ancien(s) tirage(s) à éviter` : ""}`, 2],
    ["Vous", o.organizerPlays ? "participez (résultat non affiché)" : "organisez seulement (résultat visible)", 0],
    ["Ton", TONE_LABELS[o.tone], 0],
    ["Échange", [o.date && fmtDay(o.date), o.place, o.budget && `budget ${o.budget}`].filter(Boolean).join(" · ") || "—", 0],
    ["Liste de souhaits", o.wishlist ? "activée" : "non", 0],
  ];
  return (
    <Card>
      <h2 className="font-bold text-gray-800">Récapitulatif</h2>
      <div className="divide-y text-sm">
        {lines.map(([k, v, s]) => (
          <button key={k} onClick={() => setStep(s)} className="w-full flex justify-between gap-3 py-2 text-left hover:bg-gray-50">
            <span className="text-gray-500">{k}</span><span className="text-gray-800 font-semibold text-right">{v}</span>
          </button>
        ))}
      </div>
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button onClick={draw} disabled={busy || !!problem} className={`w-full py-4 text-lg ${btn}`}>{busy ? "⏳ Tirage…" : "🎲 Effectuer le tirage"}</button>
      <p className="text-xs text-gray-400 text-center">Rien n'est envoyé à ce stade : vous enverrez les liens à l'étape suivante.</p>
    </Card>
  );
}

// ── Tirage effectué ──────────────────────────────────────────────
function Drawn({ t, setT, setErr }) {
  const [busy, setBusy] = useState(null);
  const [pairs, setPairs] = useState(null);
  const [panel, setPanel] = useState(null); // { id, kind: "address" | "relay" }
  const [note, setNote] = useState(null); // { id, text, bad } sous la personne
  const [info, setInfo] = useState("");
  const [mailOpen, setMailOpen] = useState(false);
  const o = t.options;
  const parts = t.participants;
  const sent = parts.filter((p) => p.sentAt).length;
  const opened = parts.filter((p) => p.openedAt).length;
  const reachable = parts.filter((p) => !p.erased);
  const toSend = reachable.filter((p) => !p.sentAt).length;

  const run = async (key, action, body = {}) => {
    setBusy(key); setErr(""); setInfo("");
    try {
      const r = await call(action, { id: t.id, ...body });
      if (r.tirage) setT(r.tirage);
      if (r.failed?.length) setErr(`Échec de l'envoi pour ${r.failed.length} personne(s). Réessayez.`);
      return r;
    } catch (e) { setErr(e.message); return null; }
    finally { setBusy(null); }
  };
  const saveOptions = (patch) => run("opt", "save", { patch: { options: { ...o, ...patch } } });
  const flip = (p, kind) => { setNote(null); setPanel(panel?.id === p.id && panel.kind === kind ? null : { id: p.id, kind }); };
  // action sur une personne : message sous sa ligne
  const one = async (p, action, body, done) => {
    setBusy(p.id); setNote(null);
    try {
      const r = await call(action, { id: t.id, participantId: p.id, ...body });
      if (r.tirage) setT(r.tirage);
      setNote({ id: p.id, ...done(r) });
      return r;
    } catch (e) { setNote({ id: p.id, text: e.message, bad: true }); return null; }
    finally { setBusy(null); }
  };
  const sendOne = (p) => one(p, "send", {}, (r) => (r.sent?.length ? { text: `Lien envoyé à ${p.email}.` } : { text: "Échec de l'envoi. Réessayez.", bad: true }));
  const saveAddress = async (p, email) => {
    const r = await one(p, "address", { email }, (x) => (x.mailFailed
      ? { text: "Adresse modifiée, mais l'e-mail n'est pas parti : cliquez sur « Envoyer ».", bad: true }
      : { text: x.resend ? `Nouveau lien envoyé à ${email}. L'ancien ne fonctionne plus.` : "Adresse modifiée." }));
    if (r) setPanel(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">{t.name}</h2>
          <p className="text-xs text-gray-400">Tiré le {fmtDate(t.drawnAt)} · {parts.length} participants</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <Stat n={`${sent}/${parts.length}`} label="liens envoyés" />
          <Stat n={`${opened}/${parts.length}`} label="résultats ouverts" />
        </div>
        {toSend > 0
          ? <button onClick={() => setMailOpen(true)} disabled={!!busy} className={`w-full py-3.5 ${btn}`}>{busy === "all" ? "⏳ Envoi…" : `📨 Envoyer les liens par e-mail${sent ? ` aux ${toSend} restants` : ` (${toSend})`}`}</button>
          : <Alert tone="green">Tous les liens ont été envoyés. Vous pouvez renvoyer un lien à une personne ci-dessous.</Alert>}
        <button onClick={() => setMailOpen(true)} className="text-xs text-red-600 font-semibold underline">✉️ Voir et personnaliser l'e-mail</button>
        <p className="text-xs text-gray-400">Chaque participant reçoit un e-mail avec son lien personnel : son résultat s'affiche dès qu'il l'ouvre. « Ouvert » indique que sa page a été affichée (certaines messageries d'entreprise ouvrent les liens automatiquement, ce qui peut compter comme « ouvert »).</p>
        {sent === 0 && (
          <button onClick={() => run("undraw", "undraw")} disabled={!!busy} className="text-xs text-gray-500 underline">Refaire le tirage (modifier les participants, les exclusions…)</button>
        )}
      </Card>

      {info && <Alert tone="green">{info}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-800">Participants</h2>
          {!o.organizerPlays && (!pairs
            ? <button onClick={async () => { const r = await run("reveal", "reveal"); if (r) setPairs(r.pairs); }} disabled={!!busy} className="text-xs border-2 border-gray-200 font-bold px-3 py-1 rounded-full">👀 Voir qui offre à qui</button>
            : <button onClick={() => setPairs(null)} className="text-xs underline text-gray-500">Masquer</button>)}
        </div>
        {pairs && <p className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-3 py-2">Qui offre à qui est affiché : cet affichage est enregistré, par souci de transparence.</p>}
        <div className="divide-y">
          {parts.map((p) => (
            <div key={p.id} className="py-2.5 space-y-2">
             <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{p.prenom} {p.nom}
                  {pairs && <span className="ml-2 text-purple-600">→ {pairs[p.id]?.prenom} {pairs[p.id]?.nom}</span>}</p>
                {p.erased
                  ? <p className="text-xs text-orange-600">Coordonnées supprimées à sa demande</p>
                  : <p className="text-xs text-gray-400 truncate">{p.email}</p>}
                <p className="text-xs">
                  {p.sentAt ? <span className="text-green-600">✓ Envoyé {fmtShort(p.sentAt)}</span> : <span className="text-gray-400">Pas encore envoyé</span>}
                  {p.openedAt && <span className="text-green-600"> · ✓ Ouvert {fmtShort(p.openedAt)}</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!p.erased && (
                  <button onClick={() => sendOne(p)} disabled={!!busy}
                    className="text-xs border-2 border-red-200 text-red-600 font-bold px-3 py-1 rounded-full disabled:opacity-40">
                    {busy === p.id ? "⏳" : p.sentAt ? "Renvoyer" : "Envoyer"}
                  </button>
                )}
                <button onClick={() => flip(p, "relay")} disabled={!!busy} className="text-xs border-2 border-gray-200 text-gray-600 font-bold px-3 py-1 rounded-full disabled:opacity-40">Envoyer autrement</button>
                {!p.erased && <button onClick={() => flip(p, "address")} disabled={!!busy} className="text-xs border-2 border-gray-200 text-gray-600 font-bold px-3 py-1 rounded-full disabled:opacity-40">Modifier l'adresse</button>}
              </div>
             </div>
             {note?.id === p.id && <p role="status" className={`text-xs ${note.bad ? "text-red-600" : "text-green-600"}`}>{note.text}</p>}
             {panel?.id === p.id && panel.kind === "address" && (
               <AddressPanel key={p.id} p={p} busy={busy === p.id} onSave={(email) => saveAddress(p, email)} onClose={() => setPanel(null)} />
             )}
             {panel?.id === p.id && panel.kind === "relay" && <RelayPanel key={`${p.id}${p.email}`} t={t} p={p} onClose={() => setPanel(null)} />}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">« Envoyer autrement » prépare un message pour WhatsApp, SMS ou une autre messagerie. L'appli ne sait pas s'il est parti : la personne reste « pas encore envoyé » jusqu'à un envoi par e-mail.</p>
      </Card>

      {sent > 0 && <SoutenirLink />}

      <Card>
        <h2 className="font-bold text-gray-800">Échange</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Date"><DateInput className={input} defaultValue={o.date} onBlur={(e) => e.target.value !== o.date && saveOptions({ date: e.target.value })} /></Field>
          <Field label="Lieu"><input className={input} defaultValue={o.place} maxLength={LIMITS.field} onBlur={(e) => e.target.value !== o.place && saveOptions({ place: e.target.value })} /></Field>
          <Field label="Budget"><input className={input} defaultValue={o.budget} maxLength={40} onBlur={(e) => e.target.value !== o.budget && saveOptions({ budget: e.target.value })} /></Field>
        </div>
        <Toggle checked={o.wishlist} onChange={(v) => saveOptions({ wishlist: v })} title="Liste de souhaits"
          desc="Activable à tout moment ; vous ne voyez pas les listes (elles trahiraient le secret)." />
        <p className="text-xs text-gray-400">Ces informations apparaissent sur la page personnelle de chaque participant.</p>
      </Card>

      {mailOpen && (
        <MailModal t={t} toSend={toSend} busy={busy} onClose={() => setMailOpen(false)}
          onSave={async (patch) => { if (!patch || (await saveOptions(patch))) setMailOpen(false); }}
          onSend={async (patch) => {
            if (patch && !(await saveOptions(patch))) return;
            const r = await run("all", "send");
            if (r) { setMailOpen(false); if (r.sent?.length) setInfo(`${r.sent.length} lien(s) envoyé(s).`); }
          }} />
      )}
    </div>
  );
}

/* Nouvelle adresse d'un participant, même après l'envoi. */
function AddressPanel({ p, busy, onSave, onClose }) {
  const [email, setEmail] = useState(p.email || "");
  const clean = email.trim().toLowerCase();
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(clean); }} className="bg-gray-50 border rounded-2xl p-3 space-y-2">
      <Field label={`Adresse e-mail de ${p.prenom}`}>
        <input type="email" autoFocus className={input} value={email} maxLength={LIMITS.field} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-500">{p.sentAt ? "Un nouveau lien part à cette adresse ; l'ancien ne fonctionnera plus." : "Le lien pourra ensuite être envoyé à cette adresse."}</p>
      <div className="flex gap-2">
        <button disabled={busy || !isEmail(clean) || clean === p.email} className={`px-4 py-2 text-sm ${btn}`}>{busy ? "⏳" : p.sentAt ? "Enregistrer et renvoyer" : "Enregistrer"}</button>
        <button type="button" onClick={onClose} className={`px-4 py-2 text-sm ${btnLine}`}>Annuler</button>
      </div>
    </form>
  );
}

/* Message prêt à transmettre. Le lien n'est demandé qu'ici, pour cette personne ;
 * si l'organisateur joue, il confirme d'abord. */
function RelayPanel({ t, p, onClose }) {
  const plays = t.options.organizerPlays !== false;
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try { setLink((await call("link", { id: t.id, participantId: p.id })).link); } catch (e) { setErr(e.message); }
    setBusy(false);
  }, [t.id, p.id]);
  useEffect(() => { if (!plays) load(); }, [plays, load]);
  const message = link ? relayMessage(t, p, link) : "";
  return (
    <div className="bg-gray-50 border rounded-2xl p-3 space-y-2">
      {!link && plays && (
        <>
          <p className="text-sm text-gray-700">Ce lien montre le résultat de {p.prenom}. Transmettez-le sans l'ouvrir : {p.prenom} verrait la date de première ouverture.</p>
          <button onClick={load} disabled={busy} className={`px-4 py-2 text-sm ${btn}`}>{busy ? "⏳" : "Préparer le message"}</button>
        </>
      )}
      {!link && !plays && !err && <p className="text-sm text-gray-400">Chargement…</p>}
      {err && <p className="text-xs text-red-600">{err} {!plays && <button onClick={load} className="underline">Réessayer</button>}</p>}
      {link && (
        <>
          <pre className="bg-white border rounded-xl p-3 text-sm whitespace-pre-wrap break-words font-sans text-gray-700">{message}</pre>
          <ShareActions subject={`Ami Invisible : ${t.name}`} message={message} />
        </>
      )}
      <button onClick={onClose} className="block text-xs text-gray-500 underline">Fermer</button>
    </div>
  );
}

// ── Petits éléments ──────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 font-semibold mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
  );
}

function Choice({ checked, onChange, title, desc }) {
  return (
    <button type="button" onClick={onChange} className={`w-full text-left border-2 rounded-2xl px-4 py-3 ${checked ? "border-red-400 bg-red-50" : "border-gray-100"}`}>
      <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <span className={`w-4 h-4 rounded-full border-2 ${checked ? "border-red-500 bg-red-500" : "border-gray-300"}`} />{title}
      </span>
      <span className="block text-xs text-gray-500 mt-0.5 ml-6">{desc}</span>
    </button>
  );
}

function Toggle({ checked, onChange, title, desc }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-full text-left flex items-start gap-3">
      <span className={`mt-0.5 w-10 h-6 rounded-full shrink-0 relative transition-colors ${checked ? "bg-red-500" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span><span className="block text-sm font-bold text-gray-800">{title}</span><span className="block text-xs text-gray-500">{desc}</span></span>
    </button>
  );
}

function Stat({ n, label }) {
  return (
    <div className="bg-orange-50 rounded-2xl py-3">
      <p className="text-2xl font-extrabold text-gray-900">{n}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
