/*
 * Version HD d'une photo, envoyée juste après la photo elle-même (requête à
 * part : limite de 4,5 Mo par requête chez Vercel).
 * Autorisé : organisateur / borne, ou l'invité auteur (guestId), dans les
 * 24 h qui suivent l'envoi, et une seule fois (pas de remplacement).
 * Idempotent : HD déjà présente → ok.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAlbum, roleFor, canAdmin, putFile, sniffImage } from "@/lib/clicclac/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 4.3 * 1024 * 1024;
const WINDOW = 24 * 3600 * 1000;
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ""));

export async function POST(req, { params }) {
  const { code, id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Photo introuvable." }, { status: 404 });
  let form;
  try { form = await req.formData(); } catch (e) { return Response.json({ error: "Envoi invalide." }, { status: 400 }); }
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    if (!a.settings.keepHd) return Response.json({ ok: true, skipped: true });
    const sb = getSupabaseAdmin();
    const { data: p, error } = await sb.from("clicclac_photos").select("id,album_id,guest_id,hd_path,bytes,created_at").eq("id", id).eq("album_id", a.id).maybeSingle();
    if (error) throw error;
    if (!p) return Response.json({ error: "Photo introuvable." }, { status: 404 });
    if (p.hd_path) return Response.json({ ok: true, duplicate: true });
    const role = roleFor(req, a);
    const trusted = canAdmin(role) || role === "booth";
    if (!trusted && (!p.guest_id || String(form.get("guestId") || "") !== p.guest_id)) return Response.json({ error: "Non autorisé." }, { status: 403 });
    if (Date.now() - new Date(p.created_at).getTime() > WINDOW) return Response.json({ error: "Trop tard pour la HD." }, { status: 403 });

    const f = form.get("hd");
    if (!f || typeof f.arrayBuffer !== "function") return Response.json({ error: "Photo manquante." }, { status: 400 });
    if (f.size > MAX) return Response.json({ error: "Photo trop lourde." }, { status: 413 });
    const buf = Buffer.from(await f.arrayBuffer());
    if (sniffImage(buf) !== "image/jpeg") return Response.json({ error: "Format de photo invalide." }, { status: 400 });

    const path = `${a.id}/${id}_hd.jpg`;
    await putFile(path, buf, "image/jpeg");
    const { error: e2 } = await sb.from("clicclac_photos").update({ hd_path: path, bytes: (p.bytes || 0) + buf.length }).eq("id", id).is("hd_path", null);
    if (e2) throw e2;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("clicclac photo hd POST:", e);
    return Response.json({ error: "Envoi impossible." }, { status: 502 });
  }
}
