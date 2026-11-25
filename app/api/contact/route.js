/*
 * Formulaire de contact : POST { id, kind, app, name, email, message, device, web (piège), ms }.
 * Enregistré avant tout e-mail ; base injoignable : l'alerte part quand même à contact@.
 */
import { after } from "next/server";
import { cleanContact, refOf } from "@/lib/contact";
import { saveMessage, afterSave, notify } from "@/lib/contactServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  if (b?.web) return Response.json({ ok: true }); // robot
  const { row, error, field } = cleanContact(b);
  if (error) return Response.json({ error, field }, { status: 400 });
  if (!(Number(b.ms) >= 2000)) return Response.json({ error: "Encore un instant… appuyez de nouveau sur Envoyer." }, { status: 400 });
  if (await tooMany(`contact:ip:${clientIp(req)}`, 15, 3600)) return Response.json({ error: "Beaucoup de messages viennent de votre connexion. Réessayez dans une heure, ou écrivez-nous par e-mail." }, { status: 429 });
  try {
    const { num, again } = await saveMessage(row);
    if (!again) after(() => afterSave(row, num));
    return Response.json({ ok: true, ref: refOf(num) });
  } catch (e) {
    console.error("contact save:", e?.message || e);
    try {
      if (await tooMany("contact:alert", 60, 86400)) throw new Error("limite d'alertes");
      await notify(row, null);
      return Response.json({ ok: true });
    } catch (e2) {
      console.error("contact fallback:", e2?.message || e2);
      return Response.json({ error: "L'envoi n'a pas marché. Votre message est gardé sur cette page : réessayez dans un instant." }, { status: 502 });
    }
  }
}
