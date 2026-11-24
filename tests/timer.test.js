import { describe as d, it, expect } from "vitest";
import { PRESETS, DEFAULTS, steps, total, normalizeConfig, parseShare, shareQuery, bump, setField, fmt, normalizeData, mergeData } from "../lib/timer";
import { createEngine } from "../lib/timerEngine";

d("modèle", () => {
  it("tabata : 8 efforts, pas de repos final, 3:50", () => {
    const c = PRESETS[0].c;
    expect(steps(c).length).toBe(15);
    expect(fmt(total(c))).toBe("3:50");
  });
  it("pyramide symétrique", () => {
    expect(steps({ m: "py", min: 20, max: 50, inc: 10, rest: 0 }).map((s) => s.d)).toEqual([20, 30, 40, 50, 40, 30, 20]);
    expect(setField(DEFAULTS.py, "max", 10).min).toBe(9);
  });
  it("tous les programmes sont déjà normalisés et partageables", () => {
    for (const p of PRESETS) {
      expect(normalizeConfig(p.c)).toEqual(p.c);
      expect(parseShare(shareQuery(p.name, p.c))).toEqual({ name: p.name, c: p.c });
    }
  });
  it("temps avant le départ propre au timer", () => {
    for (const prep of [0, 15]) {
      const c = { ...DEFAULTS.ti, prep };
      expect(parseShare(shareQuery("X", c)).c).toEqual(c);
      expect(setField(c, "dur", 60).prep).toBe(prep);
      expect(normalizeData({ mine: [{ id: "a", name: "X", c }] }).mine[0].c).toEqual(c);
    }
    for (const prep of [undefined, null, "", "x", 7]) expect("prep" in normalizeConfig({ ...DEFAULTS.ti, prep })).toBe(false);
  });
  it("lien invalide ou excessif", () => {
    expect(parseShare("t=constructor-1")).toBe(null);
    expect(parseShare("t=xx-1")).toBe(null);
    expect(parseShare("t=iv-999999-x-9999-9999-1").c).toEqual({ m: "iv", work: 7200, rest: 15, rounds: 99, sets: 20, setRest: 1 });
    expect(parseShare("t=ti").c.dur).toBe(300);
  });
  it("pas des boutons", () => {
    const at = (v, dir, big) => bump({ m: "ti", dur: v }, "dur", dir, big).dur;
    expect([at(59, 1), at(60, -1), at(60, 1), at(300, 1), at(1200, 1), at(1200, -1), at(45, 1, true), at(1, -1)]).toEqual([60, 59, 65, 310, 1230, 1190, 50, 1]);
  });
  it("fusion et nettoyage des données", () => {
    const t = (id) => ({ id, name: "T " + id, c: DEFAULTS.ti });
    expect(mergeData({ mine: [t("a"), t("b")], favs: ["tabata"] }, { mine: [t("a")], favs: ["tabata", "n44", "zz"] })).toEqual({ mine: [t("a"), t("b")], favs: ["tabata", "n44"] });
    expect(normalizeData({ mine: [{ id: 1, name: "", c: {} }, null] })).toEqual({ mine: [], favs: [] });
  });
});

d("moteur", () => {
  const c = { m: "iv", work: 10, rest: 5, rounds: 2, sets: 1, setRest: 0 };
  const run = (e, dt, n) => { const o = []; for (let i = 0; i < n; i++) o.push(...e.advance(dt).map((x) => x.t)); return o; };
  it("préparation, 3-2-1, étapes, fin", () => {
    const e = createEngine(c, { prep: 5, half: true });
    const o = run(e, 0.1, 305);
    expect(o.filter((x) => x === "step").length).toBe(3);
    expect(o.filter((x) => x === "tick").length).toBe(12);
    expect(o.filter((x) => x === "half").length).toBe(2);
    expect(o.at(-1)).toBe("end");
    expect(e.acc).toBeCloseTo(25, 3);
  });
  it("longue absence : on retombe au bon endroit", () => {
    const e = createEngine(c);
    expect(e.advance(17).map((x) => x.t)).toEqual(["step"]);
    expect([e.i, Math.round(e.el)]).toEqual([2, 2]);
    expect(e.advance(999).map((x) => x.t)).toEqual(["end"]);
  });
  it("chrono libre, tours, stop", () => {
    const e = createEngine({ m: "ch", limit: 0 });
    e.advance(30); e.lap(); e.advance(12); e.lap();
    expect(e.laps.map(Math.round)).toEqual([30, 12]);
    expect(e.skip()).toEqual([{ t: "end" }]);
  });
  it("+10 s, précédent", () => {
    const e = createEngine(c);
    e.plus(); e.advance(15);
    expect(e.i).toBe(0);
    e.advance(6); e.prev();
    expect(e.i).toBe(0);
  });
});
