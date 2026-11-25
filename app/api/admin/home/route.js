/*
 * Backoffice — réglage de la page d'accueil (état, étiquette, ordre des apps).
 * POST { token (backoffice), apps: [{ href, state, badge }] dans l'ordre } :
 * enregistre et rafraîchit les pages gardées en cache.
 */
import { revalidatePath } from "next/cache";
import { verifyToken } from "@/lib/clicclac/server";
import { apps } from "@/lib/apps";
import { applyHome, cleanHome } from "@/lib/homeConfig";
import { saveHome } from "@/lib/homeServer";

export const runtime = "nodejs";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    if (verifyToken(body?.token)?.scope !== "apps360:admin") return Response.json({ error: "Session expirée : reconnectez-vous." }, { status: 401 });
    const cfg = cleanHome(apps, body.apps);
    if (!cfg) return Response.json({ error: "La liste des apps a changé : rechargez la page." }, { status: 400 });
    await saveHome(cfg);
    for (const p of ["/", "/admin", ...apps.map((a) => a.href)]) revalidatePath(p);
    return Response.json({ apps: applyHome(apps, cfg) });
  } catch (e) {
    console.error("admin home:", e);
    return Response.json({ error: "Enregistrement impossible, réessayez." }, { status: 502 });
  }
}
