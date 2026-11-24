"use client";
/*
 * Choix d'une durée avec deux molettes (minutes, secondes). Inertie maison : la
 * destination est décidée au relâcher (lib/timer landing), sans correction après
 * coup. Un élan vise les secondes rondes, un petit geste la seconde précise.
 */
import { useEffect, useRef, useState } from "react";
import { GLIDE, MAGNETS, landing } from "@/lib/timer";
import s from "./timer.module.css";
import { buzz } from "./audio";

const H = 44;
const MIN = 121, SEC = 60;

function Wheel({ label, n, value, onChange, loop = false, magnets }) {
  const ref = useRef(null);
  const [cur, setCur] = useState(value);
  // pos : position continue (en crans) ; en boucle elle n'est pas bornée
  const g = useRef({ pos: value, shown: value, raf: 0, drag: null, dest: value }).current;
  const mod = (x) => ((x % n) + n) % n;
  const clamp = (x) => (loop ? x : Math.max(0, Math.min(n - 1, x)));
  const change = useRef(onChange);
  change.current = onChange;

  const place = (x) => {
    g.pos = clamp(x);
    ref.current.scrollTop = (loop ? n + mod(g.pos) : g.pos) * H;
    const v = mod(Math.round(g.pos));
    if (v !== g.shown) { g.shown = v; setCur(v); buzz(8); }
  };
  const stop = () => { cancelAnimationFrame(g.raf); g.raf = 0; };
  const glide = (to, tau = GLIDE) => {
    stop();
    const dest = clamp(to), from = g.pos, t0 = performance.now();
    g.dest = dest;
    change.current(mod(dest)); // valeur connue tout de suite, même si on valide pendant l'élan
    const frame = (now) => {
      const left = (dest - from) * Math.exp(-Math.max(0, now - t0) / 1000 / tau);
      if (Math.abs(left) < 0.02) { g.raf = 0; place(dest); return; }
      place(dest - left);
      g.raf = requestAnimationFrame(frame);
    };
    g.raf = requestAnimationFrame(frame);
  };
  const step = (d) => glide((g.raf ? g.dest : Math.round(g.pos)) + d, 0.06);

  useEffect(() => {
    const el = ref.current;
    place(g.pos);
    let acc = 0;
    const wheel = (e) => {
      e.preventDefault();
      acc += e.deltaMode ? e.deltaY * 33 : e.deltaY;
      const d = Math.trunc(acc / 50);
      if (d) { acc -= d * 50; step(d); }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = (e) => {
    if (e.button || g.drag) return;
    const moving = !!g.raf;
    stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    g.drag = { id: e.pointerId, y: e.clientY, pos: g.pos, moving, moved: false, pts: [[e.timeStamp, e.clientY]] };
  };
  const move = (e) => {
    const d = g.drag;
    if (d?.id !== e.pointerId) return;
    if (Math.abs(e.clientY - d.y) > 6) d.moved = true;
    d.pts = [...d.pts.filter(([t]) => e.timeStamp - t < 100), [e.timeStamp, e.clientY]];
    place(d.pos + (d.y - e.clientY) / H);
  };
  const up = (e) => {
    const d = g.drag;
    if (d?.id !== e.pointerId) return;
    g.drag = null;
    if (!d.moved) {
      // appui : on va à la valeur touchée, ou on arrête la molette qui tourne
      const r = ref.current.getBoundingClientRect();
      const off = d.moving || e.type !== "pointerup" ? 0 : Math.round((e.clientY - r.top - r.height / 2) / H);
      return glide(Math.round(g.pos) + off, 0.08);
    }
    const pts = d.pts.filter(([t]) => e.timeStamp - t < 100), [t, y] = pts[0] || [e.timeStamp, e.clientY];
    const v = e.timeStamp - t > 8 ? (y - e.clientY) / H / ((e.timeStamp - t) / 1000) : 0;
    const to = landing(g.pos, v, n, magnets);
    glide(to, Math.abs(to - g.pos) < 1 ? 0.08 : GLIDE);
  };
  return (
    <div ref={ref} className={s.wheel} tabIndex={0} role="spinbutton" aria-label={label} aria-valuenow={cur} aria-valuemin={0} aria-valuemax={n - 1}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { const d = { ArrowUp: -1, ArrowDown: 1 }[e.key]; if (d) { e.preventDefault(); step(d); } }}>
      {Array.from({ length: loop ? 3 * n : n }, (_, i) => (
        <div key={i} className={`${s.item} ${i % n === cur ? s.on : ""}`}>{String(i % n).padStart(2, "0")}</div>
      ))}
    </div>
  );
}

export default function TimePicker({ label, value, onOk, onClose }) {
  const [m, setM] = useState(Math.floor(value / 60));
  const [sec, setSec] = useState(value % 60);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 !m-0 z-40 bg-brand-navy-dark/60 flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8 space-y-4 text-brand-navy font-outfit">
        <h2 className="text-lg font-extrabold text-center">{label}</h2>
        <div className={s.wheels}>
          <Wheel label="Minutes" n={MIN} value={m} onChange={setM} />
          <span className="relative text-gray-600">min</span>
          <Wheel label="Secondes" n={SEC} value={sec} onChange={setSec} loop magnets={MAGNETS} />
          <span className="relative text-gray-600">s</span>
        </div>
        <button type="button" onClick={() => onOk(m * 60 + sec)} className="w-full bg-brand-orange hover:bg-brand-orange-dark text-brand-navy-dark font-extrabold text-xl rounded-full py-3.5">Valider</button>
      </div>
    </div>
  );
}
