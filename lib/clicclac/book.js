/*
 * Clic-Clac — sélection « livre photo » de l'organisateur (photos favorites).
 * Rangée dans jukebox_config, clé « ccbook:<album id> » → { ids: [...] }
 * (pas de SQL dédié). Les photos supprimées depuis sont ignorées à la lecture
 * par l'interface (elle ne garde que les ids encore présents).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const BOOK_MAX = 500;
export const bookKey = (albumId) => `ccbook:${albumId}`;

export async function readBook(albumId) {
  const { data, error } = await getSupabaseAdmin().from("jukebox_config").select("value").eq("key", bookKey(albumId)).maybeSingle();
  if (error) throw error;
  try { const v = data ? JSON.parse(data.value) : {}; return Array.isArray(v.ids) ? v.ids : []; } catch (e) { return []; }
}

/* Ajoute / retire une photo de la sélection. → ids */
export async function setFavorite(albumId, id, on) {
  const cur = await readBook(albumId);
  const ids = on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
  if (ids.length > BOOK_MAX) { const e = new Error(`Sélection limitée à ${BOOK_MAX} photos.`); e.status = 400; throw e; }
  const { error } = await getSupabaseAdmin().from("jukebox_config").upsert({ key: bookKey(albumId), value: JSON.stringify({ ids }) });
  if (error) throw error;
  return ids;
}
