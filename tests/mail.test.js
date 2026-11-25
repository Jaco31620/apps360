import { describe, it, expect } from "vitest";
import { para, lines, sendEach, sentText } from "@/lib/mail";
describe("e-mails", () => {
  it("échappe, garde les lignes, rend les liens cliquables", () => {
    expect(para("a <b>\nc\n\nd").match(/<p /g)).toHaveLength(2);
    expect(para("a <b>\nc")).toContain("a &lt;b&gt;<br>c");
    expect(lines("voir https://apps360.fr/x?a=1&b=2.")).toContain('href="https://apps360.fr/x?a=1&amp;b=2"');
  });
  it("un envoi par destinataire, les échecs n'arrêtent rien", async () => {
    const got = [];
    const r = await sendEach(["a", "b", "c"], async (x) => { if (x === "b") throw new Error("ko"); got.push(x); });
    expect(got).toEqual(["a", "c"]);
    expect(r).toMatchObject({ sent: 2, failed: ["b"], error: "ko" });
    expect(sentText(r)).toBe("✓ Envoyé à 2 destinataires. Non envoyé : b");
  });
});
