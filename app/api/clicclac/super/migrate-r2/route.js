/* Super-admin : copie des fichiers Clic-Clac de Supabase Storage vers R2.
 * POST { offset } → copie par lots (≈40 s max par appel) et renvoie l'offset
 * suivant ; le super-admin relance jusqu'à done = true. Idempotent : un fichier
 * déjà présent dans R2 est sauté. Ne supprime rien côté Supabase. */
import { isSuper, BUCKET } from "@/lib/clicclac/server";
import { r2Config, r2Exists, r2Put } from "@/lib/clicclac/r2";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;
const BUDGET_MS = 40_000;

async function allPaths(sb) {
  const { data: photos, error } = await sb.from("clicclac_photos").select("path,thumb_path,hd_path").order("created_at");
  if (error) throw error;
  const { data: albums, error: e2 } = await sb.from("clicclac_albums").select("settings");
  if (e2) throw e2;
  const list = [
    ...photos.flatMap((p) => [p.path, p.thumb_path, p.hd_path]),
    ...albums.map((a) => a.settings?.customFrame),
  ].filter(Boolean);
  return [...new Set(list)];
}

export async function POST(req) {
  if (!isSuper(req)) return Response.json({ error: "Accès refusé." }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch (e) { /* offset 0 */ }
  try {
    r2Config(); // erreur claire si les variables R2 manquent
    const sb = getSupabaseAdmin();
    const paths = await allPaths(sb);
    const t0 = Date.now();
    let i = Math.max(0, Number(body?.offset) || 0), copied = 0, skipped = 0;
    const missing = [];
    while (i < paths.length && Date.now() - t0 < BUDGET_MS) {
      const p = paths[i++];
      if (await r2Exists(p)) { skipped++; continue; }
      const { data, error } = await sb.storage.from(BUCKET).download(p);
      if (error || !data) { missing.push(p); continue; }
      await r2Put(p, Buffer.from(await data.arrayBuffer()), data.type || (p.endsWith(".png") ? "image/png" : "image/jpeg"));
      copied++;
    }
    return Response.json({ total: paths.length, offset: i, copied, skipped, missing, done: i >= paths.length });
  } catch (e) {
    console.error("clicclac migrate-r2:", e);
    return Response.json({ error: e.message || "Migration impossible." }, { status: 502 });
  }
}
