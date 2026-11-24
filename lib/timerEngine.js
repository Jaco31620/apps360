/*
 * Moteur d'une séance (pur, sans horloge ni son) : advance(dt) avance le temps et
 * renvoie ce qui vient de se passer, dans l'ordre :
 *   { t: "step" } nouvelle étape, "tick" (3-2-1), "half" (mi-effort), "end".
 * Après une longue absence (page en arrière-plan), plusieurs étapes peuvent être
 * franchies d'un coup : seul le dernier changement est annoncé.
 */
import { steps } from "@/lib/timer";

export function createEngine(c, { prep = 0, half = false } = {}) {
  const st = steps(c);
  if (prep) st.unshift({ k: "prep", d: prep });
  const e = { c, st, i: 0, el: 0, acc: 0, laps: [], done: false };
  let sec = null, halfDone = false;
  const enter = (i, el = 0) => { e.i = i; e.el = el; sec = null; halfDone = false; };
  const step = () => e.st[e.i];
  const rem = () => Math.max(0, step().d - e.el);

  e.step = step;
  e.rem = rem;
  e.left = () => e.st.slice(e.i + 1).reduce((a, s) => a + s.d, rem());
  e.advance = (dt) => {
    const ev = [];
    let moved = false;
    while (dt > 0 && !e.done) {
      const s = step(), use = Math.min(dt, s.d - e.el);
      e.el += use;
      dt -= use;
      if (s.k !== "prep") e.acc += use;
      if (e.el >= s.d - 1e-9) {
        if (e.i + 1 >= e.st.length) { e.done = true; ev.length = 0; ev.push({ t: "end" }); return ev; }
        enter(e.i + 1);
        moved = true;
        ev.length = 0;
      }
    }
    if (e.done) return ev;
    const s = step();
    if (moved) ev.push({ t: "step" });
    const now = Math.ceil(s.d - e.el);
    if (now !== sec) {
      sec = now;
      if (now <= 3 && now >= 1 && s.d > 4 && !moved) ev.push({ t: "tick" });
    }
    if (half && !halfDone && s.k === "work" && !s.up && s.d >= 10 && e.el >= s.d / 2) { halfDone = true; ev.push({ t: "half" }); }
    return ev;
  };
  e.skip = () => {
    if (e.done) return [];
    if (e.i + 1 >= e.st.length) { e.done = true; return [{ t: "end" }]; }
    enter(e.i + 1);
    return [{ t: "step" }];
  };
  e.prev = () => { enter(e.el > 2 ? e.i : Math.max(0, e.i - 1)); return [{ t: "step" }]; };
  e.plus = (n = 10) => { step().d += n; };
  e.lap = () => { if (step().k === "work") e.laps.push(e.acc - e.laps.reduce((a, b) => a + b, 0)); };
  return e;
}
