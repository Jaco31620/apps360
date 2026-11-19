// Clic-Clac : diaporama synchronisé entre écrans (programme commun)
import { describe, it, expect } from "vitest";
import { photoAt, rebase, applySeq, orderedList } from "@/lib/clicclac/liveSeq";

const list = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })); // plus récentes d'abord
const cfg = { speed: 5, order: "recent" };
const at = (state, t) => photoAt(state, list, t).photo?.id;

describe("programme commun", () => {
  it("deux écrans au même instant → même photo ; créneaux de 5 s", () => {
    const st = { cfg, seq: { anchor: 1000, pos: 0, front: [], seed: 1 } };
    expect(at(st, 1000)).toBe("p0");
    expect(at(st, 5999)).toBe("p0");
    expect(at(st, 6000)).toBe("p1");
    expect(at(st, 1000 + 5000 * 12)).toBe("p2"); // boucle
  });
  it("file prioritaire d'abord, puis reprise de la liste", () => {
    const st = { cfg, seq: { anchor: 0, pos: 3, front: [{ id: "n1", fresh: true }, { id: "n2" }], seed: 1 } };
    expect(photoAt(st, list, 0)).toMatchObject({ photo: { id: "n1" }, fresh: true });
    expect(at(st, 5000)).toBe("n2");
    expect(at(st, 10000)).toBe("p3");
  });
  it("pause : figé, quel que soit le temps", () => {
    const st = { cfg, paused: true, seq: { anchor: null, pos: 4, front: [], seed: 1 } };
    expect(at(st, 0)).toBe("p4");
    expect(at(st, 9e9)).toBe("p4");
    expect(photoAt(st, list, 0).until).toBe(Infinity);
  });
  it("rebase fige la position, next/prev/show/drop", () => {
    const st = { cfg, seq: { anchor: 0, pos: 0, front: [{ id: "x" }], seed: 1 } };
    const now = 12000; // créneau 2 : x (0), p0 (1), p1 (2)
    const b = rebase(st, now);
    expect(b).toMatchObject({ front: [], pos: 1 });
    expect(applySeq(b, { type: "next" }).pos).toBe(2);
    expect(applySeq(b, { type: "prev" }).pos).toBe(0);
    const shown = applySeq(b, { type: "show", photo: { id: "p7" } });
    expect(at({ cfg, seq: { ...shown, anchor: now } }, now)).toBe("p7");
    expect(applySeq(shown, { type: "drop", id: "p7" }).front).toEqual([]);
  });
  it("photo retirée : sautée tout de suite", () => {
    const st = { cfg, dropped: ["p0"], seq: { anchor: 0, pos: 0, front: [], seed: 1 } };
    expect(at(st, 0)).toBe("p1");
  });
  it("aléatoire : même tirage pour une même graine, quel que soit l'ordre reçu", () => {
    const a = orderedList(list, { order: "random" }, 42).map((p) => p.id);
    const b = orderedList([...list].reverse(), { order: "random" }, 42).map((p) => p.id);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(list.map((p) => p.id).sort());
  });
});
