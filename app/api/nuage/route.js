/*
 * Route PUBLIQUE — création d'un nuage de mots, sans compte (rattaché au compte
 * si Authorization: Bearer). Renvoie le code participant et le jeton
 * organisateur de l'appareil.
 */
import { createNuage, presenterToken } from "@/lib/nuageServer";
import { userOf } from "@/lib/timerServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";
import { MAX_QUESTION_LEN, normalizeMax } from "@/lib/nuage";

export const runtime = "nodejs";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const question = String(body?.question || "").trim().slice(0, MAX_QUESTION_LEN);
  if (!question) return Response.json({ error: "Merci d'indiquer une question." }, { status: 400 });
  try {
    if (await tooMany(`nuage:new:${clientIp(req)}`, 30, 3600))
      return Response.json({ error: "Trop de nuages créés : réessayez dans une heure." }, { status: 429 });
    const user = await userOf(req);
    const s = await createNuage({ question, max_per_participant: normalizeMax(body?.maxPerParticipant), owner_id: user?.id || null });
    return Response.json({ code: s.code, adminToken: presenterToken(s) });
  } catch (e) {
    console.error("nuage create:", e);
    return Response.json({ error: "Création impossible." }, { status: 502 });
  }
}
