/*
 * Ami Invisible — lien « Conserver 12 mois de plus » de l'e-mail d'inactivité.
 * POST { t } (jeton signé, 90 jours) → { until } ; appelé par la page
 * /ami-invisible/prolonger une fois affichée (les robots des messageries qui
 * se contentent de télécharger le lien ne prolongent rien).
 */
import { keepOrganizer } from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    if (await tooMany(`ai:keep:${clientIp(req)}`, 30, 600)) return Response.json({ error: "Trop de requêtes. Réessayez dans quelques minutes." }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const r = await keepOrganizer(body?.t);
    if (!r) return Response.json({ error: "invalid" }, { status: 404 });
    return Response.json(r);
  } catch (e) {
    console.error("ami-invisible keep:", e);
    return Response.json({ error: "Service momentanément indisponible." }, { status: 502 });
  }
}
