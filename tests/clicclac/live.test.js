// Clic-Clac : état de l'écran live piloté par la télécommande
import { describe, it, expect, vi } from "vitest";

const kv = new Map();
const sb = {
  from: () => ({
    select: () => ({ eq: (_, k) => ({ maybeSingle: async () => ({ data: kv.has(k) ? { value: kv.get(k) } : null, error: null }) }) }),
    upsert: async ({ key, value }) => { kv.set(key, value); return { error: null }; },
    delete: () => ({ eq: async (_, k) => { kv.delete(k); return { error: null }; } }),
  }),
};
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => sb }));
const { readLive, updateLive, touchScreen, activeScreens } = await import("@/lib/clicclac/live");
const { normalizeLive } = await import("@/lib/clicclac/settings");

describe("écran live", () => {
  it("état vide par défaut", async () => {
    expect(await readLive("a")).toMatchObject({ rev: 0, cfg: null, paused: false, seq: { anchor: 0, pos: 0, front: [] } });
  });
  it("réglages fusionnés et nettoyés", async () => {
    await updateLive("a", { cfg: { layout: "mosaic", speed: 999 } });
    const st = await updateLive("a", { cfg: { qr: false } });
    expect(st.cfg).toMatchObject({ layout: "mosaic", speed: 5, qr: false });
    expect(st.rev).toBe(2);
  });
  it("actions : affichage, nouvelle photo (retenue pendant la pause), retrait", async () => {
    const shown = await updateLive("b", { action: { type: "show", photo: { id: "p1", full: "u" } } });
    expect(shown.seq.front[0].id).toBe("p1");
    expect(shown.seq.anchor).toBeGreaterThan(0);
    await updateLive("b", { paused: true });
    const fresh = await updateLive("b", { action: { type: "fresh", photo: { id: "n1" } } });
    expect(fresh.seq.front.map((p) => p.id)).not.toContain("n1"); // pas pendant la pause
    expect(fresh.later.map((p) => p.id)).toEqual(["n1"]);
    const resumed = await updateLive("b", { paused: false });
    expect(resumed.seq.front[0]).toMatchObject({ id: "n1", fresh: true }); // montrée à la reprise
    const dropped = await updateLive("b", { action: { type: "drop", id: "n1" } });
    expect(dropped.seq.front.map((p) => p.id)).not.toContain("n1");
    expect(dropped.dropped).toContain("n1");
  });
  it("écrans : présence et accusé de réception, sans toucher aux commandes", async () => {
    const before = await updateLive("c", { paused: true });
    await touchScreen("c", "ecran1", { ack: before.rev, tv: true });
    await touchScreen("c", "ecran2", { ack: 0, tv: false });
    const list = await activeScreens("c");
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.tv).ack).toBe(before.rev);
    expect(await readLive("c")).toMatchObject({ paused: true, rev: before.rev }); // état intact
  });
  it("normalizeLive garde les valeurs connues", () => {
    expect(normalizeLive({ layout: "wall", order: "x", captions: false })).toMatchObject({ layout: "wall", order: "recent", captions: false });
  });
});

describe("réglages par défaut", async () => {
  const { LIVE_DEFAULTS, LIVE_SPEEDS, LIVE_QR_SIZES } = await import("@/lib/clicclac/settings");
  it("la durée par défaut fait partie des choix proposés", () => {
    expect(LIVE_SPEEDS).toContain(LIVE_DEFAULTS.speed);
    expect(LIVE_QR_SIZES.map(([k]) => k)).toContain(LIVE_DEFAULTS.qrSize);
  });
});
