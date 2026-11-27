/*
 * Route PUBLIQUE — un invité passe SON titre en cours de diffusion
 * (« ⏭ Passer mon titre ») : il l'a proposé et ne veut finalement pas
 * l'écouter jusqu'au bout. Body : { participantId, id }.
 * Refusé pendant un blind test (titres piochés, pas proposés). Même
 * enchaînement que le « suivant » de la régie (lib/jukeboxAdvance).
 */
import { loadSession } from "@/lib/jukeboxServer";
import { sessionBlind, AUTO_PID } from "@/lib/jukeboxBlindServer";
import { advanceTrack } from "@/lib/jukeboxAdvance";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logEvent } from "@/lib/jukeboxEvents";
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
  if (!validPid(pid) || pid === AUTO_PID) return Response.json({ error: "Participant invalide." }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Titre introuvable." }, { status: 404 });

  try {
    const s = await loadSession(code);
    if (!s) return Response.json({ error: "Soirée introuvable." }, { status: 404 });
    if (sessionBlind(s)?.on) return Response.json({ error: "Pas pendant le blind test." }, { status: 409 });
    const { data: t, error } = await getSupabaseAdmin().from("jukebox_tracks").select("id,participant_id,author,status")
      .eq("session_id", s.id).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!t || t.participant_id !== pid) return Response.json({ error: "Ce n'est pas votre titre." }, { status: 403 });
    if (t.status !== "playing") return Response.json({ ok: true }); // déjà enchaîné

    const r = await advanceTrack(s, { from: id, skip: true });
    if (r?.ev) await Promise.all([logEvent(s.id, r.ev.kind, `Invité · ${t.author}`, r.ev.data), notify(s.code, "queue")]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("jukebox skip:", e);
    return Response.json({ error: "Impossible de passer le titre, réessayez." }, { status: 502 });
  }
}

// mesure de consommation (lib/usageMeter.js)
export const POST = metered(POST_);
