import { describe, it, expect } from "vitest";
import { applyHome, cleanHome } from "../lib/homeConfig";

const apps = [{ href: "/a", state: "public", badge: "Gratuit" }, { href: "/b", state: "test", badge: "Gratuit" }, { href: "/c" }];
describe("page d'accueil", () => {
  it("sans réglage : ordre et états du code, nouvelle app en test", () => {
    expect(applyHome(apps, null).map((a) => [a.href, a.state])).toEqual([["/a", "public"], ["/b", "test"], ["/c", "test"]]);
  });
  it("réglage appliqué, app inconnue du réglage à la fin et en test", () => {
    const r = applyHome(apps, { order: ["/b", "/a", "/old"], apps: { "/b": { state: "public", badge: "" }, "/a": { state: "zzz", badge: "x" } } });
    expect(r.map((a) => [a.href, a.state, a.badge])).toEqual([["/b", "public", ""], ["/a", "public", "Gratuit"], ["/c", "test", ""]]);
  });
  it("enregistrement : liste complète et valide seulement", () => {
    const ok = apps.map((a) => ({ href: a.href, state: "public", badge: "" }));
    expect(cleanHome(apps, ok).order).toEqual(["/a", "/b", "/c"]);
    expect(cleanHome(apps, ok.slice(1))).toBe(null);
    expect(cleanHome(apps, [ok[0], ok[0], ok[1]])).toBe(null);
    expect(cleanHome(apps, [{ ...ok[0], state: "x" }, ok[1], ok[2]])).toBe(null);
  });
});
