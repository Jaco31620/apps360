/*
 * Route PUBLIQUE — « ❤️ J'aime » d'un invité sur le titre en cours (option
 * de la régie options.votes). Body : { participantId, id, like }.
 * like = true : vote ; false : retire son vote. Pas sur ses propres titres,
 * ni pendant le blind test. Réponse : { likes, liked }.
 */
import { tooMany, clientIp } from "@/lib/jukeboxRate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSession } from "@/lib/jukeboxServer";
import { sessionBlind } from "@/lib/jukeboxBlindServer";
import { voteState } from "@/lib/jukeboxVotes";
import { notify } from "@/lib/jukeboxLive";
import { metered } from "@/lib/usageMeter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validPid = (pid) => /^[a-z0-9-]{8,64}$/i.test(String(pid || "")) && !/^(blind-|regie-)/i.test(String(pid));

async function POST_(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const pid = body?.participantId;
  const id = String(body?.id || "");
  if (!validPid(pid)) return Response.json({ error: "Participant invalide." }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Titre introuvable." }, { status: 404 });
  if (await tooMany(`vote:${clientIp(req)}`, 60, 60)) return Response.json({ error: "Doucement ! Réessayez dans un instant." }, { status: 429 });

  try {
    const s = await loadSession(code);
    if (!s) return Response.json({ error: "Soirée introuvable." }, { status: 404 });
    if (!s.options?.votes) return Response.json({ error: "Les votes ne sont pas activés." }, { status: 409 });
    if (sessionBlind(s)?.on) return Response.json({ error: "Pas de vote pendant le blind test." }, { status: 409 });
    const sb = getSupabaseAdmin();
    const { data: t, error } = await sb.from("jukebox_tracks").select("id,participant_id,status")
      .eq("session_id", s.id).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!t || t.status !== "playing") return Response.json({ error: "Ce titre n'est plus en cours." }, { status: 409 });
    if (t.participant_id === pid) return Response.json({ error: "Pas de vote pour vos propres titres 😉" }, { status: 403 });

    const { error: e2 } = body?.like === false
      ? await sb.from("jukebox_votes").delete().eq("track_id", id).eq("participant_id", pid)
      : await sb.from("jukebox_votes").upsert({ session_id: s.id, track_id: id, participant_id: pid }, { onConflict: "track_id,participant_id", ignoreDuplicates: true });
    if (e2) throw e2;
    await notify(s.code, "vote"); // écran (cœurs) et régie
    return Response.json({ ok: true, ...(await voteState(id, pid)) });
  } catch (e) {
    console.error("jukebox vote:", e);
    return Response.json({ error: "Vote non enregistré, réessayez." }, { status: 502 });
  }
}

// mesure de consommation (lib/usageMeter.js)
export const POST = metered(POST_);
