/* Lien « Conserver 6 mois de plus » de l'alerte avant purge : POST { t }, envoyé
 * sur un clic (les robots des messageries ne prolongent rien). */
import { prolong } from "@/lib/nuageServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    if (await tooMany(`nuage:keep:${clientIp(req)}`, 30, 600)) return Response.json({ error: "Trop de requêtes." }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const r = await prolong(body?.t);
    return r ? Response.json(r) : Response.json({ error: "Ce lien n'est plus valable." }, { status: 404 });
  } catch (e) {
    console.error("nuage keep:", e);
    return Response.json({ error: "Service momentanément indisponible." }, { status: 502 });
  }
}
