/*
 * Jukebox — sauvegarde de nuit du catalogue dans Cloudflare R2 (même bucket et
 * mêmes variables R2_* que Clic-Clac, lib/clicclac/r2.js).
 *
 * Un fichier JSON lisible par jour (date de Paris) :
 *   jukebox-backups/catalogue-AAAA-MM-JJ.json
 * avec les tables du catalogue (chansons, alias Deezer, versions, rognages,
 * changements de vidéo, signalements, liens ignorés) et les doublons ignorés.
 * Pas de données des soirées (invités, titres joués, votes) ni de secrets.
 *
 * Lancée par /api/keep-alive (cron 4 h 30 UTC, avant le pré-remplissage et
 * l'enrichissement : l'état d'avant les changements automatiques de la nuit).
 * Une seule par jour ; « Sauvegarder maintenant » (super-admin) la refait.
 * Conservation : 30 derniers jours + le 1er de chaque mois pendant un an.
 * Restauration : pas automatique — le fichier sert à retrouver ou recopier
 * à la main ce qui a été perdu.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { r2Put, r2Exists, r2List, r2Remove } from "@/lib/clicclac/r2";

const PREFIX = "jukebox-backups/";
const LAST_KEY = "backup_last";
const KEEP_DAYS = 30;
const KEEP_MONTHS_DAYS = 370;

// table → colonnes d'ordre (clé primaire : lecture paginée stable)
export const BACKUP_TABLES = [
  ["jukebox_works", ["id"]],
  ["jukebox_work_aliases", ["deezer_id"]],
  ["jukebox_versions", ["work_id", "kind"]],
  ["jukebox_trims", ["video_id", "kind"]],
  ["jukebox_video_changes", ["id"]],
  ["jukebox_reports", ["id"]],
  ["jukebox_link_ignore", ["video_id"]],
];
const CONFIG_KEYS = ["dup_ignore"];

export const parisDay = (ms = Date.now()) =>
  new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const pathFor = (day) => `${PREFIX}catalogue-${day}.json`;
const dayOf = (path) => (String(path).match(/catalogue-(\d{4}-\d{2}-\d{2})\.json$/) || [])[1] || null;

/* Fichiers à supprimer : plus vieux que 30 jours, sauf le 1er du mois (gardé un an). */
export function backupsToPrune(paths, today = parisDay()) {
  const t = Date.parse(`${today}T00:00:00Z`);
  return paths.filter((p) => {
    const d = dayOf(p);
    if (!d) return false;
    const age = (t - Date.parse(`${d}T00:00:00Z`)) / 86400e3;
    if (age <= KEEP_DAYS) return false;
    return !(d.endsWith("-01") && age <= KEEP_MONTHS_DAYS);
  });
}

async function fetchAll(sb, table, order) {
  const rows = [];
  for (let from = 0; from < 500000; from += 1000) {
    let q = sb.from(table).select("*");
    for (const c of order) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function writeLast(report) {
  await getSupabaseAdmin().from("jukebox_config").upsert({ key: LAST_KEY, value: JSON.stringify(report) });
}
export async function backupLast() {
  const { data } = await getSupabaseAdmin().from("jukebox_config").select("value").eq("key", LAST_KEY).maybeSingle();
  try { return data?.value ? JSON.parse(data.value) : null; } catch (e) { return null; }
}

/* Sauvegarde du jour (déjà faite → rien, sauf force). Ne lève jamais : renvoie un rapport. */
export async function runBackup({ force = false } = {}) {
  const day = parisDay();
  const path = pathFor(day);
  try {
    if (!force && await r2Exists(path)) return { skipped: true, path };
    const sb = getSupabaseAdmin();
    const tables = {};
    const counts = {};
    for (const [t, order] of BACKUP_TABLES) {
      tables[t] = await fetchAll(sb, t, order);
      counts[t] = tables[t].length;
    }
    const { data: cfg, error } = await sb.from("jukebox_config").select("key, value").in("key", CONFIG_KEYS);
    if (error) throw new Error(`jukebox_config : ${error.message}`);
    const at = new Date().toISOString();
    const json = JSON.stringify({ app: "jukebox", kind: "catalogue", format: 1, at, day, counts, tables, config: cfg || [] });
    const buf = Buffer.from(json, "utf8");
    await r2Put(path, buf, "application/json; charset=utf-8");
    let pruned = 0;
    try {
      const old = backupsToPrune((await r2List(PREFIX)).map((f) => f.path), day);
      if (old.length) { await r2Remove(old); pruned = old.length; }
    } catch (e) { /* ménage raté : réessayé demain */ }
    const report = { at, day, path, bytes: buf.byteLength, counts, pruned };
    await writeLast(report);
    return report;
  } catch (e) {
    const report = { at: new Date().toISOString(), day, error: String(e?.message || e) };
    await writeLast(report).catch(() => {});
    return report;
  }
}

/* Liste des sauvegardes (plus récente d'abord) : pour le futur outil « Retrouver ce
 * qui a disparu » (pas encore branché). */
export async function listBackups() {
  return (await r2List(PREFIX))
    .map((f) => ({ ...f, day: dayOf(f.path) }))
    .filter((f) => f.day)
    .sort((a, b) => b.day.localeCompare(a.day));
}
