"use client";
/*
 * Choix d'une durée avec deux molettes (minutes, secondes). Les secondes ne
 * s'arrêtent que sur les multiples de 5 : la molette tombe juste d'emblée, sans
 * correction après coup. « À la seconde près » affiche les 60 valeurs.
 */
import { useEffect, useRef, useState } from "react";
import s from "./timer.module.css";
import { buzz } from "./audio";

const H = 44;
const range = (n, step = 1) => Array.from({ length: Math.ceil(n / step) }, (_, i) => i * step);
const MIN = range(121), SEC5 = range(60, 5), SEC1 = range(60);

function Wheel({ label, values, value, onChange, loop = false }) {
  const ref = useRef(null), last = useRef(-1), timer = useRef(null);
  const copies = loop ? 5 : 1, n = values.length, mid = loop ? 2 * n : 0;
  const [cur, setCur] = useState(mid + Math.max(0, values.indexOf(value)));
  useEffect(() => {
    const i = mid + Math.max(0, values.indexOf(value));
    last.current = i;
    setCur(i);
    ref.current.scrollTop = i * H;
    return () => clearTimeout(timer.current);
    // une seule fois : ensuite c'est la molette qui commande
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);
  const onScroll = () => {
    const i = Math.max(0, Math.min(n * copies - 1, Math.round(ref.current.scrollTop / H)));
    if (i !== last.current) { last.current = i; setCur(i); buzz(8); onChange(values[i % n]); }
    if (!loop) return;
    // à l'arrêt, retour discret au milieu pour pouvoir tourner sans fin
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const c = mid + (last.current % n);
      if (ref.current && Math.abs(c - last.current) >= n) { last.current = c; setCur(c); ref.current.scrollTop = c * H; }
    }, 250);
  };
  return (
    <div ref={ref} className={s.wheel} tabIndex={0} role="spinbutton" aria-label={label} aria-valuenow={values[cur % n]} onScroll={onScroll}
      onKeyDown={(e) => { const d = { ArrowUp: -1, ArrowDown: 1 }[e.key]; if (d) { e.preventDefault(); ref.current.scrollTop = (last.current + d) * H; } }}>
      {range(n * copies).map((i) => (
        <div key={i} className={`${s.item} ${i === cur ? s.on : ""}`} onClick={() => ref.current.scrollTo({ top: i * H, behavior: "smooth" })}>
          {String(values[i % n]).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}

export default function TimePicker({ label, value, onOk, onClose }) {
  const [m, setM] = useState(Math.floor(value / 60));
  const [sec, setSec] = useState(value % 60);
  const [fine, setFine] = useState(value % 5 !== 0);
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
          <Wheel label="Minutes" values={MIN} value={m} onChange={setM} />
          <span className="relative text-gray-600">min</span>
          <Wheel label="Secondes" values={fine ? SEC1 : SEC5} value={sec} onChange={setSec} loop />
          <span className="relative text-gray-600">s</span>
        </div>
        <label className="flex items-center justify-center gap-2 text-sm text-gray-600 min-h-[40px]">
          <input type="checkbox" className="w-5 h-5 accent-brand-orange" checked={fine}
            onChange={(e) => { if (!e.target.checked) setSec((x) => Math.min(55, Math.round(x / 5) * 5)); setFine(e.target.checked); }} />
          À la seconde près
        </label>
        <button type="button" onClick={() => onOk(m * 60 + sec)} className="w-full bg-brand-orange hover:bg-brand-orange-dark text-brand-navy-dark font-extrabold text-xl rounded-full py-3.5">Valider</button>
      </div>
    </div>
  );
}
