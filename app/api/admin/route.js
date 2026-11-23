/*
 * Backoffice apps360 (/admin) — connexion unique.
 *  - { password } : mot de passe super-admin commun (Clic-Clac / Jukebox) →
 *    jeton backoffice (7 jours) + jetons des super-admins Jukebox, Clic-Clac
 *    et Ami Invisible.
 *  - { token } (jeton backoffice valide) : nouveaux jetons des super-admins,
 *    demandés seulement quand celui de l'appareil a expiré (au clic sur un lien).
 * Aucune lecture en base hors vérification du mot de passe.
 */
import { checkMasterPassword, signToken, verifyToken } from "@/lib/clicclac/server";
import { superToken as jukeboxSuperToken } from "@/lib/jukeboxAdmin";
import { superToken as amiSuperToken } from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const SCOPE = "apps360:admin";
const DAY = 24 * 3600 * 1000;

const appTokens = () => ({ jukebox: jukeboxSuperToken(), clicclac: signToken("super"), ami: amiSuperToken() });

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    if (typeof body?.token === "string") {
      if (verifyToken(body.token)?.scope !== SCOPE) return Response.json({ error: "Session expirée." }, { status: 401 });
      return Response.json(appTokens());
    }
    // même compteur que les super-admins Jukebox et Clic-Clac (mot de passe commun)
    if (await tooMany(`super:${clientIp(req)}`, 10, 900))
      return Response.json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, { status: 429 });
    if (!(await checkMasterPassword(body?.password))) {
      await new Promise((r) => setTimeout(r, 600)); // ralentit les essais
      return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
    }
    return Response.json({ token: signToken(SCOPE, 7 * DAY), ...appTokens() });
  } catch (e) {
    console.error("admin login:", e);
    return Response.json({ error: "Connexion impossible." }, { status: 502 });
  }
}
