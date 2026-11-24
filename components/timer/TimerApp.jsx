"use client";
/*
 * Timer (/timer) : accueil, réglage, réglages, séance. Les écrans sont gérés ici
 * avec l'historique du navigateur : la touche retour revient à l'écran précédent
 * et, pendant une séance, met en pause et demande confirmation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Star, Trash2, Share2 } from "lucide-react";
import AppIcon from "@/components/AppIcon";
import ShareActions from "@/components/jukebox/ShareActions";
import { MODES, FIELDS, DEFAULTS, PRESETS, MAX_TIMERS, steps, fmt, totalText, describe, bump, setField, shareQuery, parseShare, normalizeConfig, cleanName } from "@/lib/timer";
import * as audio from "./audio";
import { useTimers, readLocal, writeLocal } from "./useTimers";
import TimePicker from "./TimePicker";
import VolumeSliders from "./VolumeSliders";
import Session from "./Session";

const SET0 = { prep: 10, half: false, sound: "bip", voice: false, voiceName: "tel", vol: 100, volVoice: 100 };
const BAR = { work: "#FF7A1A", rest: "#2DD4C2", sets: "#C9B8FF" };
const MINI = {
  iv: [[0, 8, 20], [10, 5, 8], [17, 8, 20], [27, 5, 8], [34, 6, 20]], em: [[0, 11, 20], [14, 11, 20], [28, 12, 20]],
  py: [[0, 6, 7], [8, 6, 13], [16, 6, 22], [24, 6, 13], [32, 6, 7]], ti: [[0, 40, 12]], ch: [[0, 2, 20], [8, 2, 12], [16, 2, 20], [24, 2, 12], [32, 2, 20]],
};
const GO = "bg-brand-orange hover:bg-brand-orange-dark text-brand-navy-dark font-extrabold rounded-full";
const ROUND = "w-11 h-11 shrink-0 rounded-full bg-white border border-gray-200 grid place-items-center";

function Stepper({ c, field, onChange, onPick }) {
  const [key, label, type] = field;
  const ref = useRef({});
  ref.current.c = c;
  const stop = () => { clearTimeout(ref.current.t); clearInterval(ref.current.i); };
  useEffect(() => stop, []);
  const go = (dir, big) => { const n = bump(ref.current.c, key, dir, big); ref.current.c = n; onChange(n); };
  const press = (dir) => (e) => {
    if (e.button) return;
    stop();
    go(dir);
    let n = 0;
    ref.current.t = setTimeout(() => { ref.current.i = setInterval(() => go(dir, n++ > 8), 110); }, 450);
  };
  const btn = (dir) => (
    <button type="button" aria-label={`${label} : ${dir < 0 ? "moins" : "plus"}`} className="w-12 h-12 rounded-full bg-white border border-gray-200 text-2xl leading-none select-none touch-manipulation"
      onPointerDown={press(dir)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(dir); } }}>{dir < 0 ? "−" : "+"}</button>
  );
  const val = "w-24 text-center text-2xl font-extrabold tabular-nums";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 py-2 border-b border-gray-200">
      <span className="text-lg">{label}</span>
      <span className="flex items-center gap-1 ml-auto">
        {btn(-1)}
        {type === "n" ? <output className={val}>{c[key]}</output> : (
          <button type="button" aria-label={`${label} : choisir`} onClick={() => onPick(field)} className={`${val} h-11 underline decoration-dotted decoration-2 decoration-gray-300 underline-offset-8`}>
            {key === "limit" && !c[key] ? "–" : fmt(c[key])}
          </button>
        )}
        {btn(1)}
      </span>
    </div>
  );
}

export default function TimerApp() {
  const { mine, favs, change, leave, user, error } = useTimers();
  const [view, setView] = useState("home");
  const [settings, setSettings] = useState(SET0);
  const [last, setLast] = useState({ name: "Tabata", c: PRESETS[0].c });
  const [cat, setCat] = useState("Tous");
  const [cur, setCur] = useState(null);   // réglage en cours { id?, name, c, received? }
  const [run, setRun] = useState(null);   // séance { name, c }
  const [ask, setAsk] = useState(false);
  const [pick, setPick] = useState(null); // champ en cours dans les molettes
  const [nm, setNm] = useState("");
  const [msg, setMsg] = useState("");
  const [share, setShare] = useState(false);
  const [del, setDel] = useState(null);
  const live = useRef({});
  live.current = { view, run, cur };

  /* --- écrans et touche retour --- */
  const go = useCallback((v, replace = false, keepScroll = false) => {
    window.history[replace ? "replaceState" : "pushState"]({ ...window.history.state, timer: v }, "");
    setView(v);
    if (v !== "session" && !keepScroll) window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => window.history.back(), []);
  const open = useCallback((t, replace) => {
    const next = { id: t.id, name: t.name, c: t.c, received: t.received };
    live.current.cur = next;
    setCur(next);
    setNm(t.id || t.received ? t.name : "");
    setMsg(""); setShare(false);
    go("edit", replace);
  }, [go]);

  useEffect(() => {
    const s = readLocal("timer_settings");
    if (s && typeof s === "object") setSettings({ ...SET0, ...s });
    const l = readLocal("timer_last"), c = normalizeConfig(l?.c);
    if (c) setLast({ name: cleanName(l.name) || MODES[c.m], c });
    const got = parseShare(window.location.search);
    // l'accueil reste sous le timer reçu ; l'adresse redevient /timer
    window.history.replaceState({ ...window.history.state, timer: "home" }, "", "/timer");
    if (got) open({ ...got, received: true });

    const pop = (e) => {
      const v = e.state?.timer || "home";
      const { view: from, run: r, cur: k } = live.current;
      setPick(null);
      if (from === "session" && r) {
        if (!r.done && !r.leaving) {
          window.history.pushState({ ...window.history.state, timer: "session" }, "");
          setAsk(true);
          return;
        }
        setRun(null);
      }
      // écrans qui n'ont plus rien à montrer (touche suivant du navigateur)
      setView(v === "session" || (v === "edit" && !k) ? "home" : v);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [open]);

  const changeSettings = useCallback((patch) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      writeLocal("timer_settings", n);
      audio.configure(n);
      return n;
    });
  }, []);

  const start = (name, c) => {
    audio.unlock(settings);
    const l = { name, c };
    setLast(l);
    writeLocal("timer_last", l);
    const r = { name, c, done: false, leaving: false };
    live.current.run = r;
    setRun(r); setAsk(false);
    go("session");
  };
  const done = useCallback(() => { if (live.current.run) live.current.run.done = true; }, []);
  const quit = useCallback(() => { if (live.current.run) live.current.run.leaving = true; back(); }, [back]);

  if (view === "session" && run) {
    return <Session name={run.name} c={run.c} settings={settings} onSettings={changeSettings} ask={ask} setAsk={setAsk}
      onQuit={quit} onDone={done} />;
  }

  const shell = (children) => (
    <div className="min-h-screen bg-[#F3F6FB] text-brand-navy font-outfit">
      <main className="max-w-xl mx-auto px-4 pt-4 pb-12 space-y-6">{children}</main>
    </div>
  );
  const head = (title) => (
    <div className="flex items-center gap-3">
      <button type="button" className={ROUND} aria-label="Retour" onClick={back}><ArrowLeft size={20} /></button>
      <h1 className="text-2xl font-extrabold min-w-0 break-words">{title}</h1>
    </div>
  );

  /* --- réglages --- */
  if (view === "settings") {
    const chip = (on) => `px-4 min-h-[42px] rounded-full border text-sm font-semibold ${on ? "bg-brand-navy text-white border-brand-navy" : "bg-white border-gray-200"}`;
    const demo = (patch, fn) => () => { const n = { ...settings, ...patch }; changeSettings(patch); audio.unlock(n); fn(); };
    return shell(
      <>
        {head("Réglages")}
        <section>
          <h2 className="font-semibold mb-2">Son</h2>
          <div className="flex flex-wrap gap-2">
            {audio.SOUNDS.map(([v, l]) => <button key={v} type="button" aria-pressed={settings.sound === v} className={chip(settings.sound === v)} onClick={demo({ sound: v }, () => { audio.signal("work"); })}>{l}</button>)}
          </div>
        </section>
        <section>
          <label className="flex items-center justify-between py-2"><span className="font-semibold">Voix</span>
            <input type="checkbox" className="w-6 h-6 accent-brand-orange" checked={settings.voice} onChange={(e) => changeSettings({ voice: e.target.checked })} /></label>
          {settings.voice && (
            <div className="flex flex-wrap gap-2">
              {audio.VOICES.map(([v, l]) => <button key={v} type="button" aria-pressed={settings.voiceName === v} className={chip(settings.voiceName === v)} onClick={demo({ voiceName: v }, () => audio.say("go"))}>{l}</button>)}
            </div>
          )}
        </section>
        <section className="divide-y divide-gray-200 border-y border-gray-200">
          <div><VolumeSliders settings={settings} onSettings={changeSettings} /></div>
          <label className="flex items-center justify-between gap-3 py-3"><span>Signal à la moitié de l’effort</span>
            <input type="checkbox" className="w-6 h-6 accent-brand-orange" checked={settings.half} onChange={(e) => changeSettings({ half: e.target.checked })} /></label>
          <label className="flex items-center justify-between gap-3 py-3"><span>Préparation</span>
            <select className="border border-gray-200 bg-white rounded-xl px-3 py-2" value={settings.prep} onChange={(e) => changeSettings({ prep: Number(e.target.value) })}>
              {[0, 5, 10, 15, 30].map((v) => <option key={v} value={v}>{v ? `${v} s` : "Aucune"}</option>)}
            </select></label>
        </section>
        <p className="text-sm text-gray-600">Touche un son ou une voix pour l’écouter. Ces réglages restent sur cet appareil.</p>
        <p className="text-xs text-gray-500">Sons CC0 : sifflet (SpliceSound), cloche (IOII-IOIO-IIOI). Voix Claire : synthèse Piper, corpus SIWIS (CC BY 4.0).</p>
      </>
    );
  }

  /* --- réglage d'un timer --- */
  if (view === "edit" && cur) {
    const c = cur.c, st = steps(c), max = Math.max(...st.map((x) => x.d));
    const setC = (n) => setCur((x) => ({ ...x, c: n }));
    const label = cleanName(nm) || cur.name;
    const save = () => {
      const name = cleanName(nm);
      if (!name) return setMsg("Donne un nom à ton timer pour l’enregistrer.");
      if (!cur.id && mine.length >= MAX_TIMERS) return setMsg(`Maximum de ${MAX_TIMERS} timers atteint.`);
      const t = { id: cur.id || crypto.randomUUID(), name, c };
      change((d) => ({ ...d, mine: cur.id ? d.mine.map((x) => (x.id === t.id ? t : x)) : [t, ...d.mine] }));
      setCur({ ...t });
      setMsg("Enregistré dans « Mes timers ».");
    };
    const link = typeof window === "undefined" ? "" : `${window.location.origin}/timer?${shareQuery(label, c)}`;
    return shell(
      <>
        {head(cur.name)}
        {cur.received && <p className="text-sm bg-white rounded-2xl px-4 py-3">On t’a partagé ce timer : lance-le, ajuste-le ou enregistre-le dans les tiens.</p>}
        <div className="text-center">
          <div className="text-6xl font-extrabold tabular-nums leading-none">{c.m === "ch" && !c.limit ? "∞" : totalText(c)}</div>
          <div className="text-gray-600 mt-1">{c.m === "ch" ? (c.limit ? "limite" : "sans limite") : "durée totale, hors préparation"}</div>
          {st.length > 1 && st.length < 150 && (
            <div className="flex items-end h-10 gap-px mt-4 rounded-lg overflow-hidden" aria-hidden="true">
              {st.map((x, i) => <i key={i} style={{ flex: x.d, background: BAR[x.k], height: x.k === "work" ? `${c.m === "py" ? 20 + (80 * x.d) / max : 100}%` : "35%" }} />)}
            </div>
          )}
        </div>
        <div>
          {FIELDS[c.m].filter((f) => f[0] !== "setRest" || c.sets > 1).map((f) => (
            <Stepper key={f[0]} c={c} field={f} onChange={setC} onPick={(x) => { setPick(x); go("edit", false, true); }} />
          ))}
        </div>
        <button type="button" className={`${GO} w-full text-2xl py-4`} onClick={() => start(label, c)}>GO</button>
        <div className="space-y-2">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <input aria-label="Nom du timer" maxLength={40} placeholder="Nom de mon timer" value={nm} onChange={(e) => { setNm(e.target.value); setMsg(""); }}
              className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5" />
            <button className="rounded-full bg-white border border-gray-200 px-4 font-semibold">Enregistrer</button>
          </form>
          <p role="status" className="text-sm text-gray-600 min-h-[1.25rem]">{msg}</p>
        </div>
        {share
          ? <ShareActions subject={label} message={`⏱️ ${label} : lance ce timer en un appui.\n\n👉 ${link}`} />
          : <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold min-h-[44px]" onClick={() => setShare(true)}><Share2 size={18} /> Partager ce timer</button>}
        {pick && <TimePicker label={pick[1]} value={c[pick[0]]} onClose={back} onOk={(v) => { setC(setField(c, pick[0], v)); back(); }} />}
      </>
    );
  }

  /* --- accueil --- */
  const cats = ["Tous", ...new Set(PRESETS.map((p) => p.cat))];
  const list = [...mine, ...PRESETS.filter((p) => favs.includes(p.id))];
  const row = (t) => {
    const fav = favs.includes(t.id);
    return (
      <li key={t.id} className="flex items-center gap-2 border-b border-gray-200 last:border-0">
        <button type="button" className="flex-1 min-w-0 text-left py-3" onClick={() => open(t.cat ? { name: t.name, c: t.c } : t)}>
          <span className="block font-semibold break-words">{t.name}</span>
          <span className="block text-sm text-gray-600">{t.d || describe(t.c)}</span>
        </button>
        <span className="text-sm text-gray-600 tabular-nums">{totalText(t.c)}</span>
        {t.cat ? (
          <button type="button" className="w-11 h-11 grid place-items-center" aria-label={`Favori : ${t.name}`} aria-pressed={fav}
            onClick={() => change((d) => ({ ...d, favs: fav ? d.favs.filter((x) => x !== t.id) : [...d.favs, t.id] }))}>
            <Star size={21} className={fav ? "fill-brand-orange text-brand-orange" : "text-gray-400"} />
          </button>
        ) : del === t.id ? (
          <button type="button" className="text-sm font-semibold text-red-700 min-h-[44px] px-1" onBlur={() => setDel(null)} onClick={() => { setDel(null); change((d) => ({ ...d, mine: d.mine.filter((x) => x.id !== t.id) })); }}>Supprimer ?</button>
        ) : (
          <button type="button" className="w-11 h-11 grid place-items-center text-gray-400" aria-label={`Supprimer ${t.name}`} onClick={() => setDel(t.id)}><Trash2 size={18} /></button>
        )}
      </li>
    );
  };
  return shell(
    <>
      <div className="flex justify-between items-center gap-3 text-xs">
        <Link href="/" className="text-gray-500 hover:underline">← apps360.fr</Link>
        {user ? (
          <span className="flex items-center gap-3 min-w-0"><span className="text-gray-600 truncate">{user.email}</span>
            <button type="button" onClick={leave} className="font-medium hover:underline">Déconnexion</button></span>
        ) : <Link href="/connexion?next=/timer" className="font-medium hover:underline">Se connecter</Link>}
      </div>
      <div className="flex items-center gap-3">
        <AppIcon app="timer" className="w-16 h-16 shadow-lg" />
        <h1 className="text-3xl font-extrabold flex-1">Timer</h1>
        <button type="button" className={ROUND} aria-label="Réglages" onClick={() => go("settings")}><Settings size={20} /></button>
      </div>
      {error && user && <p className="text-sm bg-amber-100 rounded-2xl px-4 py-3">Compte injoignable : tes timers restent sur cet appareil et seront enregistrés plus tard.</p>}
      <div className="bg-brand-navy text-white rounded-2xl p-4 flex items-center gap-3">
        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => open(last)}>
          <span className="block text-sm text-brand-mist">Reprendre</span>
          <span className="block text-xl font-semibold break-words">{last.name}</span>
          <span className="block text-sm text-brand-mist">{describe(last.c)} · {totalText(last.c)}</span>
        </button>
        <button type="button" className={`${GO} text-lg px-6 py-3`} onClick={() => start(last.name, last.c)}>GO</button>
      </div>
      <section>
        <h2 className="font-semibold mb-2">Nouveau timer</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Object.entries(MODES).map(([m, l]) => (
            <button key={m} type="button" onClick={() => open({ name: l, c: DEFAULTS[m] })} className="bg-white border border-gray-200 rounded-2xl py-3 grid gap-2 justify-items-center text-sm font-semibold">
              <svg viewBox="0 0 40 24" className="w-10 h-6" aria-hidden="true">{MINI[m].map(([x, w, h], i) => <rect key={x} x={x} y={24 - h} width={w} height={h} rx="1.5" fill={m === "iv" && i % 2 ? "#14C8B6" : "#FF7A1A"} />)}</svg>
              {l}
            </button>
          ))}
        </div>
      </section>
      {list.length > 0 && <section><h2 className="font-semibold mb-1">Mes timers et favoris</h2><ul>{list.map(row)}</ul></section>}
      <section>
        <h2 className="font-semibold mb-2">Programmes</h2>
        <div className="flex flex-wrap gap-2 mb-1">
          {cats.map((k) => <button key={k} type="button" aria-pressed={k === cat} onClick={() => setCat(k)} className={`px-3.5 min-h-[40px] rounded-full border text-sm ${k === cat ? "bg-brand-navy text-white border-brand-navy" : "border-gray-300"}`}>{k}</button>)}
        </div>
        <ul>{PRESETS.filter((p) => cat === "Tous" || p.cat === cat).map(row)}</ul>
      </section>
      <p className="text-xs text-gray-500">
        {user ? "Tes timers et favoris sont enregistrés sur ton compte." : "Tes timers et favoris restent sur cet appareil. Connecte-toi pour les retrouver partout."}{" "}
        <Link href="/timer/confidentialite" className="underline">Vos données</Link>
      </p>
    </>
  );
}
