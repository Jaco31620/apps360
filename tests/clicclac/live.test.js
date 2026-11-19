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
    expect(await readLive("a")).toMatchObject({ rev: 0, cfg: null, paused: false, cmd: { seq: 0 } });
  });
  it("réglages fusionnés et nettoyés", async () => {
    await updateLive("a", { cfg: { layout: "mosaic", speed: 999 } });
    const st = await updateLive("a", { cfg: { qr: false } });
    expect(st.cfg).toMatchObject({ layout: "mosaic", speed: 5, qr: false });
    expect(st.rev).toBe(2);
  });
  it("commandes numérotées, photo transmise pour « show »", async () => {
    const a = await updateLive("b", { cmd: { type: "next" } });
    const b = await updateLive("b", { cmd: { type: "show", photo: { id: "p1", full: "u" } } });
    expect([a.cmd.seq, b.cmd.seq]).toEqual([1, 2]);
    expect(b.cmd).toMatchObject({ type: "show", photo: { id: "p1" } });
    expect((await updateLive("b", { cmd: { type: "hack" } })).cmd.seq).toBe(2);
    expect((await updateLive("b", { cmd: { type: "show" } })).cmd.seq).toBe(2); // « show » sans photo ignoré
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
