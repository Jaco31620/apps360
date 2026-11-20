import { describe, it, expect } from "vitest";
import { normalizeSettings, DEFAULT_SETTINGS, FRAMES } from "@/lib/clicclac/settings";

describe("cadres : nouveau catalogue", () => {
  it("convertit les anciens cadres vers leur remplaçant", () => {
    const s = normalizeSettings({ frames: ["none", "band", "baroque", "wood", "film"], imposedFrame: "gallery" });
    expect(s.frames).toEqual(["none", "polaroid", "gold", "film"]);
    expect(s.imposedFrame).toBe("gold");
  });
  it("défauts : aucun texte, couleur corail, tous les nouveaux cadres", () => {
    const s = normalizeSettings({});
    expect(s.frameText).toBe("none");
    expect(s.frameAccent).toBe("#ff5a5f");
    expect(s.frames).toEqual(DEFAULT_SETTINGS.frames);
    for (const id of s.frames) expect(FRAMES.some((f) => f.id === id)).toBe(true);
  });
  it("valide texte libre et couleur", () => {
    const s = normalizeSettings({ frameText: "free", frameFreeText: "  Léa & Tom ".repeat(10), frameAccent: "#2B4C9B" });
    expect(s.frameText).toBe("free");
    expect(s.frameFreeText.length).toBeLessThanOrEqual(40);
    expect(s.frameAccent).toBe("#2b4c9b");
    expect(normalizeSettings({ frameText: "titre", frameAccent: "red" })).toMatchObject({ frameText: "none", frameAccent: "#ff5a5f" });
  });
});
