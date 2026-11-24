/*
 * Jumelage d'une télé (apps360.fr/tv) : la télé affiche un QR code portant
 * son identifiant de jumelage ; le téléphone qui le scanne choisit la soirée
 * (POST { id, code, token? }) ; la télé interroge (GET ?id=…&s=<secret>, l'id
 * étant l'empreinte du secret : seule la télé peut relire) et ouvre l'écran
 * d'affichage de la soirée. Avec le jeton régie (téléphone de la régie), la
 * télé passe en mode son : elle joue la musique. Rangé dans jukebox_config
 * (« tv:<id> »), effacé dès que la télé l'a lu ; ignoré après 10 minutes.
 * Clic-Clac : { app: "clicclac", code: <code album> } → la télé ouvre l'écran
 * live de l'album (affichage public, piloté depuis la télécommande Clic-Clac).
 * Le nom (soirée, album, question) est transmis à la télé : bouton « Reprendre ».
 * Nuage de mots : { app: "nuage", code } → écran d'affichage du nuage (public).
 */
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSession } from "@/lib/jukeboxServer";
import { adminAccess, createDevice } from "@/lib/jukeboxAccess";
import { isValidCode } from "@/lib/jukebox";
import { logEvent } from "@/lib/jukeboxEvents";
import { loadAlbum } from "@/lib/clicclac/server";
import { loadSession as loadNuage } from "@/lib/nuageServer";
import { normalizeCode, isAlbumCode } from "@/lib/clicclac/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL = 10 * 60e3;
const validId = (id) => /^[a-z0-9]{8,16}$/.test(String(id || ""));

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const secret = String(url.searchParams.get("s") || "");
  if (!validId(id)) return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  if (!/^[a-f0-9]{32}$/.test(secret) || createHash("sha256").update(secret).digest("hex").slice(0, 12) !== id)
    return Response.json({ error: "Télé non reconnue : rechargez la page." }, { status: 403 });
  // lu et effacé d'un coup : une seule lecture possible
  const { data: rows } = await getSupabaseAdmin().from("jukebox_config").delete().eq("key", `tv:${id}`).select("value");
  const data = rows?.[0];
  if (!data) return Response.json({ code: null });
  let v = null;
  try { v = JSON.parse(data.value); } catch (e) { /* valeur illisible */ }
  if (!v || Date.now() - v.at >= TTL) return Response.json({ code: null });
  return Response.json({ code: v.code, token: v.token || null, app: v.app || "jukebox", name: v.name || "" });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const { id, code, token } = body || {};
  if (body?.app === "clicclac") {
    const c = normalizeCode(code);
    if (!validId(id) || !isAlbumCode(c)) return Response.json({ error: "Requête invalide." }, { status: 400 });
    try {
      const a = await loadAlbum(c);
      if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
      const { error } = await getSupabaseAdmin().from("jukebox_config")
        .upsert({ key: `tv:${id}`, value: JSON.stringify({ app: "clicclac", code: c, name: a.name, at: Date.now() }) });
      if (error) throw error;
      return Response.json({ ok: true });
    } catch (e) {
      console.error("clicclac tv:", e);
      return Response.json({ error: "Jumelage impossible." }, { status: 502 });
    }
  }
  if (body?.app === "nuage") {
    if (!validId(id) || !/^\d{6}$/.test(String(code || ""))) return Response.json({ error: "Requête invalide." }, { status: 400 });
    try {
      const n = await loadNuage(code);
      if (!n) return Response.json({ error: "Nuage introuvable." }, { status: 404 });
      const { error } = await getSupabaseAdmin().from("jukebox_config")
        .upsert({ key: `tv:${id}`, value: JSON.stringify({ app: "nuage", code: String(code), name: n.question, at: Date.now() }) });
      if (error) throw error;
      return Response.json({ ok: true });
    } catch (e) {
      console.error("nuage tv:", e);
      return Response.json({ error: "Jumelage impossible." }, { status: 502 });
    }
  }
  if (!validId(id) || !isValidCode(code)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    const s = await loadSession(code);
    if (!s) return Response.json({ error: "Soirée introuvable." }, { status: 404 });
    // mode son : la télé devient un appareil autorisé, avec son propre jeton
    let tvToken = null;
    if (token) {
      if (!(await adminAccess({ headers: new Headers({ "x-jukebox-admin": String(token) }) }, s)).ok)
        return Response.json({ error: "Accès régie refusé." }, { status: 403 });
      // anciennes télés jumelées qui ne se sont plus manifestées depuis 12 h : retirées (la liste ne s'allonge plus)
      await getSupabaseAdmin().from("jukebox_devices").delete().eq("session_id", s.id).eq("label", "Télé (mode son)")
        .lt("last_seen", new Date(Date.now() - 12 * 3600e3).toISOString());
      tvToken = await createDevice(s.id, "Télé (mode son)");
    }
    const { error } = await getSupabaseAdmin().from("jukebox_config")
      .upsert({ key: `tv:${id}`, value: JSON.stringify({ code, name: s.name, at: Date.now(), ...(tvToken ? { token: tvToken } : {}) }) });
    if (error) throw error;
    await logEvent(s.id, "tv_pair", null, { sound: tvToken ? "avec le son" : "affichage seul" });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("jukebox tv:", e);
    return Response.json({ error: "Jumelage impossible." }, { status: 502 });
  }
}
