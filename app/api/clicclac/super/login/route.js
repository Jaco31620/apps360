/* Super-admin Clic-Clac : mot de passe → jeton « super » (12 h). */
import { checkMasterPassword, signToken } from "@/lib/clicclac/server";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    // même compteur que le super-admin Jukebox (mot de passe commun)
    if (await tooMany(`super:${clientIp(req)}`, 10, 900))
      return Response.json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, { status: 429 });
    if (!(await checkMasterPassword(body?.password))) {
      await new Promise((r) => setTimeout(r, 600)); // ralentit les essais
      return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
    }
    return Response.json({ token: signToken("super") });
  } catch (e) {
    console.error("clicclac super login:", e);
    return Response.json({ error: "Connexion impossible." }, { status: 502 });
  }
}
