import { describe, it, expect, vi } from "vitest";
import { fakeSupabase } from "../helpers/fakeSupabase";

let sb;
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => sb }));
const { palmares, voteState, recordPassLikes } = await import("@/lib/jukeboxVotes");

const tracks = [
  { id: "t1", title: "Billie Jean", channel: "Michael Jackson", participant_id: "p-aaaaaaaa", author: "Seb", created_at: "1" },
  { id: "t2", title: "Les mots bleus", channel: "Christophe", participant_id: "p-bbbbbbbb", author: "Rachel", created_at: "2" },
  { id: "t3", title: "Elle", channel: "Didier Barbelivien", participant_id: "p-aaaaaaaa", author: "Sébastien", created_at: "3" },
  { id: "t4", title: "Voyage voyage", channel: "Desireless", participant_id: "regie-x", author: "Régie", created_at: "4" },
  { id: "t5", title: "Exodus", channel: "Bob Marley", participant_id: "8e49264a-da56-44bf-a63f-5e62a163110f", author: "Régie", created_at: "5" }, // ajouté depuis la régie
];
const votes = (list) => list.map(([track_id, participant_id]) => ({ track_id, participant_id }));

describe("palmarès des votes", () => {
  it("titres et DJ classés, ex æquo, titres de la régie comptés dans les titres mais pas dans les DJ, dernier prénom retenu", async () => {
    const v = votes([["t1", "x1"], ["t1", "x2"], ["t2", "x1"], ["t2", "x3"], ["t3", "x2"], ["t4", "x1"], ["t4", "x2"], ["t4", "x3"], ["t5", "x1"], ["t5", "x2"], ["t5", "x3"]]);
    sb = fakeSupabase(({ table }) => ({ data: table === "jukebox_votes" ? v : tracks, error: null }));
    const p = await palmares("s");
    expect(p.tracks.map((t) => [t.title, t.points, t.rank])).toEqual([["Voyage voyage", 3, 1], ["Exodus", 3, 1], ["Billie Jean", 2, 3]]);
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

describe("J'aime d'un passage → stats de la chanson", () => {
  const run = async (votes, track, options = { votes: true }) => {
    let update = null;
    sb = fakeSupabase(({ table, ops }) => {
      if (table === "jukebox_votes") return { data: votes, error: null };
      if (table === "jukebox_versions") return { data: [{ work_id: "w1" }], error: null };
      if (table === "jukebox_works") {
        const u = ops.find((o) => o.name === "update");
        if (u) { update = u.args[0]; return { data: null, error: null }; }
        return { data: { likes: 10, like_audience: 40, like_passes: 3 }, error: null };
      }
      return { data: null, error: null };
    });
    await recordPassLikes({ id: "s", options }, track);
    return update;
  };
  const track = { id: "t1", video_id: "vid", played_at: new Date().toISOString(), participant_id: "auteur" };
  it("cœurs du titre et votants présents (hors auteur du titre) cumulés", async () => {
    const v = [{ track_id: "t1", participant_id: "a" }, { track_id: "t1", participant_id: "b" }, { track_id: "t0", participant_id: "c" }, { track_id: "t0", participant_id: "auteur" }];
    expect(await run(v, track)).toEqual({ likes: 12, like_audience: 43, like_passes: 4 });
  });
  it("personne ne votait : rien", async () => {
    expect(await run([], track)).toBeNull();
  });
  it("votes coupés : rien", async () => {
    expect(await run([{ track_id: "t1", participant_id: "a" }], track, {})).toBeNull();
  });
});
