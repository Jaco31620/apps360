/*
 * Authentification d'album.
 *  - { pin }   → jeton organisateur (7 jours sur l'appareil)
 *  - { join }  → idem, avec un passe de connexion (QR « sur mon téléphone » ou
 *                lien envoyé par le super-admin) au lieu du code organisateur
 *  - { pass }  → (organisateur connecté) crée un passe : usage unique, 10 min ;
 *                { pass, long: true } (super-admin) : lien réutilisable 7 jours
 *  - { booth } → (organisateur connecté) jeton de borne pour cet appareil (7 jours)
 * Les jetons portent l'empreinte du code organisateur : le régénérer les annule.
 */
import { loadAlbum, checkPin, roleFor, canAdmin, albumToken, boothTokenFor, createPass, usePass, ADMIN_TTL } from "@/lib/clicclac/server";
import { tooMany, clientIp } from "@/lib/jukeboxRate";
import { metered } from "@/lib/usageMeter";

export const runtime = "nodejs";

async function POST_(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    const a = await loadAlbum(code);
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    const role = roleFor(req, a);
    if (body?.booth) {
      if (!canAdmin(role)) return Response.json({ error: "Accès refusé." }, { status: 401 });
      return Response.json({ token: boothTokenFor(a) });
    }
    if (body?.pass) {
      if (!canAdmin(role)) return Response.json({ error: "Accès refusé." }, { status: 401 });
      const long = !!body.long && role === "super";
      const ttlMs = long ? ADMIN_TTL : 10 * 60 * 1000;
      const nonce = await createPass(a, { ttlMs, multi: long });
      return Response.json({ pass: nonce, expiresAt: new Date(Date.now() + ttlMs).toISOString() });
    }
    // essais : par appareil, et par album (essais répartis)
    if (await tooMany(`ccpin:${clientIp(req)}`, 15, 900) || await tooMany(`ccpin-album:${a.id}`, 60, 3600))
      return Response.json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, { status: 429 });
    if (body?.join) {
      if (!(await usePass(a, body.join))) {
        await new Promise((r) => setTimeout(r, 600));
        return Response.json({ error: "Lien de connexion expiré ou déjà utilisé : demandez-en un nouveau, ou saisissez le code organisateur." }, { status: 401 });
      }
      return Response.json({ token: albumToken(a) });
    }
    if (!checkPin(body?.pin, a.admin_hash)) {
      await new Promise((r) => setTimeout(r, 600));
      return Response.json({ error: "Code organisateur incorrect." }, { status: 401 });
    }
    return Response.json({ token: albumToken(a) });
  } catch (e) {
    console.error("clicclac auth:", e);
    return Response.json({ error: "Connexion impossible." }, { status: 502 });
  }
}

// mesure de consommation (lib/usageMeter.js)
export const POST = metered(POST_);
