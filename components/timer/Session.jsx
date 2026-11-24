"use client";
/* Écran de séance : plein écran, une couleur par phase, sons, voix, vibrations. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Volume2, VolumeX, X, SkipBack, SkipForward } from "lucide-react";
import { fmt, prepOf } from "@/lib/timer";
import { createEngine } from "@/lib/timerEngine";
import { useWakeLock } from "@/components/jukebox/useWakeLock";
import * as audio from "./audio";
import VolumeSliders from "./VolumeSliders";
import s from "./timer.module.css";

const COLOR = { prep: "#9DBEFF", work: "#FF7A1A", rest: "#2DD4C2", sets: "#C9B8FF", end: "#FFD45C" };
const LABEL = { prep: "Prépare-toi", work: "Effort", rest: "Repos", sets: "Repos long" };
const C = 2 * Math.PI * 94;

/* `ask` : le parent demande confirmation (touche retour du téléphone). */
export default function Session({ name, c, settings, onSettings, ask, setAsk, onQuit, onDone }) {
  const eng = useRef(null);
  const clock = useRef(0);
  const [, redraw] = useState(0);
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [vol, setVol] = useState(false);
  const hold = useRef(null);
  // sons et voix de cette séance, modifiables en cours de route ; les réglages ne changent pas
  const [on, setOn] = useState({ sound: settings.sound !== "off", voice: settings.voice });
  const heard = (o) => ({ ...settings, sound: !o.sound ? "off" : settings.sound === "off" ? "bip" : settings.sound, voice: o.voice });
  const eff = heard(on);
  // après un changement de volume, le parent réapplique les réglages généraux
  useEffect(() => { audio.configure(eff); });
  const solo = c.m === "ti" || c.m === "ch";
  useWakeLock(true);

  const announce = useCallback((first) => {
    const e = eng.current, st = e.step();
    if (st.k !== "prep") {
      audio.signal(st.k === "work" ? "work" : "rest");
      audio.buzz(st.k === "work" ? [200, 80, 200] : 400);
    }
    const last = st.k === "work" && st.n > 1 && st.r === st.n && (!st.sn || st.s === st.sn);
    audio.say(st.k !== "work" ? st.k : last ? "last" : solo || (c.m === "em" && st.r === 1) ? "go" : c.m === "em" ? "next" : "work");
    if (first) redraw((x) => x + 1);
  }, [c, solo]);
  const handle = useCallback((events) => {
    for (const ev of events) {
      if (ev.t === "step") announce();
      if (ev.t === "tick") audio.signal("tick");
      if (ev.t === "half") { audio.signal("half"); audio.say("half"); }
      if (ev.t === "end") { audio.signal("end"); audio.say("end"); audio.buzz([300, 100, 300, 100, 600]); setLocked(false); setAsk(false); onDone(); }
    }
    redraw((x) => x + 1);
  }, [announce, onDone, setAsk]);

  const begin = useCallback(() => {
    eng.current = createEngine(c, { prep: prepOf(c, settings.prep), half: settings.half });
    setPaused(false);
    setAsk(false);
    announce(true);
    clock.current = performance.now();
    // réglages lus au départ : les changer en cours de route ne relance pas la séance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);
  useEffect(() => {
    begin();
    const over = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = over; clearTimeout(hold.current); audio.silence(); };
  }, [begin]);

  const stopped = paused || ask;
  useEffect(() => {
    if (stopped) return;
    clock.current = performance.now();
    const t = setInterval(() => {
      const e = eng.current;
      if (!e || e.done) return;
      const n = performance.now(), dt = (n - clock.current) / 1000;
      clock.current = n;
      handle(e.advance(dt));
    }, 60);
    return () => clearInterval(t);
  }, [stopped, handle]);

  const e = eng.current;
  if (!e) return <div className={s.run} style={{ backgroundColor: COLOR.prep }} />;
  const st = e.step(), done = e.done;
  const value = st.up ? Math.floor(e.el) : Math.ceil(e.rem() - 1e-6);
  const text = done ? fmt(Math.floor(e.acc)) : value < 60 && !st.up ? String(Math.max(0, value)) : fmt(value);
  const part = done ? 0 : st.up && !c.limit ? 1 - (e.el % 60) / 60 : Math.min(1, e.el / st.d);
  const next = e.st[e.i + 1];
  const toggle = () => { if (!locked && !done) { setAsk(false); setPaused(ask ? false : !paused); } };
  const act = (fn) => { handle(fn()); clock.current = performance.now(); };
  const turn = (key, value) => {
    const o = { ...on, [key]: value };
    setOn(o);
    audio.unlock(heard(o));
    if (key === "voice" && !o.voice) audio.silence();
    if (key === "voice" && o.voice && !done) audio.say(st.k);
    if (key === "sound" && o.sound) audio.signal("tick");
  };
  const round = done
    ? (e.laps.length ? `${e.laps.length} tour${e.laps.length > 1 ? "s" : ""}` : "Séance terminée")
    : st.n ? `Tour ${st.r} / ${st.n}${st.sn > 1 ? ` · Série ${st.s} / ${st.sn}` : ""}`
      : e.laps.length ? `${e.laps.length} tour${e.laps.length > 1 ? "s" : ""} · dernier ${fmt(Math.floor(e.laps.at(-1)))}` : "";

  return (
    <div className={`${s.run} font-outfit`} style={{ backgroundColor: done ? COLOR.end : COLOR[st.k] }}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={s.ib} aria-label="Quitter" disabled={locked} onClick={() => (done ? onQuit() : setAsk(true))}><X /></button>
        <b className="truncate text-lg">{name}</b>
        <span className="flex gap-2">
          <button type="button" className={s.ib} aria-label="Sons et voix" aria-expanded={vol} disabled={locked} onClick={() => setVol(!vol)}>{on.sound || on.voice ? <Volume2 /> : <VolumeX />}</button>
          {!done && <button type="button" className={s.ib} aria-label="Verrouiller" disabled={locked} onClick={() => { setLocked(true); setVol(false); }}><Lock size={20} /></button>}
        </span>
      </div>
      <div className={s.mid} onClick={toggle}>
        <svg className={s.ring} viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="94" fill="none" stroke="#ffffff66" strokeWidth="9" />
          <circle cx="100" cy="100" r="94" fill="none" stroke="#0E2350" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * part} transform="rotate(-90 100 100)" />
        </svg>
        <div className={`text-center ${done ? s.fin : ""}`}>
          <div className={s.phase} role="status">{done ? "Bravo !" : solo && st.k === "work" ? (c.m === "ch" ? "Chrono" : "C’est parti") : LABEL[st.k]}</div>
          <div className={`${s.num} ${text.length > 3 ? s.long : ""}`}>{text}</div>
          <div className={s.round}>{round}</div>
        </div>
      </div>
      <div className="space-y-3">
        {vol && <div className="bg-white/60 rounded-2xl px-4 py-1 max-w-md mx-auto">
          <VolumeSliders settings={eff} onSettings={onSettings} onToggle={turn} />
        </div>}
        <div className="flex justify-between gap-3 font-semibold tabular-nums min-h-[1.5em] max-w-2xl mx-auto w-full">
          <span>{done ? "" : stopped ? "En pause" : next ? `Ensuite : ${solo ? "départ" : `${LABEL[next.k].toLowerCase()} ${fmt(next.d)}`}` : ""}</span>
          <span>{done ? "" : c.m === "ch" ? (c.limit ? `Limite ${fmt(c.limit)}` : "") : `Reste ${fmt(e.left())}`}</span>
        </div>
        <div className={s.ctl}>
          {done ? (
            <>
              <button type="button" className={s.main} onClick={() => { audio.unlock(eff); begin(); }}>Encore une fois</button>
              <button type="button" onClick={onQuit}>Terminer</button>
            </>
          ) : ask ? (
            <>
              <button type="button" className={s.main} onClick={() => { setAsk(false); setPaused(false); }}>Continuer</button>
              <button type="button" onClick={onQuit}>Quitter la séance</button>
            </>
          ) : locked ? (
            <button type="button"
              onPointerDown={() => { clearTimeout(hold.current); hold.current = setTimeout(() => setLocked(false), 800); }}
              onPointerUp={() => clearTimeout(hold.current)} onPointerLeave={() => clearTimeout(hold.current)} onPointerCancel={() => clearTimeout(hold.current)}
              onContextMenu={(ev) => ev.preventDefault()}
              onKeyDown={(ev) => { if (ev.key === "Enter") setLocked(false); }}>
              Maintenir pour déverrouiller
            </button>
          ) : (
            <>
              {!solo && <button type="button" aria-label="Précédent" onClick={() => act(e.prev)}><SkipBack /></button>}
              <button type="button" className={s.main} onClick={toggle}>{paused ? "Reprendre" : "Pause"}</button>
              {solo
                ? <button type="button" onClick={() => { e.lap(); audio.signal("tick"); redraw((x) => x + 1); }}>+1 tour</button>
                : <button type="button" aria-label="Suivant" onClick={() => act(e.skip)}><SkipForward /></button>}
              {c.m === "ch"
                ? <button type="button" onClick={() => act(e.skip)}>{st.k === "prep" ? "Passer" : "Stop"}</button>
                : <button type="button" onClick={() => { e.plus(10); redraw((x) => x + 1); }}>+10 s</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
