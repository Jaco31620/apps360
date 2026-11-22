import { describe, it, expect } from "vitest";
import { normalizeDefaults, GUEST_SEARCH_MAX } from "@/lib/jukebox";
import { publicSession, regieOptions } from "@/lib/jukeboxServer";

describe("option « Nouveaux titres » des invités", () => {
  it("activée par défaut (nouvelles soirées et réglages enregistrés avant l'option)", () => {
    expect(normalizeDefaults(undefined).guestSearch).toBe(true);
    expect(normalizeDefaults({ catalog: true }).guestSearch).toBe(true);
    expect(publicSession({ code: "123456", options: {} }).guestSearch).toBe(true);
  });
  it("coupée quand la régie la coupe", () => {
    expect(normalizeDefaults({ guestSearch: false }).guestSearch).toBe(false);
    expect(regieOptions({ guestSearch: false }).guestSearch).toBe(false);
    expect(publicSession({ code: "123456", options: { guestSearch: false } }).guestSearch).toBe(false);
  });
  it("réserve de quota : 90 recherches", () => {
    expect(GUEST_SEARCH_MAX).toBe(90);
  });
});

describe("soirée limitée au catalogue (fonction « search » du super-admin)", () => {
  it("ouverte par défaut, coupée seulement explicitement", async () => {
    const { normalizeFeatures, DEFAULT_FEATURES } = await import("@/lib/jukebox");
    const { catalogOnly, publicSession } = await import("@/lib/jukeboxServer");
    expect(DEFAULT_FEATURES.search).toBe(true);
    expect(normalizeFeatures({ history: true }).search).toBe(true); // anciennes soirées
    expect(catalogOnly(publicSession({ code: "123456", options: {} }))).toBe(false);
    expect(catalogOnly(publicSession({ code: "123456", options: { features: { search: false } } }))).toBe(true);
  });
});
