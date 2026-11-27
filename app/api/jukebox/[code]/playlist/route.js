/*
 * Titres joués d'une soirée, pour les invités (page /jukebox/<code>/playlist) :
 * aussi après la fermeture. Titres et artistes seulement (pas les prénoms),
 * heure de passage et nombre de « ❤️ J'aime » (votes, s'il y en a eu).
 * ?pid=<participant> : ses propres titres marqués `mine` (filtre « Mes titres »).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSession } from "@/lib/jukeboxServer";
import { metered } from "@/lib/usageMeter";

export const dynamic = "force-dynamic";

async function GET_(req, { params }) {
  const { code } = await params;
  const pid = new URL(req.url).searchParams.get("pid") || "";
  const me = /^[a-z0-9-]{8,64}$/i.test(pid) ? pid : null;
  try {
    const s = await loadSession(code, { any: true });
    if (!s) return Response.json({ error: "Soirée introuvable." }, { status: 404 });
    const sb = getSupabaseAdmin();
    const [{ data, error }, { data: votes }] = await Promise.all([
      sb.from("jukebox_tracks").select("id,title,channel,video_id,played_at,participant_id")
        .eq("session_id", s.id).eq("status", "played").order("played_at", { ascending: false }).limit(500), // les 500 plus récents
      sb.from("jukebox_votes").select("track_id").eq("session_id", s.id), // table absente : pas de cœurs
    ]);
    if (error) throw error;
    const likes = new Map();
    for (const v of votes || []) likes.set(v.track_id, (likes.get(v.track_id) || 0) + 1);
    return Response.json({
      name: s.options?.theme?.title || s.name,
      tracks: (data || []).reverse().map((t) => ({ title: t.title, artist: t.channel, videoId: t.video_id, playedAt: t.played_at, likes: likes.get(t.id) || 0, ...(me && t.participant_id === me ? { mine: true } : {}) })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("jukebox playlist:", e);
    return Response.json({ error: "Chargement impossible." }, { status: 502 });
  }
}

// mesure de consommation (lib/usageMeter.js)
export const GET = metered(GET_);
