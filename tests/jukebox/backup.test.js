import { describe, it, expect } from "vitest";
import { backupsToPrune, parisDay } from "@/lib/jukeboxBackup";

const p = (d) => `jukebox-backups/catalogue-${d}.json`;

describe("sauvegarde du catalogue : ménage", () => {
  it("garde les 30 derniers jours", () => {
    expect(backupsToPrune([p("2026-11-20"), p("2026-10-21"), p("2026-10-20"), p("2026-10-19")], "2026-11-20"))
      .toEqual([p("2026-10-20"), p("2026-10-19")]); // 30 jours gardés, le 31e part
  });
  it("garde le 1er du mois pendant un an", () => {
    expect(backupsToPrune([p("2026-06-01"), p("2026-06-02"), p("2025-12-01"), p("2025-11-01")], "2026-11-20"))
      .toEqual([p("2026-06-02"), p("2025-11-01")]); // plus d'un an : parti
  });
  it("ignore les fichiers qui ne sont pas des sauvegardes", () => {
    expect(backupsToPrune(["jukebox-backups/autre.txt", "x/catalogue-2020-01-02.txt"], "2026-11-20")).toEqual([]);
  });
});

describe("date de Paris", () => {
  it("passe au lendemain à minuit à Paris, pas en UTC", () => {
    expect(parisDay(Date.parse("2026-11-19T23:30:00Z"))).toBe("2026-11-20");
    expect(parisDay(Date.parse("2026-07-19T21:30:00Z"))).toBe("2026-07-19");
  });
});
