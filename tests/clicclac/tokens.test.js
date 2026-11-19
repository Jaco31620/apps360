// Clic-Clac : jetons organisateur / borne liés au code organisateur
import { describe, it, expect, vi } from "vitest";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => null }));
const { albumToken, boothTokenFor, roleFor, signToken, verifyToken } = await import("@/lib/clicclac/server");

const req = (t) => ({ headers: new Headers(t ? { "x-cc-auth": t } : {}) });
const album = { id: "a1", admin_hash: "abcdef0123456789" };

describe("jetons", () => {
  it("organisateur valable 7 jours", () => {
    const p = verifyToken(albumToken(album));
    expect(p.exp - Date.now()).toBeGreaterThan(6.9 * 864e5);
    expect(roleFor(req(albumToken(album)), album)).toBe("admin");
    expect(roleFor(req(boothTokenFor(album)), album)).toBe("booth");
  });
  it("code organisateur régénéré → anciens jetons refusés", () => {
    const t = albumToken(album), b = boothTokenFor(album);
    const changed = { ...album, admin_hash: "ffffff0123456789" };
    expect(roleFor(req(t), changed)).toBe(null);
    expect(roleFor(req(b), changed)).toBe(null);
  });
  it("ancien format sans empreinte refusé, super-admin toujours accepté", () => {
    expect(roleFor(req(signToken("album:a1")), album)).toBe(null);
    expect(roleFor(req(signToken("super")), album)).toBe("super");
  });
  it("autre album refusé", () => {
    expect(roleFor(req(albumToken(album)), { id: "a2", admin_hash: album.admin_hash })).toBe(null);
  });
});
