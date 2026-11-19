/*
 * Écran live piloté à distance.
 * - GET  (détenteurs du code) : état { rev, cfg, paused, cmd } + build (version
 *        du site : l'écran se recharge après une mise à jour) ;
 *        ?screen=<id>&ack=<seq>&tv=1 : signe de vie de l'écran et accusé de
 *        réception de la dernière commande appliquée ;
 *        ?screens=1 (télécommande) : ajoute la liste des écrans actifs.
 * - POST (organisateur) : { cfg?, paused?, cmd? } → nouvel état. Pour
 *        « show », la photo est vérifiée et ses liens signés ici : l'écran
 *        l'affiche sans dépendre de sa propre liste.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAlbum, roleFor, canAdmin, livePhotoOf } from "@/lib/clicclac/server";
import { readLive, updateLive, touchScreen, activeScreens } from "@/lib/clicclac/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev";

export async function GET(req, { params }) {
  const { code } = await params;
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    const q = new URL(req.url).searchParams;
    const state = await readLive(a.id);
    const screen = q.get("screen");
    if (screen && /^[a-z0-9]{8,32}$/.test(screen)) {
      await touchScreen(a.id, screen, { ack: parseInt(q.get("ack"), 10) || 0, tv: q.get("tv") === "1" });
    }
    const out = { ...state, build: BUILD, now: Date.now() }; // now : horloge commune des écrans synchronisés
    if (q.get("screens") === "1") out.screens = await activeScreens(a.id);
    return Response.json(out, { headers: { "cache-control": "no-store" } });
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
    const patch = { cfg: body?.cfg, paused: body?.paused };
    if (body?.cmd?.type === "show") {
      const id = String(body.cmd.photoId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Photo invalide." }, { status: 400 });
      const { data: p } = await getSupabaseAdmin().from("clicclac_photos")
        .select("id,path,thumb_path,guest_name,caption,kind,status").eq("id", id).eq("album_id", a.id).maybeSingle();
      if (!p || p.status !== "published") return Response.json({ error: "Photo introuvable ou pas encore publiée." }, { status: 404 });
      patch.action = { type: "show", photo: await livePhotoOf(p) };
    } else if (["next", "prev"].includes(body?.cmd?.type)) patch.action = { type: body.cmd.type };
    return Response.json({ ...(await updateLive(a.id, patch)), now: Date.now() });
  } catch (e) {
    console.error("clicclac live POST:", e);
    return Response.json({ error: "Commande impossible." }, { status: 502 });
  }
}
