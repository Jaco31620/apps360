// Ami Invisible v2 : tirage, interdictions, liste collée, nettoyage, textes
import { describe, it, expect } from "vitest";
import {
  drawPairs, bannedEdges, parseList, cleanPerson, cleanCarnet, cleanExclusions, cleanOptions, fillMessage,
  drawProblem, defaultTemplate, isDefaultTemplate, texts, identityOf,
} from "@/lib/amiInvisible";

const people = (n) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, prenom: `P${i}`, nom: "X", email: `p${i}@ex.fr` }));
const valid = (r, banned = []) => {
  const ban = new Set(banned.map(([a, b]) => `${a}>${b}`));
  return r.every((x, i) => x !== i && !ban.has(`${i}>${x}`)) && new Set(r).size === r.length;
};

describe("tirage", () => {
  it("personne ne s'offre à soi-même, chacun reçoit une fois", () => {
    for (let k = 0; k < 50; k++) expect(valid(drawPairs(7))).toBe(true);
  });
  it("exclusion réciproque ou non", () => {
    const p = people(4);
    const both = bannedEdges(p, [{ from: "k0", to: "k1", both: true }]);
    expect(both).toEqual([[0, 1], [1, 0]]);
    const one = bannedEdges(p, [{ from: "k0", to: "k1", both: false }]);
    expect(one).toEqual([[0, 1]]);
    for (let k = 0; k < 30; k++) { const r = drawPairs(4, both); expect(valid(r, both)).toBe(true); }
  });
  it("évite les paires d'un ancien tirage (par e-mail, sinon par nom)", () => {
    const p = people(3);
    p[2] = { ...p[2], email: "nouvelle@ex.fr" }; // a changé d'adresse : reconnue par son nom
    const avoid = [
      { giver: [identityOf({ email: "p0@ex.fr" })], receiver: [identityOf({ email: "p1@ex.fr" })] },
      { giver: ["e:ancienne@ex.fr", "n:p2 x"], receiver: [identityOf({ email: "p0@ex.fr" })] },
    ];
    const banned = bannedEdges(p, [], avoid);
    expect(banned).toEqual([[0, 1], [2, 0]]);
    // une seule solution possible : 0→2, 1→0, 2→1
    for (let k = 0; k < 20; k++) expect(drawPairs(3, banned)).toEqual([2, 0, 1]);
  });
  it("trouve la seule solution quand les contraintes sont serrées", () => {
    const banned = [];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (a !== b && b !== (a + 1) % 5) banned.push([a, b]);
    expect(drawPairs(5, banned)).toEqual([1, 2, 3, 4, 0]);
  });
  it("impossible → null", () => {
    expect(drawPairs(2, [[0, 1]])).toBe(null);
    expect(drawPairs(1)).toBe(null);
  });
});

describe("liste collée", () => {
  it("reconnaît prénom, nom, e-mail, séparateurs variés", () => {
    const r = parseList("Sophie Martin sophie@ex.fr\nPaul;paul@ex.fr\n\"Jean Pierre Durand\" <JP@Ex.fr>\nsans adresse\n");
    expect(r.people).toEqual([
      { prenom: "Sophie", nom: "Martin", email: "sophie@ex.fr" },
      { prenom: "Paul", nom: "", email: "paul@ex.fr" },
      { prenom: "Jean", nom: "Pierre Durand", email: "jp@ex.fr" },
    ]);
    expect(r.rejected).toEqual(["sans adresse"]);
  });
});

describe("données", () => {
  it("participant : prénom et e-mail valide requis", () => {
    expect(cleanPerson({ key: "a", prenom: "A", email: "x" })).toBe(null);
    expect(cleanPerson({ key: "a", prenom: " A ", nom: "B", email: "A@B.FR", tel: "06" })).toEqual({ key: "a", prenom: "A", nom: "B", email: "a@b.fr" });
  });
  it("carnet sans doublons ; exclusions sur des participants existants", () => {
    expect(cleanCarnet([...people(2), { ...people(1)[0], key: "z" }])).toHaveLength(2);
    expect(cleanExclusions([{ from: "k0", to: "k1" }, { from: "k0", to: "zz" }, { from: "k1", to: "k1" }], ["k0", "k1"]))
      .toEqual([{ from: "k0", to: "k1", both: true }]);
  });
  it("options par défaut : tutoiement, l'organisateur participe, pas de liste de souhaits", () => {
    expect(cleanOptions({})).toMatchObject({ tone: "tu", organizerPlays: true, wishlist: false, date: "" });
    expect(cleanOptions({ tone: "vous", date: "24/12" })).toMatchObject({ tone: "vous", date: "" });
  });
  it("contrôles avant tirage", () => {
    expect(drawProblem("", people(3))).toMatch(/nom/);
    expect(drawProblem("N", people(1))).toMatch(/2 participants/);
    expect(drawProblem("N", [...people(2), { key: "z", prenom: "Z", email: "p0@ex.fr" }])).toMatch(/deux fois/);
    expect(drawProblem("N", people(3))).toBe(null);
  });
});

describe("messages", () => {
  it("variables remplacées partout ; message par défaut selon le ton", () => {
    expect(fillMessage("{prenom_offreur} {prenom_offreur} → {prenom_receveur}", { prenom: "A" }, { prenom: "B" })).toBe("A A → B");
    expect(defaultTemplate("vous")).toMatch(/Vous offrez/);
    expect(defaultTemplate("tu")).toMatch(/Tu offres/);
    expect(isDefaultTemplate(defaultTemplate("vous"))).toBe(true);
    expect(isDefaultTemplate("autre")).toBe(false);
  });
  it("textes participants : tutoiement / vouvoiement", () => {
    expect(texts("tu").discover).toMatch(/Découvre à qui tu/);
    expect(texts("vous").discover).toMatch(/Découvrez à qui vous/);
    expect(texts("vous").privacy("Sophie")).toMatch(/Vos coordonnées ont été saisies par Sophie/);
  });
});

import { buildLinkMail, defaultMailText, DEFAULT_SUBJECT, wishlistExpired } from "@/lib/amiInvisible";

describe("e-mail personnalisable", () => {
  const t = { name: "Noël 2026", options: cleanOptions({ tone: "vous", organizerName: "Sophie" }) };
  const p = { prenom: "Paul", nom: "D" };
  it("texte par défaut : ton, organisateur, variables", () => {
    const m = buildLinkMail(t, p, "https://x/p/abc");
    expect(m.subject).toBe("🎁 Ami Invisible : Noël 2026");
    expect(m.text).toContain("Bonjour Paul,");
    expect(m.text).toContain("organisé par Sophie");
    expect(m.text).toContain("Découvrez");
    expect(m.html).toContain("https://x/p/abc?supprimer=1");
    expect(m.html).toContain("/ami-invisible/confidentialite");
  });
  it("texte personnalisé échappé, défaut ramené à vide", () => {
    const o = cleanOptions({ ...t.options, mailSubject: "Coucou {prenom}", mailText: "Salut {prenom} <b>!</b>\n\nÀ {tirage}" });
    const m = buildLinkMail({ ...t, options: o }, p, "https://x/p/abc");
    expect(m.subject).toBe("Coucou Paul");
    expect(m.html).toContain("Salut Paul &lt;b&gt;!&lt;/b&gt;");
    expect(m.html).toContain("À Noël 2026");
    expect(m.html).toContain("https://x/p/abc"); // le lien est toujours là
    const d = cleanOptions({ ...t.options, mailSubject: DEFAULT_SUBJECT, mailText: defaultMailText(t.options) });
    expect(d.mailSubject).toBe("");
    expect(d.mailText).toBe("");
  });
});

describe("listes de souhaits : fin", () => {
  it("1 mois après la date, sinon 3 mois après le tirage", () => {
    expect(wishlistExpired({ date: "2026-12-24" }, null, new Date("2027-01-20"))).toBe(false);
    expect(wishlistExpired({ date: "2026-12-24" }, null, new Date("2027-01-26"))).toBe(true);
    expect(wishlistExpired({}, "2026-11-01T10:00:00Z", new Date("2027-01-15"))).toBe(false);
    expect(wishlistExpired({}, "2026-11-01T10:00:00Z", new Date("2027-02-02"))).toBe(true);
  });
});

import { relayMessage } from "@/lib/amiInvisible";
describe("message « Envoyer autrement »", () => {
  it("ton, organisateur facultatif, lien présent", () => {
    const a = relayMessage({ name: "Noël", options: { tone: "tu", organizerName: "Sophie" } }, { prenom: "Paul" }, "https://x/p/a");
    expect(a).toBe("Bonjour Paul, c'est Sophie 🎁\nVoici ton lien pour le tirage « Noël » :\nhttps://x/p/a\nIl est personnel : ne le transfère pas.");
    const b = relayMessage({ name: "Noël", options: { tone: "vous" } }, { prenom: "Paul" }, "https://x/p/a");
    expect(b).toContain("Bonjour Paul 🎁");
    expect(b).toContain("votre lien");
  });
});
