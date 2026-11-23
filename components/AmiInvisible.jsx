"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DEFAULT_TEMPLATE as defaultTemplate, fillMessage as fill, SECRET } from "@/lib/amiInvisible";
import { useAuth } from "@/components/AuthProvider";
import PasswordInput from "@/components/PasswordInput";

const TABS = ["Participants", "Exclusions", "Message", "Tirage", "Historique"];
const ICONS = ["👥", "🚫", "✉️", "🎲", "📋"];

/* Tout passe par /api/ami-invisible (tirage, envois, données) : le navigateur
 * ne reçoit jamais les paires, sauf affichage volontaire avec le mot de passe
 * super-admin (vérifié côté serveur, tracé au journal du tirage). */
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

const fmtDate = iso => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const fmtTime = iso => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ── UI atoms ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Carnet modal ─────────────────────────────────────────────────
function CarnetModal({ carnet, current, onSelect, onClose }) {
  const [sel, setSel] = useState([]);
  const currentEmails = new Set(current.map(p => p.email?.toLowerCase()));
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const confirm = () => { onSelect(carnet.filter(p => sel.includes(p.id))); onClose(); };

  return (
    <Modal title="📖 Carnet de participants" onClose={onClose}>
      <p className="text-xs text-gray-400">Sélectionne les participants à ajouter.</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {carnet.length === 0 && <p className="text-gray-400 text-sm">Carnet vide.</p>}
        {carnet.map(p => {
          const already = currentEmails.has(p.email?.toLowerCase());
          const checked = sel.includes(p.id);
          return (
            <div key={p.id} onClick={() => !already && toggle(p.id)}
              className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors
                ${already ? "bg-gray-50 opacity-50 cursor-default" : checked ? "border-red-400 bg-red-50" : "hover:bg-gray-50"}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                ${already ? "bg-gray-300 border-gray-300" : checked ? "bg-red-500 border-red-500" : "border-gray-300"}`}>
                {(checked || already) && <span className="text-white text-xs">✓</span>}
              </div>
              <div>
                <p className="text-sm font-medium">{p.prenom} {p.nom}</p>
                <p className="text-xs text-gray-400">{p.email}</p>
              </div>
              {already && <span className="ml-auto text-xs text-gray-400">Déjà ajouté</span>}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={confirm} disabled={sel.length === 0}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium">
          Ajouter {sel.length > 0 ? `(${sel.length})` : ""}
        </button>
        <button onClick={onClose} className="flex-1 border py-2 rounded-lg text-sm">Annuler</button>
      </div>
    </Modal>
  );
}

// ── Participants ─────────────────────────────────────────────────
function ParticipantsTab({ participants, setParticipants, carnet, setCarnet }) {
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", tel: "" });
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");
  const [showCarnet, setShowCarnet] = useState(false);

  const reset = () => { setForm({ prenom: "", nom: "", email: "", tel: "" }); setEditId(null); setErr(""); };

  const save = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) return setErr("Prénom et nom requis.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setErr("Email valide requis.");
    if (editId) {
      setParticipants(p => p.map(x => x.id === editId ? { ...x, ...form } : x));
    } else {
      const newP = { ...form, id: Date.now() };
      setParticipants(p => [...p, newP]);
      const already = carnet.find(c => c.email.toLowerCase() === form.email.toLowerCase());
      if (!already) {
        const newCarnet = [...carnet, { ...form, id: newP.id }];
        setCarnet(newCarnet);
        call("carnet", { carnet: newCarnet }).catch(e => console.error("carnet:", e));
      }
    }
    reset();
  };

  const importFromCarnet = (selected) => {
    const toAdd = selected.map(p => ({ ...p, id: Date.now() + Math.random() }));
    setParticipants(p => [...p, ...toAdd]);
  };

  return (
    <div className="space-y-6">
      {showCarnet && <CarnetModal carnet={carnet} current={participants} onSelect={importFromCarnet} onClose={() => setShowCarnet(false)} />}
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">{editId ? "Modifier" : "Ajouter un participant"}</h2>
          {!editId && (
            <button onClick={() => setShowCarnet(true)}
              className={`text-xs border px-3 py-1 rounded-full ${carnet.length > 0 ? "text-red-500 border-red-300 hover:bg-red-50" : "text-gray-300 border-gray-200 cursor-default"}`}>
              📖 Carnet {carnet.length > 0 ? `(${carnet.length})` : "(vide)"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["prenom", "Prénom *"], ["nom", "Nom *"], ["email", "Email *"], ["tel", "Téléphone"]].map(([k, l]) => (
            <div key={k}>
              <label className="text-xs text-gray-500 mb-1 block">{l}</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={l.replace(" *", "")} />
            </div>
          ))}
        </div>
        {err && <p className="text-red-500 text-xs">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">{editId ? "Mettre à jour" : "Ajouter"}</button>
          {editId && <button onClick={reset} className="border px-4 py-2 rounded-lg text-sm">Annuler</button>}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Pour ce tirage ({participants.length})</h2>
        {participants.length === 0 ? <p className="text-gray-400 text-sm">Aucun participant ajouté.</p> : (
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{p.prenom} {p.nom}</p>
                  <p className="text-xs text-gray-400">{p.email}{p.tel ? ` · ${p.tel}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setForm({ prenom: p.prenom, nom: p.nom, email: p.email, tel: p.tel }); setEditId(p.id); }} className="text-xs text-blue-500 hover:underline">Modifier</button>
                  <button onClick={() => setParticipants(p2 => p2.filter(x => x.id !== p.id))} className="text-xs text-red-400 hover:underline">Retirer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exclusions ───────────────────────────────────────────────────
function ExclusionsTab({ participants, exclusions, setExclusions }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");

  const add = () => {
    if (!from || !to) return setErr("Sélectionne deux participants.");
    if (from === to) return setErr("Un participant ne peut pas s'exclure lui-même.");
    const key = `${from}->${to}`;
    if (exclusions.find(e => e.key === key)) return setErr("Exclusion déjà existante.");
    setExclusions(ex => [...ex, { key, from, to }]);
    setFrom(""); setTo(""); setErr("");
  };
  const name = id => { const p = participants.find(x => String(x.id) === String(id)); return p ? `${p.prenom} ${p.nom}` : ""; };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Ajouter une exclusion</h2>
        <div className="flex items-center gap-3">
          <select className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            value={from} onChange={e => setFrom(e.target.value)}>
            <option value="">-- Personne A --</option>
            {participants.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
          <span className="text-sm text-gray-500 whitespace-nowrap font-medium">ne peut pas offrir à</span>
          <select className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            value={to} onChange={e => setTo(e.target.value)}>
            <option value="">-- Personne B --</option>
            {participants.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        {err && <p className="text-red-500 text-xs">{err}</p>}
        <button onClick={add} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Ajouter</button>
      </div>
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Exclusions ({exclusions.length})</h2>
        {exclusions.length === 0 ? <p className="text-gray-400 text-sm">Aucune exclusion.</p> : (
          <div className="flex flex-wrap gap-2">
            {exclusions.map(e => (
              <span key={e.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {name(e.from)} ↛ {name(e.to)}
                <button onClick={() => setExclusions(ex => ex.filter(x => x.key !== e.key))} className="ml-1 hover:opacity-70">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Message ──────────────────────────────────────────────────────
function MessageTab({ template, setTemplate }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-3">
      <h2 className="font-semibold text-gray-700">Template du message</h2>
      <p className="text-xs text-gray-400">Variables : <code className="bg-gray-100 px-1 rounded">{"{prenom_offreur}"}</code> <code className="bg-gray-100 px-1 rounded">{"{nom_offreur}"}</code> <code className="bg-gray-100 px-1 rounded">{"{prenom_receveur}"}</code> <code className="bg-gray-100 px-1 rounded">{"{nom_receveur}"}</code></p>
      <textarea rows={12} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
        value={template} onChange={e => setTemplate(e.target.value)} />
      <button onClick={() => setTemplate(defaultTemplate)} className="text-xs text-gray-400 hover:underline">Réinitialiser</button>
    </div>
  );
}


// ── Envois (liste des participants d'un tirage) ──────────────────
function SendList({ tirage, busy, onSend, resendLabel = "Renvoyer" }) {
  return (
    <div className="border rounded-lg divide-y">
      {tirage.participants.map((p, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-700">{p.prenom} {p.nom} <span className="text-gray-400 text-xs">({p.email})</span></p>
            {p.sentAt && <p className="text-xs text-green-600">✓ Envoyé le {fmtTime(p.sentAt)}{p.sends > 1 ? ` (${p.sends} envois)` : ""}</p>}
          </div>
          <button onClick={() => onSend(i)} disabled={busy !== null}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-40 ${p.sentAt || !tirage.tracked ? "border-gray-300 text-gray-500 hover:bg-gray-50" : "border-red-300 text-red-500 hover:bg-red-50"}`}>
            {busy === i ? "⏳" : p.sentAt || !tirage.tracked ? resendLabel : "Envoyer"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Tirage ───────────────────────────────────────────────────────
function TirageTab({ participants, exclusions, template, onTirage, onUpdate }) {
  const [eventName, setEventName] = useState("");
  const [tirage, setTirage] = useState(null); // vue sans les paires
  const [busy, setBusy] = useState(null); // index en cours, "all", "draw"
  const [tirageErr, setTirageErr] = useState("");
  const [errName, setErrName] = useState("");
  const [preview, setPreview] = useState(null);

  const update = (t) => { setTirage(t); onUpdate(t); };

  const draw = async () => {
    setTirageErr(""); setErrName("");
    if (!eventName.trim()) return setErrName("Nomme l'événement avant de tirer.");
    if (participants.length < 2) return setTirageErr("Il faut au moins 2 participants.");
    setBusy("draw");
    try {
      const r = await call("draw", { eventName, participants, exclusions, template, replaceId: tirage?.id ?? null });
      setTirage(r.tirage); setPreview(null);
      onTirage(r.tirage, tirage?.id);
    } catch (e) { setTirageErr(e.message); }
    setBusy(null);
  };

  const send = async (index) => {
    setBusy(index ?? "all"); setTirageErr("");
    try {
      const r = await call("send", { id: tirage.id, ...(index !== undefined ? { index } : {}) });
      update(r.tirage);
      if (r.failed?.length) setTirageErr(`Échec de l'envoi pour ${r.failed.map(i => r.tirage.participants[i].prenom).join(", ")}. Réessayez.`);
    } catch (e) { setTirageErr(e.message); }
    setBusy(null);
  };

  const sent = tirage ? tirage.participants.filter(p => p.sentAt).length : 0;
  const allSent = tirage && sent === tirage.participants.length;

  if (allSent) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-800">Tirage terminé !</h2>
        <p className="text-gray-500 text-sm">Tous les messages ont été envoyés. Renvois possibles depuis l'Historique.</p>
        <button onClick={() => { setTirage(null); setEventName(""); setTirageErr(""); }}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium">Nouveau tirage</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <h2 className="font-semibold text-gray-700">Lancer le tirage</h2>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Nom de l'événement *</label>
        <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          value={eventName} onChange={e => setEventName(e.target.value)} disabled={!!tirage} placeholder="Ex : Noël famille 2026, Anniv Sophie…" />
        {errName && <p className="text-red-500 text-xs mt-1">{errName}</p>}
      </div>
      <p className="text-sm text-gray-400">👥 {participants.length} participant(s) · 🚫 {exclusions.length} exclusion(s)</p>
      {tirageErr && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{tirageErr}</div>}
      {!tirage && (
        <button onClick={draw} disabled={participants.length < 2 || busy !== null}
          className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold">
          {busy === "draw" ? "⏳ Tirage…" : "🎲 Effectuer le tirage"}
        </button>
      )}
      {tirage && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
            ✅ Tirage effectué et sauvegardé ! Le résultat reste secret, même pour vous.
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Aperçu d'un message :</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {tirage.participants.map((g, i) => (
                <button key={i} onClick={() => setPreview(preview === i ? null : i)}
                  className={`text-xs px-2 py-1 rounded-full border ${preview === i ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-600"}`}>
                  {g.prenom}
                </button>
              ))}
            </div>
            {preview !== null && (
              <pre className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap font-mono text-gray-700">
                {fill(tirage.template, tirage.participants[preview], SECRET)}
              </pre>
            )}
          </div>
          <SendList tirage={tirage} busy={busy} onSend={send} />
          {busy === "all" && <p className="text-xs text-gray-500">Envoi en cours…</p>}
          <div className="flex gap-2">
            {sent === 0 && <button onClick={draw} disabled={busy !== null} className="border border-red-300 text-red-500 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-40">Refaire</button>}
            <button onClick={() => send()} disabled={busy !== null} className="bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium">
              📨 {sent ? "Envoyer aux autres" : "Envoyer à tous"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Historique ───────────────────────────────────────────────────
function HistoriqueTab({ tirages, setTirages, carnet, setCarnet, setParticipants, setTab }) {
  const [selectedId, setSelectedId] = useState(null);
  const [pwModal, setPwModal] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [revealed, setRevealed] = useState(null); // paires affichées (mot de passe super-admin)
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const selected = tirages?.find(t => t.id === selectedId) || null;
  const replace = (t) => setTirages(list => list.map(x => x.id === t.id ? t : x));

  const tryUnlock = async () => {
    setPwErr("");
    try {
      const r = await call("reveal", { id: selected.id, password: pw });
      setRevealed(r.pairs); setPwModal(false); setPw("");
    } catch (e) { setPwErr(e.message); }
  };

  const resend = async (index) => {
    setBusy(index); setErr("");
    try {
      const r = await call("send", { id: selected.id, index });
      replace(r.tirage);
      if (r.failed?.length) setErr("Échec de l'envoi. Réessayez.");
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const deleteTirage = async (id) => {
    try {
      await call("delete", { id });
      setTirages(list => list.filter(t => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) { setErr(e.message); }
    setDeleteConfirm(null);
  };

  const importParticipants = (tirage) => {
    const toImport = tirage.participants.map(({ sentAt, sends, ...p }) => p);
    const newCarnet = [...carnet];
    toImport.forEach(p => {
      if (!newCarnet.find(c => c.email.toLowerCase() === p.email.toLowerCase())) newCarnet.push({ ...p, id: Date.now() + Math.random() });
    });
    if (newCarnet.length !== carnet.length) {
      setCarnet(newCarnet);
      call("carnet", { carnet: newCarnet }).catch(e => console.error("carnet:", e));
    }
    setParticipants(toImport.map(p => ({ ...p, id: Date.now() + Math.random() })));
    setTab(0);
  };

  if (!tirages) return <div className="text-center text-gray-400 py-10">{err || "Chargement…"}</div>;

  return (
    <div className="space-y-4">
      {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{err}</div>}
      {!selected && (
        tirages.length === 0
          ? <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400"><p className="text-3xl mb-2">📭</p><p>Aucun tirage sauvegardé.</p></div>
          : tirages.map(t => {
            const sent = t.participants.filter(p => p.sentAt).length;
            return (
              <div key={t.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{t.eventName}</p>
                  <p className="text-xs text-gray-400">{fmtDate(t.date)} · {t.participants.length} participants{t.tracked ? ` · ${sent}/${t.participants.length} envoyés` : ""}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => { setSelectedId(t.id); setRevealed(null); setErr(""); }} className="text-sm text-red-500 hover:underline font-medium">Ouvrir</button>
                  <button onClick={() => setDeleteConfirm(t.id)} className="text-gray-400 hover:text-red-400">🗑</button>
                </div>
              </div>
            );
          })
      )}
      {selected && (
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setSelectedId(null); setRevealed(null); }} className="text-gray-400 hover:text-gray-600 text-sm">← Retour</button>
            <div className="flex-1">
              <h2 className="font-bold text-gray-800">{selected.eventName}</h2>
              <p className="text-xs text-gray-400">{fmtDate(selected.date)} · {selected.participants.length} participants</p>
            </div>
            <button onClick={() => importParticipants(selected)}
              className="text-xs bg-red-50 border border-red-300 text-red-500 px-3 py-1 rounded-full hover:bg-red-100">
              ♻️ Réutiliser ces participants
            </button>
          </div>
          {!revealed
            ? <button onClick={() => setPwModal(true)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">🔒 Voir les paires (admin)</button>
            : <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                <span className="flex-1">⚠️ Mode admin : paires visibles</span>
                <button onClick={() => setRevealed(null)} className="underline">Masquer</button>
              </div>
          }
          <SendList tirage={selected} busy={busy} onSend={resend} />
          {revealed && (
            <div className="border rounded-lg divide-y">
              {selected.participants.map((p, i) => (
                <div key={i} className="px-3 py-3 space-y-1">
                  <p className="text-sm"><span className="font-medium">{p.prenom} {p.nom}</span>
                    <span className="ml-2 text-xs text-purple-600 font-medium">→ {revealed[i].receveur.prenom} {revealed[i].receveur.nom}</span></p>
                  <pre className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-600 whitespace-pre-wrap">{revealed[i].message}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {pwModal && (
        <Modal title="🔒 Accès admin" onClose={() => { setPwModal(false); setPw(""); setPwErr(""); }}>
          <p className="text-sm text-gray-500">Mot de passe administrateur requis. L'affichage des paires est noté dans le journal du tirage.</p>
          <PasswordInput className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && tryUnlock()} placeholder="Mot de passe" autoFocus />
          {pwErr && <p className="text-red-500 text-xs">{pwErr}</p>}
          <button onClick={tryUnlock} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Déverrouiller</button>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Supprimer ce tirage ?" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-gray-500">Cette action est irréversible.</p>
          <div className="flex gap-2">
            <button onClick={() => deleteTirage(deleteConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Supprimer</button>
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 border py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────
export default function AmiInvisible() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [template, setTemplate] = useState(defaultTemplate);
  const [carnet, setCarnet] = useState([]);
  const [tirages, setTirages] = useState(null); // vues sans les paires
  const [loadErr, setLoadErr] = useState("");

  // une seule lecture à l'ouverture (carnet + historique)
  useEffect(() => {
    if (!user) return;
    call("load")
      .then(r => { setCarnet(r.carnet || []); setTirages(r.tirages || []); })
      .catch(e => { setLoadErr(e.message); setTirages([]); });
  }, [user]);

  const onTirage = (t, replacedId) => setTirages(list => [t, ...(list || []).filter(x => x.id !== replacedId)]);
  const onUpdate = (t) => setTirages(list => (list || []).map(x => x.id === t.id ? t : x));

  // Écran de chargement pendant la vérification d'auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Chargement…</div>
      </div>
    );
  }

  // Écran de connexion obligatoire
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center space-y-6">
          <Link href="/" className="text-xs text-gray-400 hover:underline block">← apps360.fr</Link>
          <div className="text-6xl">🎁</div>
          <h1 className="text-3xl font-extrabold text-gray-900">Ami Invisible</h1>
          <p className="text-gray-500 leading-relaxed">
            Pour conserver tes tirages, ton carnet de participants et y accéder depuis n'importe quel appareil,
            tu dois te connecter.
          </p>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-left text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-1">💡 Connexion ultra-simple</p>
            <p>Tu reçois un lien par email, tu cliques, c'est fait. Aucun mot de passe à retenir.</p>
          </div>
          <Link href="/connexion"
            className="block w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3.5 rounded-xl transition-colors">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Auth banner */}
        <div className="flex justify-between items-center mb-4 text-xs">
          <Link href="/" className="text-gray-400 hover:underline">← apps360.fr</Link>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">{user.email}</span>
            <button onClick={signOut} className="text-red-500 hover:underline">Déconnexion</button>
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-red-600">🎁 Ami Invisible</h1>
          <p className="text-gray-500 text-sm mt-1">Organisez votre tirage en toute confidentialité</p>
          <button onClick={() => { setParticipants([]); setExclusions([]); setTab(0); }}
            className="mt-3 text-xs border border-red-300 text-red-500 px-4 py-1.5 rounded-full hover:bg-red-50">
            ＋ Nouveau tirage
          </button>
        </div>
        {loadErr && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">{loadErr}</div>}
        <div className="flex bg-white rounded-xl shadow overflow-hidden mb-6">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`flex-1 py-3 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${tab === i ? "bg-red-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <span>{ICONS[i]}</span><span>{t}</span>
            </button>
          ))}
        </div>
        {tab === 0 && <ParticipantsTab participants={participants} setParticipants={setParticipants} carnet={carnet} setCarnet={setCarnet} />}
        {tab === 1 && <ExclusionsTab participants={participants} exclusions={exclusions} setExclusions={setExclusions} />}
        {tab === 2 && <MessageTab template={template} setTemplate={setTemplate} />}
        {tab === 3 && <TirageTab participants={participants} exclusions={exclusions} template={template} onTirage={onTirage} onUpdate={onUpdate} />}
        {tab === 4 && <HistoriqueTab tirages={tirages} setTirages={setTirages} carnet={carnet} setCarnet={setCarnet} setParticipants={setParticipants} setTab={setTab} />}
      </div>
    </div>
  );
}
