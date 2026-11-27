/*
 * Route PUBLIQUE — accès organisateur d'un appareil. Body : { pin } (code
 * organisateur), { pass } (QR à usage unique) ou {} avec Authorization: Bearer
 * (compte propriétaire). Réponse : { token } (30 jours, propre à l'appareil).
 */
import { loadSession, presenterToken, checkPresenterCode, usePass, overLimit } from "@/lib/nuageServer";
import { userOf } from "@/lib/timerServer";
import { clientIp } from "@/lib/jukeboxRate";
import { metered } from "@/lib/usageMeter";

export const runtime = "nodejs";

const fail = (error, status) => Response.json({ error }, { status });

async function POST_(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return fail("Requête invalide.", 400); }
  try {
    const s = await loadSession(code);
    if (!s) return fail("Nuage introuvable.", 404);
    if (body?.pin || body?.pass) {
      // par adresse et par nuage : un inconnu ne peut pas bloquer l'organisateur
      if (await overLimit(`nuage:pin:${s.id}:${clientIp(req)}`, 20, 600))
        return fail("Trop d'essais : réessayez dans 10 minutes.", 429);
      const ok = body.pin ? checkPresenterCode(body.pin, s) : await usePass(s, body.pass);
      if (!ok) return body.pin ? fail("Code organisateur incorrect.", 403)
        : fail("Ce QR code a déjà servi ou a expiré : demandez-en un nouveau.", 410);
    } else {
      const user = await userOf(req);
      if (!user || user.id !== s.owner_id) return fail("Accès refusé.", 403);
    }
    return Response.json({ token: presenterToken(s) });
  } catch (e) {
    console.error("nuage join:", e);
    return fail("Connexion impossible, réessayez.", 502);
  }
}

// mesure de consommation (lib/usageMeter.js)
export const POST = metered(POST_);
