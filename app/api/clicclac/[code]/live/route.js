/*
 * Écran live piloté à distance.
 * - GET  (détenteurs du code) : état { rev, cfg, paused, cmd, seen } ;
 *        ?tv=1 → signe de vie de l'écran (affiché sur la télécommande).
 * - POST (organisateur) : { cfg?, paused?, cmd? } → nouvel état.
 */
import { loadAlbum, roleFor, canAdmin } from "@/lib/clicclac/server";
import { readLive, updateLive, touchLive } from "@/lib/clicclac/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { code } = await params;
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    let state = await readLive(a.id);
    if (new URL(req.url).searchParams.get("tv") === "1") state = await touchLive(a.id, state);
    return Response.json(state, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("clicclac live GET:", e);
    return Response.json({ error: "Chargement impossible." }, { status: 502 });
  }
}

export async function POST(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    if (!canAdmin(roleFor(req, a))) return Response.json({ error: "Accès refusé." }, { status: 401 });
    return Response.json(await updateLive(a.id, body || {}));
  } catch (e) {
    console.error("clicclac live POST:", e);
    return Response.json({ error: "Commande impossible." }, { status: 502 });
  }
}
