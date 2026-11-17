/*
 * Jukebox — passage au titre suivant (régie, ou invité qui passe SON titre).
 *
 * `from` : identifiant du titre que l'appelant croit en cours. Seul CE titre
 * est arrêté, s'il joue toujours : deux « suivant » simultanés (fin de titre
 * sur la télé + appui sur un téléphone) n'en sautent pas un deuxième.
 * `skip` : titre passé (pas compté comme écouté).
 *
 * Retour : null si rien n'a changé (titre déjà enchaîné), sinon
 * { ev } — événement du journal à noter (ou null).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { countPlay } from "@/lib/jukeboxServer";
import { topUpBlind } from "@/lib/jukeboxBlindServer";

export async function advanceTrack(s, { from = null, skip = false } = {}) {
  const tracks = () => getSupabaseAdmin().from("jukebox_tracks");
  const { data: cur, error } = await tracks().select("id,video_id,title,channel").eq("session_id", s.id).eq("status", "playing");
  if (error) throw error;
  if ((cur[0]?.id || null) !== (from || null)) return null;
  if (cur.length) {
    const { data: done, error: e2 } = await tracks().update({ status: skip ? "skipped" : "played" })
      .eq("id", cur[0].id).eq("status", "playing").select("id");
    if (e2) throw e2;
    if (!done?.length) return null; // déjà fait par l'autre appel
    if (!skip) await countPlay(cur[0].video_id);
  }
  await topUpBlind(s); // blind test automatique : file complétée
  const { data: q, error: e3 } = await tracks().select("id").eq("session_id", s.id).eq("status", "queued").order("position").limit(1);
  if (e3) throw e3;
  const nxt = q?.[0];
  if (nxt) {
    const { error: e4 } = await tracks().update({ status: "playing", played_at: new Date().toISOString() }).eq("id", nxt.id).eq("status", "queued");
    if (e4) throw e4;
  }
  await topUpBlind(s);
  if (!skip && !nxt) return { ev: null };
  const { data: started } = nxt ? await tracks().select("title,channel").eq("id", nxt.id).maybeSingle() : { data: null };
  const label = (t) => (t ? `${t.channel} – ${t.title}` : null);
  return {
    ev: skip
      ? { kind: "skip", data: { title: label(cur[0]), next: label(started) } }
      : { kind: "play", data: { title: label(started) } },
  };
}
