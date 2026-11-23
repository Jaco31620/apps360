/*
 * Photos d'un album.
 * - GET  : galerie (publiées ; + en attente pour l'organisateur), liens signés
 *          1 h vers miniature et version standard (+ HD pour l'organisateur).
 *          ?guest=<id> marque les photos de cet invité (« mine »).
 *          ?meta=1     → liste SANS liens (léger : sert au rafraîchissement) ;
 *          ?ids=a,b,…  → liens uniquement pour ces photos (≤ 200).
 *          Le navigateur ne demande ainsi des liens que pour les nouvelles photos.
 * - POST : envoi (multipart) — full (JPEG ≈2048 px), thumb (JPEG ≈480 px),
 *          guestId, guestName, caption, kind.
 *          Quotas : capacité de l'album (tous) + quota par invité (sauf borne /
 *          organisateur). La HD arrive ensuite, à part : POST [id]/hd.
 *          Modération : en attente sauf borne / organisateur.
 */
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAlbum, roleFor, canAdmin, signUrls, bumpPhotos, putFile, removeFiles, sniffImage, fetchAll, livePhotoOf } from "@/lib/clicclac/server";
import { MAX_NAME, MAX_CAPTION } from "@/lib/clicclac/settings";
import { announce } from "@/lib/clicclac/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validGuest = (g) => /^[a-z0-9-]{8,64}$/i.test(String(g || ""));
const LIMITS = { full: 3 * 1024 * 1024, thumb: 400 * 1024, hd: 4.3 * 1024 * 1024 };

export async function GET(req, { params }) {
  const { code } = await params;
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    const role = roleFor(req, a);
    const admin = canAdmin(role);
    const url = new URL(req.url);
    const guest = url.searchParams.get("guest");
    const meta = url.searchParams.get("meta") === "1";
    const ids = url.searchParams.get("ids") ? [...new Set(url.searchParams.get("ids").split(","))].filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 200) : null;
    // liste seule (meta) : sans les chemins des fichiers ; ids : seulement ces photos
    const cols = meta ? "id,guest_id,guest_name,caption,kind,source,status,created_at"
      : "id,path,thumb_path,hd_path,guest_id,guest_name,caption,kind,source,status,created_at";
    const query = () => {
      let q = getSupabaseAdmin().from("clicclac_photos").select(cols).eq("album_id", a.id);
      if (!admin) q = q.eq("status", "published");
      return q.order("created_at", { ascending: false }).order("id");
    };
    let rows;
    if (ids) {
      if (!ids.length) rows = [];
      else { const { data, error } = await query().in("id", ids); if (error) throw error; rows = data; }
    } else rows = await fetchAll(query);
    const withHd = admin && url.searchParams.get("hd") === "1";
    const paths = meta ? [] : rows.flatMap((p) => [p.thumb_path, p.path, ...(withHd ? [p.hd_path || p.path] : [])]);
    const urls = meta ? [] : await signUrls(paths);
    const step = withHd ? 3 : 2;
    const photos = rows.map((p, i) => ({
      id: p.id,
      // accents en forme composée (é et non e + ◌́) : certaines polices placent mal l'accent séparé
      name: (p.guest_name || "").normalize("NFC"),
      caption: (p.caption || "").normalize("NFC"),
      kind: p.kind,
      source: p.source,
      status: p.status,
      createdAt: p.created_at,
      thumb: meta ? undefined : urls[i * step],
      full: meta ? undefined : urls[i * step + 1],
      ...(withHd ? { hd: urls[i * step + 2] } : {}),
      mine: validGuest(guest) && p.guest_id === guest,
    }));
    return Response.json({ photos }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("clicclac photos GET:", e);
    return Response.json({ error: "Chargement impossible." }, { status: 502 });
  }
}

export async function POST(req, { params }) {
  const { code } = await params;
  let form;
  try { form = await req.formData(); } catch (e) { return Response.json({ error: "Envoi invalide." }, { status: 400 }); }
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    const role = roleFor(req, a);
    const trusted = canAdmin(role) || role === "booth";
    const s = a.settings;
    if (!s.uploadsOpen && !canAdmin(role)) return Response.json({ error: "Les envois de photos sont fermés pour cet album." }, { status: 403 });
    const guestId = String(form.get("guestId") || "");
    if (!trusted && !validGuest(guestId)) return Response.json({ error: "Invité non identifié." }, { status: 400 });

    // fichiers
    const files = {};
    for (const k of ["full", "thumb", "hd"]) {
      const f = form.get(k);
      if (!f || typeof f.arrayBuffer !== "function") continue;
      if (f.size > LIMITS[k]) return Response.json({ error: "Photo trop lourde." }, { status: 413 });
      const buf = Buffer.from(await f.arrayBuffer());
      if (sniffImage(buf) !== "image/jpeg") return Response.json({ error: "Format de photo invalide." }, { status: 400 });
      files[k] = buf;
    }
    if (!files.full || !files.thumb) return Response.json({ error: "Photo manquante." }, { status: 400 });
    if (!s.keepHd) delete files.hd;

    const sb = getSupabaseAdmin();
    // identifiant fourni par le navigateur (file d'envoi) : un nouvel essai
    // après une réponse perdue ne crée pas de doublon
    const askedId = String(form.get("uploadId") || "").toLowerCase();
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(askedId) ? askedId : crypto.randomUUID();
    {
      const { data: dup } = await sb.from("clicclac_photos").select("album_id,status").eq("id", id).maybeSingle();
      if (dup) {
        if (dup.album_id !== a.id) return Response.json({ error: "Envoi invalide." }, { status: 400 });
        return Response.json({ ok: true, id, pending: dup.status === "pending", duplicate: true });
      }
    }
    // quotas
    const { count: total } = await sb.from("clicclac_photos").select("id", { count: "exact", head: true }).eq("album_id", a.id);
    if ((total || 0) >= s.maxPhotos) return Response.json({ error: "L'album est complet." }, { status: 429 });
    if (!trusted && s.guestQuota > 0) {
      const { count: mine } = await sb.from("clicclac_photos").select("id", { count: "exact", head: true }).eq("album_id", a.id).eq("guest_id", guestId);
      if ((mine || 0) >= s.guestQuota) return Response.json({ error: `Vous avez atteint votre limite de ${s.guestQuota} photos.` }, { status: 429 });
    }

    const base = `${a.id}/${id}`;
    const paths = { full: `${base}.jpg`, thumb: `${base}_t.jpg`, hd: files.hd ? `${base}_hd.jpg` : null };
    try {
      await putFile(paths.full, files.full, "image/jpeg");
      await putFile(paths.thumb, files.thumb, "image/jpeg");
      if (files.hd) await putFile(paths.hd, files.hd, "image/jpeg");
      const { error } = await sb.from("clicclac_photos").insert({
        id, album_id: a.id, path: paths.full, thumb_path: paths.thumb, hd_path: paths.hd,
        guest_id: validGuest(guestId) ? guestId : null,
        guest_name: String(form.get("guestName") || "").normalize("NFC").trim().slice(0, MAX_NAME) || null,
        caption: String(form.get("caption") || "").normalize("NFC").trim().slice(0, MAX_CAPTION) || null,
        kind: form.get("kind") === "strip" ? "strip" : "photo",
        source: role === "booth" ? "booth" : "guest",
        status: s.moderation && !trusted ? "pending" : "published",
        bytes: files.full.length + files.thumb.length + (files.hd?.length || 0),
      });
      if (error) throw error;
      await bumpPhotos(a.id);
    } catch (e) {
      // même envoi arrivé deux fois en parallèle : l'autre a gagné, ses fichiers
      // (mêmes chemins) ne doivent pas être effacés
      if (e?.code === "23505") return Response.json({ ok: true, id, pending: s.moderation && !trusted, duplicate: true });
      await removeFiles(Object.values(paths)).catch(() => {});
      throw e;
    }
    const pending = s.moderation && !trusted;
    if (!pending) { // nouvelle photo : en priorité sur les écrans (si l'option est active)
      await announce(a.id, { type: "fresh", photo: await livePhotoOf({ id, path: paths.full, thumb_path: paths.thumb,
        guest_name: String(form.get("guestName") || "").normalize("NFC").trim().slice(0, MAX_NAME), caption: String(form.get("caption") || "").normalize("NFC").trim().slice(0, MAX_CAPTION), kind: form.get("kind") === "strip" ? "strip" : "photo" }) });
    }
    return Response.json({ ok: true, id, pending });
  } catch (e) {
    console.error("clicclac photos POST:", e);
    return Response.json({ error: "Envoi impossible." }, { status: 502 });
  }
}
