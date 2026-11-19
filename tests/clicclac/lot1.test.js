// Clic-Clac lot 1 : lecture paginée (> 1 000 lignes) et envoi avec nouveaux essais
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => null }));
const { fetchAll } = await import("@/lib/clicclac/server");

describe("fetchAll", () => {
  const rows = Array.from({ length: 2345 }, (_, i) => ({ id: i }));
  const build = () => ({ range: async (a, b) => ({ data: rows.slice(a, b + 1), error: null }) });
  it("lit toutes les pages", async () => {
    expect((await fetchAll(build)).length).toBe(2345);
  });
  it("tombe juste sur un multiple de la page", async () => {
    const r = rows.slice(0, 2000);
    expect((await fetchAll(() => ({ range: async (a, b) => ({ data: r.slice(a, b + 1), error: null }) }))).length).toBe(2000);
  });
  it("remonte les erreurs", async () => {
    await expect(fetchAll(() => ({ range: async () => ({ data: null, error: new Error("x") }) }))).rejects.toThrow("x");
  });
});

describe("sendWithRetry", () => {
  const item = { id: "a", code: "ABCDEF", fields: {}, full: new Blob(["x"]), thumb: new Blob(["y"]) };
  const load = async () => { vi.resetModules(); return import("@/components/clicclac/uploadQueue"); };

  it("réessaie après une coupure réseau puis réussit", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { if (++n < 3) throw new TypeError("network"); return new Response(JSON.stringify({ ok: true, id: "a" }), { status: 200 }); }));
    const { sendWithRetry } = await load();
    const p = sendWithRetry(item);
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ ok: true, id: "a" });
    expect(n).toBe(3);
    vi.useRealTimers();
  });

  it("ne réessaie pas un refus définitif (quota)", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: "Vous avez atteint votre limite" }), { status: 429 }));
    vi.stubGlobal("fetch", f);
    const { sendWithRetry } = await load();
    await expect(sendWithRetry(item)).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("marque l'échec réseau persistant comme « à garder »", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 502 })));
    const { sendWithRetry } = await load();
    const p = sendWithRetry(item).catch((e) => e);
    await vi.runAllTimersAsync();
    expect((await p).retryable).toBe(true);
    vi.useRealTimers();
  });
});
