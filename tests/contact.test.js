import { describe, it, expect } from "vitest";
import { cleanContact, safeName, describeDevice, isLate } from "@/lib/contact";
const ok = { id: "0b6f7c1e-1111-4222-8333-444455556666", kind: "avis", app: "jukebox", message: " Bravo ", email: "", name: "Julie" };
describe("contact", () => {
  it("accepte un avis sans adresse", () => { expect(cleanContact(ok).row).toMatchObject({ message: "Bravo", email: null, name: "Julie" }); });
  it("demande l'adresse pour une question", () => { expect(cleanContact({ ...ok, kind: "question" }).field).toBe("email"); });
  it("refuse sujet, app, adresse et message incorrects", () => {
    expect(cleanContact({ ...ok, kind: "constructor" }).field).toBe("kind");
    expect(cleanContact({ ...ok, app: "ffbb" }).field).toBe("app");
    expect(cleanContact({ ...ok, email: "a@b" }).field).toBe("email");
    expect(cleanContact({ ...ok, message: "x".repeat(4001) }).field).toBe("message");
    expect(cleanContact({ ...ok, id: "1" }).error).toBeTruthy();
    expect(cleanContact(null).field).toBe("kind");
  });
  it("retire les retours à la ligne du prénom", () => { expect(cleanContact({ ...ok, name: "A\r\nBcc: x" }).row.name).toBe("A Bcc: x"); });
  it("prénom sûr : lettres seulement", () => { expect(safeName("Anne-Zoé")).toBe("Anne-Zoé"); expect(safeName("gagnez.com")).toBe(""); });
  it("décrit l'appareil", () => { expect(describeDevice("Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/130.0 Mobile Safari", { width: 412, height: 915 })).toBe("Android · Chrome 130 · écran 412×915"); });
  it("signale un message en attente depuis plus de 3 jours", () => {
    expect(isLate({ status: "todo", created_at: new Date(Date.now() - 4 * 864e5) })).toBe(true);
    expect(isLate({ status: "answered", created_at: new Date(0) })).toBe(false);
  });
});
