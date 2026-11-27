import { describe as d, it, expect, vi } from "vitest";

const rpc = vi.fn(async () => ({ error: null }));
const pending = [];
vi.mock("next/server", () => ({ after: (fn) => pending.push(fn) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => ({ rpc }) }));

const { describe: describePath, metered } = await import("@/lib/usageMeter");

d("usageMeter", () => {
  it("découpe app / code / route", () => {
    expect(describePath("/api/jukebox/ABCD/vote", "ABCD")).toEqual({ app: "jukebox", code: "ABCD", route: "vote" });
    expect(describePath("/api/jukebox/ABCD", "ABCD")).toEqual({ app: "jukebox", code: "ABCD", route: "" });
    expect(describePath("/api/clicclac/XY12/photos/550e8400-e29b", "XY12")).toEqual({ app: "clicclac", code: "XY12", route: "photos/*" });
    expect(describePath("/api/jukebox/tv", undefined)).toEqual({ app: "jukebox", code: "-", route: "tv" });
    expect(describePath("/api/jukebox/a%20b'--", "a%20b'--").code).toBe("?");
  });

  it("rend la réponse ou l'exception de la route telle quelle", async () => {
    const ok = metered(async () => new Response("x", { status: 201 }));
    const res = await ok(new Request("http://h/api/jukebox/ABCD"), { params: Promise.resolve({ code: "ABCD" }) });
    expect(res.status).toBe(201);
    const ko = metered(async () => { throw new Error("boum"); });
    await expect(ko(new Request("http://h/api/jukebox/tv"))).rejects.toThrow("boum");
  });

  it("envoie les totaux au plus une fois par minute, sans bloquer si l'envoi échoue", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61e3);
    rpc.mockResolvedValueOnce({ error: { message: "absente" } });
    const h = metered(async () => Response.json({}));
    await h(new Request("http://h/api/jukebox/ABCD/vote", { method: "POST" }), { params: Promise.resolve({ code: "ABCD" }) });
    await h(new Request("http://h/api/jukebox/ABCD/vote", { method: "POST" }), { params: Promise.resolve({ code: "ABCD" }) });
    expect(pending.length).toBe(1);
    await pending.shift()();
    const rows = rpc.mock.calls.at(-1)[1].p_rows;
    const vote = rows.find((r) => r.route === "vote");
    expect(vote).toMatchObject({ app: "jukebox", code: "ABCD", method: "POST" });
    expect(vote.calls).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });
});
