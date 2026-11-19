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
const { readLive, updateLive, touchLive } = await import("@/lib/clicclac/live");
const { normalizeLive } = await import("@/lib/clicclac/settings");

describe("écran live", () => {
  it("état vide par défaut", async () => {
    expect(await readLive("a")).toMatchObject({ rev: 0, cfg: null, paused: false, cmd: { seq: 0 } });
  });
  it("réglages fusionnés et nettoyés", async () => {
    await updateLive("a", { cfg: { layout: "mosaic", speed: 999 } });
    const st = await updateLive("a", { cfg: { qr: false } });
    expect(st.cfg).toMatchObject({ layout: "mosaic", speed: 6, qr: false });
    expect(st.rev).toBe(2);
  });
  it("commandes numérotées, photo transmise pour « show »", async () => {
    const a = await updateLive("b", { cmd: { type: "next" } });
    const b = await updateLive("b", { cmd: { type: "show", photoId: "p1" } });
    expect([a.cmd.seq, b.cmd.seq]).toEqual([1, 2]);
    expect(b.cmd).toMatchObject({ type: "show", photoId: "p1" });
    const c = await updateLive("b", { cmd: { type: "hack" } });
    expect(c.cmd.seq).toBe(2);
  });
  it("signe de vie limité à une écriture toutes les 15 s", async () => {
    const st = await touchLive("c", await readLive("c"));
    expect(st.seen).toBeGreaterThan(0);
    expect((await touchLive("c", st)).seen).toBe(st.seen);
  });
  it("normalizeLive garde les valeurs connues", () => {
    expect(normalizeLive({ layout: "wall", order: "x", captions: false })).toMatchObject({ layout: "wall", order: "recent", captions: false });
  });
});
