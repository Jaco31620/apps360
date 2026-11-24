// Super-admin : une prolongation (+30 jours) ne doit pas être perdue en corrigeant autre chose.
import { describe, it, expect, vi, beforeEach } from "vitest";

let row, saved;
const q = {
  select: () => q, eq: () => q,
  maybeSingle: async () => ({ data: row, error: null }),
  update: (patch) => { saved = patch; return { eq: async () => ({ error: null }) }; },
};
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => ({ from: () => q }) }));
vi.mock("@/lib/clicclac/server", async (orig) => ({ ...(await orig()), isSuper: () => true }));
const { PATCH } = await import("@/app/api/clicclac/super/albums/[id]/route");
const patch = (body) => PATCH({ json: async () => body }, { params: Promise.resolve({ id: "x" }) });

beforeEach(() => {
  saved = null;
  row = { id: "x", event_date: "2026-10-30", expires_at: "2027-02-01T00:00:00.000Z", settings: { retentionDays: 60 } };
});

describe("échéance d'un album", () => {
  it("gardée si la date et la durée sont renvoyées sans changement", async () => {
    await patch({ adminEmail: "a@b.fr", eventDate: "2026-10-30", settings: { retentionDays: "60", guestQuota: 5 } });
    expect(saved.expires_at).toBeUndefined();
    expect(saved.admin_email).toBe("a@b.fr");
    expect(saved.settings.guestQuota).toBe(5);
  });
  it("gardée pour un album sans date", async () => {
    row.event_date = null;
    await patch({ eventDate: "", settings: { retentionDays: 60 } });
    expect(saved.expires_at).toBeUndefined();
  });
  it("recalculée si la durée ou la date change", async () => {
    await patch({ settings: { retentionDays: 90 } });
    expect(saved.expires_at.slice(0, 10)).toBe("2027-01-28");
    await patch({ eventDate: "2026-11-30" });
    expect(saved.expires_at.slice(0, 10)).toBe("2027-01-29");
  });
  it("prolongée de 30 jours", async () => {
    await patch({ extendDays: 30 });
    expect(saved.expires_at.slice(0, 10)).toBe("2027-03-03");
  });
});
