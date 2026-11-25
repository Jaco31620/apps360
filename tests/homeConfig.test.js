import { describe, it, expect } from "vitest";
import { applyHome, cleanHome, cleanTag, activeTag } from "../lib/homeConfig";

const apps = [{ href: "/a", state: "public", access: "free", tag: { text: "Noël", color: "red", to: "2026-12-25" } }, { href: "/b", state: "test", access: "request" }, { href: "/c" }];
describe("page d'accueil", () => {
  it("sans réglage : valeurs du code, nouvelle app en test", () => {
    expect(applyHome(apps, null).map((a) => [a.href, a.state, a.access, a.tag?.text])).toEqual([["/a", "public", "free", "Noël"], ["/b", "test", "request", undefined], ["/c", "test", "free", undefined]]);
  });
  it("réglage appliqué ; accroche retirée ; app inconnue à la fin", () => {
    const r = applyHome(apps, { order: ["/b", "/a"], apps: { "/b": { state: "public", access: "free", tag: { text: "Bêta", color: "teal" } }, "/a": { state: "zzz", tag: null } } });
    expect(r.map((a) => [a.href, a.state, a.access, a.tag?.text])).toEqual([["/b", "public", "free", "Bêta"], ["/a", "public", "free", undefined], ["/c", "test", "free", undefined]]);
  });
  it("ancien format (étiquette) : Nouveau devient l'accroche, le reste est ignoré", () => {
    const r = applyHome(apps, { apps: { "/a": { badge: "Gratuit" }, "/b": { badge: "Nouveau" } } });
    expect(r.map((a) => [a.access, a.tag?.text])).toEqual([["free", "Noël"], ["request", "Nouveau"], ["free", undefined]]);
  });
  it("accroche : longueur, couleur, dates comprises", () => {
    expect(cleanTag({ text: "  " })).toBe(null);
    expect([...cleanTag({ text: "🎄".repeat(40), color: "x" }).text].length).toBe(24);
    const t = cleanTag({ text: "x", from: "2026-11-25", to: "2026-12-25" });
    expect(["2026-11-24", "2026-11-25", "2026-12-25", "2026-12-26"].map((d) => !!activeTag(t, d))).toEqual([false, true, true, false]);
  });
  it("enregistrement : liste complète et valide seulement", () => {
    const ok = apps.map((a) => ({ href: a.href, state: "public", access: "free", tag: null }));
    expect(cleanHome(apps, ok).order).toEqual(["/a", "/b", "/c"]);
    expect(cleanHome(apps, ok.slice(1))).toBe(null);
    expect(cleanHome(apps, [ok[0], ok[0], ok[1]])).toBe(null);
    expect(cleanHome(apps, [{ ...ok[0], access: "x" }, ok[1], ok[2]])).toBe(null);
    expect(cleanHome(apps, [{ ...ok[0], tag: { text: "a", from: "2026-12-02", to: "2026-12-01" } }, ok[1], ok[2]])).toBe(null);
  });
});
