/* Organisateur — réglages de l'album (clés « admin » uniquement ; quotas = super-admin)
 * et nom de l'album : PATCH { settings?, name? }. */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAlbum, roleFor, canAdmin } from "@/lib/clicclac/server";
import { normalizeSettings, ADMIN_KEYS, MAX_NAME } from "@/lib/clicclac/settings";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    if (!canAdmin(roleFor(req, a))) return Response.json({ error: "Accès refusé." }, { status: 401 });
    const next = { ...a.settings };
    for (const k of ADMIN_KEYS) if (body?.settings?.[k] !== undefined) next[k] = body.settings[k];
    const settings = normalizeSettings(next);
    const patch = { settings };
    if (body?.name !== undefined) {
      const n = String(body.name).normalize("NFC").trim().slice(0, MAX_NAME);
      if (!n) return Response.json({ error: "Le nom de l'album ne peut pas être vide." }, { status: 400 });
      patch.name = n;
    }
    const { error } = await getSupabaseAdmin().from("clicclac_albums").update(patch).eq("id", a.id);
    if (error) throw error;
    return Response.json({ ok: true, settings, name: patch.name || a.name });
  } catch (e) {
    console.error("clicclac settings:", e);
    return Response.json({ error: "Enregistrement impossible." }, { status: 502 });
  }
}
