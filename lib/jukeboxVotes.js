/*
 * Jukebox — votes « ❤️ J'aime » des invités (SERVEUR), option de la régie
 * `options.votes`. Table jukebox_votes (SQL v38) : un vote par invité et par
 * titre. Palmarès : titres les plus aimés et « meilleur DJ » (invité dont
 * les titres ont reçu le plus de cœurs). Les titres de la régie comptent dans
 * les titres les plus aimés, mais pas dans les meilleurs DJ (pas un invité).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { countLikes } from "@/lib/jukeboxCatalog";
import { songText } from "@/lib/jukebox";

export const PALMARES_SHOW_MS = 45000; // palmarès affiché sur l'écran à la demande de la régie
const TOP = 3;
// titres hors invités : piochés par le blind test / rejoués par la régie (identifiant réservé),
// ou ajoutés depuis la régie (identifiant de l'appareil, auteur « Régie »)
const notGuest = (t) => /^(blind-|regie-)/i.test(String(t.participant_id || "")) || t.author === "Régie";

/* Cœurs d'un titre, et vote de l'invité `pid`. */
export async function voteState(trackId, pid) {
  const { data, error } = await getSupabaseAdmin().from("jukebox_votes").select("participant_id").eq("track_id", trackId);
  if (error) return { likes: 0, liked: false }; // table absente : rien de bloquant
  return { likes: data.length, liked: !!pid && data.some((v) => v.participant_id === pid) };
}

/* Rangs ex æquo : 1 + nombre de lignes strictement devant. */
const ranked = (rows) => rows.slice(0, TOP).map((r) => ({ ...r, rank: 1 + rows.filter((x) => x.points > r.points).length }));

/* { tracks: [{ title, channel, points, rank }], djs: [{ name, points, rank }] } ou null (aucun vote).
 * `since` (ms) : votes depuis le dernier « 🔄 Nouveau palmarès » de la régie
 * (options.votesSince) ; les votes plus anciens sont gardés (historique). */
export async function palmares(sessionId, since = 0) {
  const sb = getSupabaseAdmin();
  let q = sb.from("jukebox_votes").select("track_id").eq("session_id", sessionId);
  if (since > 0) q = q.gte("created_at", new Date(since).toISOString());
  const { data: votes, error } = await q;
  if (error || !votes?.length) return null;
  const count = new Map();
  for (const v of votes) count.set(v.track_id, (count.get(v.track_id) || 0) + 1);
  const { data: tracks, error: e2 } = await sb.from("jukebox_tracks").select("id,title,channel,participant_id,author,created_at")
    .in("id", [...count.keys()]);
  if (e2 || !tracks?.length) return null;
  const byTrack = tracks.map((t) => ({ title: t.title, channel: t.channel, points: count.get(t.id) || 0 }))
    .sort((a, b) => b.points - a.points);
  const dj = new Map();
  for (const t of [...tracks].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (notGuest(t)) continue;
    const d = dj.get(t.participant_id) || { name: t.author, points: 0 };
    d.name = t.author || d.name; // dernier prénom utilisé
    d.points += count.get(t.id) || 0;
    dj.set(t.participant_id, d);
  }
  const djs = [...dj.values()].filter((d) => d.points > 0).sort((a, b) => b.points - a.points);
  return { tracks: ranked(byTrack), djs: ranked(djs) };
}

/* Fin d'un passage (lib/jukeboxAdvance) : cœurs reçus et votants « présents »
 * (ont voté dans la soirée depuis 30 min avant le début du titre) cumulés
 * sur la chanson du catalogue. Rien si les votes sont coupés ou si personne
 * ne votait à ce moment-là (pas de quoi juger le titre). Jamais bloquant. */
export const AUDIENCE_WINDOW_MS = 30 * 60 * 1000;
export async function recordPassLikes(s, track) {
  if (!s?.options?.votes || !track?.id || !track.video_id) return;
  try {
    const sb = getSupabaseAdmin();
    const from = new Date((Date.parse(track.played_at) || Date.now()) - AUDIENCE_WINDOW_MS).toISOString();
    const { data, error } = await sb.from("jukebox_votes").select("track_id,participant_id").eq("session_id", s.id).gte("created_at", from);
    if (error) return;
    const audience = new Set((data || []).map((v) => v.participant_id));
    // l'invité qui a proposé le titre ne peut pas voter pour lui : pas compté dans l'audience
    if (track.participant_id) audience.delete(track.participant_id);
    if (!audience.size) return;
    const likes = (data || []).filter((v) => v.track_id === track.id).length;
    await countLikes(track.video_id, likes, audience.size);
  } catch (e) {
    console.warn("jukebox likes:", e?.message || e);
  }
}

/* Stats J'aime du catalogue (super-admin, onglet 📊 Stats) : chansons ayant au
 * moins un passage compté (SQL v39). Taux = likes / like_audience. */
export async function likeStats() {
  const { data, error } = await getSupabaseAdmin().from("jukebox_works")
    .select("id,label,artist_fix,title_fix,likes,like_audience,like_passes,plays").gt("like_passes", 0).limit(5000);
  if (error) return null; // colonnes absentes
  const songs = (data || []).map((w) => {
    const { artist, title } = songText(w);
    return { id: w.id, artist, title, likes: w.likes || 0, audience: w.like_audience || 0, passes: w.like_passes || 0, plays: w.plays || 0 };
  });
  const sum = (k) => songs.reduce((n, s) => n + s[k], 0);
  return { songs, totals: { songs: songs.length, likes: sum("likes"), audience: sum("audience"), passes: sum("passes") } };
}
