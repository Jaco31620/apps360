import { describe, it, expect, vi } from "vitest";
import { fakeSupabase } from "../helpers/fakeSupabase";

let sb;
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => sb }));
const { palmares, voteState } = await import("@/lib/jukeboxVotes");

const tracks = [
  { id: "t1", title: "Billie Jean", channel: "Michael Jackson", participant_id: "p-aaaaaaaa", author: "Seb", created_at: "1" },
  { id: "t2", title: "Les mots bleus", channel: "Christophe", participant_id: "p-bbbbbbbb", author: "Rachel", created_at: "2" },
  { id: "t3", title: "Elle", channel: "Didier Barbelivien", participant_id: "p-aaaaaaaa", author: "Sébastien", created_at: "3" },
  { id: "t4", title: "Voyage voyage", channel: "Desireless", participant_id: "regie-x", author: "Régie", created_at: "4" },
];
const votes = (list) => list.map(([track_id, participant_id]) => ({ track_id, participant_id }));

describe("palmarès des votes", () => {
  it("titres et DJ classés, ex æquo, titres de la régie exclus du palmarès, dernier prénom retenu", async () => {
    const v = votes([["t1", "x1"], ["t1", "x2"], ["t2", "x1"], ["t2", "x3"], ["t3", "x2"], ["t4", "x1"], ["t4", "x2"], ["t4", "x3"]]);
    sb = fakeSupabase(({ table }) => ({ data: table === "jukebox_votes" ? v : tracks, error: null }));
    const p = await palmares("s");
    expect(p.tracks.map((t) => [t.title, t.points, t.rank])).toEqual([["Billie Jean", 2, 1], ["Les mots bleus", 2, 1], ["Elle", 1, 3]]);
    expect(p.djs).toEqual([{ name: "Sébastien", points: 3, rank: 1 }, { name: "Rachel", points: 2, rank: 2 }]);
  });
  it("aucun vote : null", async () => {
    sb = fakeSupabase(() => ({ data: [], error: null }));
    expect(await palmares("s")).toBeNull();
  });
  it("état d'un titre : nombre de cœurs et vote de l'invité", async () => {
    sb = fakeSupabase(() => ({ data: [{ participant_id: "a" }, { participant_id: "b" }], error: null }));
    expect(await voteState("t1", "b")).toEqual({ likes: 2, liked: true });
    expect(await voteState("t1", null)).toEqual({ likes: 2, liked: false });
  });
});
