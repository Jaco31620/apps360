// Ami Invisible : tirage, nettoyage, vue organisateur sans les paires
import { describe, it, expect } from "vitest";
import { drawPairs, cleanPerson, cleanCarnet, fillMessage, publicTirage, sendSummary } from "@/lib/amiInvisible";

const people = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, prenom: `P${i + 1}`, nom: "X", email: `p${i + 1}@ex.fr` }));

describe("tirage", () => {
  it("personne ne s'offre à soi-même, chacun reçoit une fois", () => {
    for (let k = 0; k < 50; k++) {
      const r = drawPairs(people(7));
      expect(r.every((x, i) => x !== i)).toBe(true);
      expect(new Set(r).size).toBe(7);
    }
  });
  it("respecte les exclusions (ids en texte comme dans les listes)", () => {
    const p = people(4);
    const ex = [{ from: "1", to: "2" }, { from: "1", to: "3" }, { from: "2", to: "1" }];
    for (let k = 0; k < 30; k++) {
      const r = drawPairs(p, ex);
      expect(r[0]).toBe(3);
      expect(r[1]).not.toBe(0);
    }
  });
  it("trouve la seule solution possible quand les exclusions sont serrées", () => {
    const p = people(5); // impose le cycle 1→2→3→4→5→1
    const ex = [];
    for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) if (a !== b && b !== (a % 5) + 1) ex.push({ from: a, to: b });
    expect(drawPairs(p, ex)).toEqual([1, 2, 3, 4, 0]);
  });
  it("impossible → null", () => {
    expect(drawPairs(people(2), [{ from: 1, to: 2 }])).toBe(null);
    expect(drawPairs(people(1))).toBe(null);
  });
});

describe("données", () => {
  it("participant : e-mail valide et prénom requis", () => {
    expect(cleanPerson({ id: 1, prenom: "A", email: "x" })).toBe(null);
    expect(cleanPerson({ id: 1, prenom: "", email: "a@b.fr" })).toBe(null);
    expect(cleanPerson({ id: 1, prenom: " A ", nom: "B", email: "A@B.FR" })).toEqual({ id: 1, prenom: "A", nom: "B", email: "a@b.fr", tel: "" });
  });
  it("carnet : doublons d'e-mail retirés", () => {
    expect(cleanCarnet([...people(2), { ...people(1)[0], id: 9 }])).toHaveLength(2);
  });
  it("message : toutes les occurrences remplacées", () => {
    expect(fillMessage("{prenom_offreur} {prenom_offreur} → {prenom_receveur}", { prenom: "A" }, { prenom: "B" })).toBe("A A → B");
  });
  it("vue organisateur : ni receveur ni message", () => {
    const [a, b] = people(2);
    const t = { v: 2, id: 1, eventName: "N", date: "2026-11-23", template: "x", pairs: [{ offreur: a, receveur: b, sentAt: "2026-11-23T10:00:00Z", sends: 1 }, { offreur: b, receveur: a, message: "secret" }] };
    const v = publicTirage(t);
    expect(JSON.stringify(v)).not.toContain("secret");
    expect(v.participants.map((p) => p.prenom)).toEqual(["P1", "P2"]);
    expect(v.participants[0]).not.toHaveProperty("receveur");
    expect(v.tracked).toBe(true);
    expect(sendSummary(t)).toEqual({ total: 2, sent: 1, lastSentAt: "2026-11-23T10:00:00Z" });
  });
});
