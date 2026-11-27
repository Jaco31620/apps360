/*
 * Sélection « livre photo » (organisateur).
 * - GET  : { ids }
 * - POST : { id, on } → ajoute / retire la photo → { ids }
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAlbum, roleFor, canAdmin } from "@/lib/clicclac/server";
import { readBook, setFavorite } from "@/lib/clicclac/book";
import { metered } from "@/lib/usageMeter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ""));

async function guard(req, code) {
  const a = await loadAlbum(code);
  if (!a) return { res: Response.json({ error: "Album introuvable." }, { status: 404 }) };
  if (!canAdmin(roleFor(req, a))) return { res: Response.json({ error: "Réservé à l'organisateur." }, { status: 403 }) };
  return { a };
}

async function GET_(req, { params }) {
  const { code } = await params;
  try {
    const { a, res } = await guard(req, code);
    if (res) return res;
    return Response.json({ ids: await readBook(a.id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("clicclac book GET:", e);
    return Response.json({ error: "Chargement impossible." }, { status: 502 });
  }
}

async function POST_(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    const { a, res } = await guard(req, code);
    if (res) return res;
    const id = String(body?.id || "").toLowerCase();
    if (!isUuid(id)) return Response.json({ error: "Photo introuvable." }, { status: 404 });
    if (body.on) {
      const { data } = await getSupabaseAdmin().from("clicclac_photos").select("id").eq("id", id).eq("album_id", a.id).maybeSingle();
      if (!data) return Response.json({ error: "Photo introuvable." }, { status: 404 });
    }
    return Response.json({ ids: await setFavorite(a.id, id, !!body.on) });
  } catch (e) {
    if (e.status) return Response.json({ error: e.message }, { status: e.status });
    console.error("clicclac book POST:", e);
    return Response.json({ error: "Enregistrement impossible." }, { status: 502 });
  }
}

// mesure de consommation (lib/usageMeter.js)
export const GET = metered(GET_);
export const POST = metered(POST_);
