"use client";
/*
 * Formulaire de contact (/contact?app=…&sujet=…). Brouillon gardé 24 h sur
 * l'appareil ; identifiant tiré ici : un renvoi après coupure ne fait pas de doublon.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import { KINDS, SITE_APP, MESSAGE_MAX, emailNeeded, isEmail, safeName, describeDevice } from "@/lib/contact";

const DRAFT = "apps360_contact_draft";
const EMPTY = { kind: "", app: "", message: "", name: "", email: "" };
const newId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  return b.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
};
const readDraft = () => {
  try { const d = JSON.parse(localStorage.getItem(DRAFT)); return d && Date.now() - d.at < 86400e3 ? d : null; } catch (e) { return null; }
};
const writeDraft = (d) => { try { d ? localStorage.setItem(DRAFT, JSON.stringify({ ...d, at: Date.now() })) : localStorage.removeItem(DRAFT); } catch (e) { /* ignoré */ } };

const field = "w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base bg-white focus:border-brand-orange outline-none";
const tile = (on) => `rounded-2xl border-2 text-left transition-colors ${on ? "border-brand-orange bg-orange-50" : "bg-white border-gray-200 hover:border-brand-navy/40"}`;

export default function ContactForm({ apps }) {
  const [f, setF] = useState(EMPTY);
  const [from, setFrom] = useState(""); // app d'où l'on vient
  const [device, setDevice] = useState("");
  const [withDevice, setWithDevice] = useState(true);
  const [err, setErr] = useState(null); // { text, field }
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const id = useRef("");
  const start = useRef(0);
  const ready = useRef(false);
  const web = useRef(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const app = q.get("app") === SITE_APP || apps.some((a) => a.icon === q.get("app")) ? q.get("app") : "";
    const kind = Object.hasOwn(KINDS, q.get("sujet") || "") ? q.get("sujet") : "";
    const d = readDraft();
    id.current = d?.id || newId();
    start.current = Date.now();
    setFrom(app);
    setF({ ...EMPTY, ...(d?.f || {}), ...(app && { app }), ...(kind && { kind }) });
    setDevice(describeDevice(navigator.userAgent, {
      width: window.innerWidth, height: window.innerHeight,
      installed: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
    }));
    ready.current = true;
  }, [apps]);

  const set = (p) => {
    setErr(null);
    setF((o) => { const n = { ...o, ...p }; if (ready.current) writeDraft({ f: n, id: id.current }); return n; });
  };
  const fail = (text, name) => {
    setErr({ text, field: name });
    if (name) setTimeout(() => { const el = document.getElementById(`c-${name}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); }, 30);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const email = f.email.trim();
    if (!f.kind) return fail("Choisissez le sujet de votre message.", "kind");
    if (!f.app) return fail("Choisissez l'app concernée.", "app");
    if (!f.message.trim()) return fail("Écrivez votre message.", "message");
    if (!email && emailNeeded(f.kind)) return fail("Laissez votre e-mail pour que nous puissions vous répondre.", "email");
    if (email && !isEmail(email)) return fail("Vérifiez votre adresse e-mail.", "email");
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, email, id: id.current, device: f.kind === "souci" && withDevice ? device : "", web: web.current?.value || "", ms: Date.now() - start.current }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) return fail(r.error || "L'envoi n'a pas marché. Votre message est gardé sur cette page : réessayez dans un instant.", r.field);
      writeDraft(null);
      setDone({ ref: r.ref, email, name: safeName(f.name.trim()), kind: f.kind });
      window.scrollTo({ top: 0 });
    } catch (e2) {
      fail("Pas de connexion. Votre message est gardé sur cette page : réessayez dans un instant.");
    } finally { setBusy(false); }
  };
  const again = () => { id.current = newId(); start.current = Date.now(); setF({ ...EMPTY, app: f.app, name: f.name, email: f.email }); setDone(null); };

  const back = apps.find((a) => a.icon === from);
  const chosen = apps.find((a) => a.icon === f.app);
  const k = KINDS[f.kind];
  const need = emailNeeded(f.kind);
  const ring = (n) => (err?.field === n ? "rounded-2xl ring-2 ring-red-400 ring-offset-4 ring-offset-brand-cream" : "");
  const bad = (n) => err?.field === n && <p id={`c-${n}-err`} role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 my-2">⚠️ {err.text}</p>;

  if (done) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        <div role="status" className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 text-teal-700 text-3xl font-bold flex items-center justify-center" aria-hidden="true">✓</div>
          <h1 className="font-outfit text-2xl font-extrabold text-brand-navy">Merci{done.name ? ` ${done.name}` : ""}, votre message est bien arrivé</h1>
          {done.email
            ? <p className="text-gray-600">Une vraie personne va le lire, et nous revenons vers vous dès que possible à <b className="break-all">{done.email}</b>.</p>
            : <p className="text-gray-600">Il nous aide à améliorer {chosen ? chosen.title : "apps360"}.</p>}
          {done.ref && <p className="text-sm text-gray-500">Référence : <b>{done.ref}</b></p>}
          {done.email && <p className="text-xs text-gray-500">Pensez à regarder dans vos courriers indésirables.</p>}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link href={back ? back.href : "/"} className="bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-7 py-3 rounded-full">{back ? `Retour à ${back.title}` : "Retour à l'accueil"}</Link>
            <button onClick={again} className="text-sm text-gray-500 underline">Écrire un autre message</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 pb-16">
      {back && <Link href={back.href} className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-5"><AppIcon app={back.icon} /> ← {back.title}</Link>}
      <div className="text-center mb-8">
        <h1 className="font-outfit text-3xl font-extrabold text-brand-navy">Une question, une idée, un souci ?</h1>
        <p className="text-gray-600 mt-2">Écrivez-nous : une vraie personne vous lit, et nous vous répondons dès que possible.</p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-8">
        <div role="group" aria-labelledby="c-kind-l">
          <p id="c-kind-l" className="font-outfit font-extrabold text-brand-navy mb-3">De quoi s'agit-il ?</p>
          {bad("kind")}
          <div id="c-kind" tabIndex={-1} className={`grid grid-cols-2 gap-3 outline-none ${ring("kind")}`}>
            {Object.entries(KINDS).map(([key, x]) => (
              <button key={key} type="button" aria-pressed={f.kind === key} onClick={() => set({ kind: key })} className={`${tile(f.kind === key)} p-4`}>
                <span className="block text-2xl" aria-hidden="true">{x.icon}</span>
                <span className="block font-bold text-brand-navy mt-1">{x.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-labelledby="c-app-l">
          <p id="c-app-l" className="font-outfit font-extrabold text-brand-navy mb-3">Quelle app ?</p>
          {bad("app")}
          <div id="c-app" tabIndex={-1} className={`grid grid-cols-2 sm:grid-cols-3 gap-2 outline-none ${ring("app")}`}>
            {apps.filter((a) => a.state === "public" || a.icon === f.app || a.icon === from).map((a) => (
              <button key={a.icon} type="button" aria-pressed={f.app === a.icon} onClick={() => set({ app: a.icon })} className={`${tile(f.app === a.icon)} flex items-center gap-2 p-2.5 text-sm font-semibold`}>
                <AppIcon app={a.icon} className="w-8 h-8" /><span className="min-w-0">{a.title}</span>
              </button>
            ))}
            <button type="button" aria-pressed={f.app === SITE_APP} onClick={() => set({ app: SITE_APP })} className={`${tile(f.app === SITE_APP)} flex items-center gap-2 p-2.5 text-sm font-semibold`}>
              <img src="/brand/apps360-symbole.svg" alt="" className="w-8 h-8" /><span className="min-w-0">apps360 en général</span>
            </button>
          </div>
          {f.kind === "question" && chosen?.access === "request" && (
            <p className="text-sm text-gray-600 mt-3 bg-white border border-gray-200 rounded-xl p-3">Vous souhaitez utiliser {chosen.title} pour un événement ? La demande d'accès se fait sur <Link href={chosen.href} className="underline font-semibold text-brand-navy">la page de {chosen.title}</Link>.</p>
          )}
        </div>

        <div>
          <label htmlFor="c-message" className="block font-outfit font-extrabold text-brand-navy mb-2">{k?.ask || "Votre message"}</label>
          <textarea id="c-message" rows={6} maxLength={MESSAGE_MAX} value={f.message} onChange={(e) => set({ message: e.target.value })} placeholder={k?.hint || "Dites-nous tout."}
            aria-invalid={err?.field === "message"} aria-describedby={err?.field === "message" ? "c-message-err" : undefined} className={`${field} ${err?.field === "message" ? "!border-red-400" : ""}`} />
          {bad("message")}
          {f.kind === "souci" && device && (
            <label className="flex items-start gap-2.5 mt-2 text-sm text-gray-600">
              <input type="checkbox" checked={withDevice} onChange={(e) => setWithDevice(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0" />
              <span>Joindre le type d'appareil, pour nous aider : <span className="text-gray-800">{device}</span></span>
            </label>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="c-email" className="block font-outfit font-extrabold text-brand-navy mb-2">Votre e-mail {!need && <span className="font-normal font-sans text-sm text-gray-500">(facultatif)</span>}</label>
            <input id="c-email" type="email" inputMode="email" autoComplete="email" maxLength={200} required={need} value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="vous@exemple.fr"
              aria-invalid={err?.field === "email"} aria-describedby="c-email-h" className={`${field} ${err?.field === "email" ? "!border-red-400" : ""}`} />
            <p id="c-email-h" className="text-xs text-gray-500 mt-1.5">{need ? "Pour vous répondre, et rien d'autre." : "Laissez-le si vous souhaitez une réponse."}</p>
            {bad("email")}
          </div>
          <div>
            <label htmlFor="c-name" className="block font-outfit font-extrabold text-brand-navy mb-2">Votre prénom <span className="font-normal font-sans text-sm text-gray-500">(facultatif)</span></label>
            <input id="c-name" autoComplete="given-name" maxLength={40} value={f.name} onChange={(e) => set({ name: e.target.value })} className={field} />
          </div>
        </div>

        {/* piège à robots : invisible, hors tabulation */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden"><input ref={web} name="c_web_x" tabIndex={-1} autoComplete="off" /></div>

        <div className="text-center space-y-3">
          {err && !err.field && <p role="alert" className="text-sm font-semibold text-red-600">{err.text}</p>}
          <button disabled={busy} className="w-full sm:w-auto bg-brand-orange hover:bg-[#FF8C3A] text-brand-navy font-bold px-12 py-3.5 rounded-full disabled:opacity-60">{busy ? "Envoi…" : "Envoyer"}</button>
          {err?.field && <p className="text-sm font-bold text-red-700">⚠️ Pas encore envoyé : {err.text}</p>}
          <p className="text-xs text-gray-500">🔒 Votre adresse sert uniquement à vous répondre. Messages effacés de notre suivi après 12 mois. <Link href="/contact/confidentialite" className="underline">Vos données</Link></p>
          <p className="text-xs text-gray-500">Vous préférez votre messagerie ? <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a></p>
        </div>
      </form>
    </main>
  );
}
