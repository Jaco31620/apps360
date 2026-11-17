/*
 * Jukebox — signalements de la régie (SERVEUR uniquement, table
 * jukebox_reports, SQL v34). La régie note un problème sur une vidéo (🚩) sans
 * rien changer ; le super-admin le traite plus tard (file « 🚩 Signalements »).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { REPORT_REASONS, songText } from "@/lib/jukebox";
import { catalog } from "@/lib/jukeboxCatalog";

const table = () => getSupabaseAdmin().from("jukebox_reports");
const REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id));

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/* Version du catalogue jouée par ce titre. Une même vidéo peut être rattachée
 * à plusieurs chansons (dont une par erreur) : on garde celle dont le titre et
 * l'artiste sont ceux du titre joué, puis celle du mode de la soirée, sinon
 * n'importe laquelle avec cette vidéo (blind test : paroles ou clip). */
export async function versionOfTrack(track, mode) {
  const { data } = await catalog("*").eq("video_id", track.video_id);
  const rows = (data || []).filter((r) => !r.no_clip); // « pas de clip » : vidéo refusée, pas celle qui a passé
  const t = norm(track.title), a = norm(track.channel);
  const score = (r) => {
    const s = songText(r);
    return (norm(s.title) === t ? 4 : 0) + (norm(s.artist) === a ? 2 : 0) + (r.mode === mode ? 1 : 0) + (r.mode !== "karaoke" ? 0.5 : 0);
  };
  return rows.sort((x, y) => score(y) - score(x))[0] || null;
}

export async function createReport(s, track, mode, { reasons, comment, position }) {
  const list = [...new Set((Array.isArray(reasons) ? reasons : []).map(String))].filter((r) => REASON_IDS.has(r));
  const text = String(comment || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!list.length && !text) return "Choisissez au moins un problème.";
  const v = await versionOfTrack(track, mode);
  const { error } = await table().insert({
    session_id: s.id, session_name: s.name || null, track_title: `${track.channel || ""} – ${track.title || ""}`.slice(0, 300),
    video_id: track.video_id, song_key: v?.key || null, reasons: list.length ? list : ["other"], comment: text || null,
    position: Number.isFinite(position) ? Math.round(position * 10) / 10 : null,
  });
  if (error) throw error;
  return null;
}

const out = (r) => ({
  id: r.id, reasons: r.reasons || [], comment: r.comment, position: r.position, videoId: r.video_id,
  sessionName: r.session_name, at: r.created_at,
});

/* Clés des versions VALIDÉES qui ont des signalements ouverts (file
 * « 🚩 Signalements ») ; une version pas encore vérifiée passe par « Versions
 * à valider », où le signalement s'affiche (et se clôt en la validant). */
export async function reportedKeys() {
  const { data, error } = await table().select("song_key").eq("status", "open").not("song_key", "is", null);
  if (error) return [];
  const keys = [...new Set((data || []).map((r) => r.song_key))];
  if (!keys.length) return [];
  const { data: ok } = await catalog("key").in("key", keys).eq("validated", true);
  return (ok || []).map((r) => r.key);
}

/* Signalements ouverts ajoutés aux titres (super-admin), sur la vidéo actuelle. */
export async function withReports(songs) {
  const keys = [...new Set(songs.map((s) => s.key).filter(Boolean))];
  if (!keys.length) return;
  const { data, error } = await table().select("*").in("song_key", keys).eq("status", "open").order("created_at");
  if (error) return; // table absente (SQL v34)
  for (const s of songs) {
    const rows = (data || []).filter((r) => r.song_key === s.key);
    if (rows.length) s.reports = rows.map(out);
  }
}

/* Traité ou refusé : tous les signalements ouverts de cette version. */
export async function closeReports(key, status) {
  const { error } = await table().update({ status: status === "rejected" ? "rejected" : "done", decided_at: new Date().toISOString() })
    .eq("song_key", String(key || "")).eq("status", "open");
  if (error) throw error;
}
