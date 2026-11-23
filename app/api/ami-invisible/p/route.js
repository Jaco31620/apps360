/*
 * Ami Invisible — page personnelle d'un participant (lien /ami-invisible/p/<token>).
 * POST { action, token, … } :
 *  - view           → événement (nom, date, lieu, budget, ton, organisateur), état
 *  - reveal         → son résultat (message) + listes de souhaits si l'option est active ;
 *                     la 1re fois, note « ouvert » (appel fait par le navigateur une fois la
 *                     page affichée : les robots qui ne font que télécharger le lien ne comptent pas)
 *  - wishlist { text } → enregistre sa liste de souhaits
 *  - erase          → supprime ses coordonnées (e-mail) partout chez cet organisateur
 *                     (tirages, brouillons, carnet) et le prévient par e-mail
 */
import { cleanWishlist, fillMessage, wishlistExpired } from "@/lib/amiInvisible";
import { byToken, participantById, updateParticipant, updateTirage, withLog, notifyErase, eraseEverywhere } from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    if (await tooMany(`ai:p:${clientIp(req)}`, 200, 600)) return json({ error: "Trop de requêtes. Réessayez dans quelques minutes." }, 429);
    const found = await byToken(body?.token);
    if (!found) return json({ error: "invalid" }, 404);
    const { p, t } = found;
    const o = t.options || {};
    const event = {
      name: t.name, tone: o.tone || "tu", date: o.date || "", place: o.place || "", budget: o.budget || "",
      organizer: o.organizerName || "", wishlist: !!o.wishlist && !wishlistExpired(o, t.drawn_at),
      wishlistOver: !!o.wishlist && wishlistExpired(o, t.drawn_at),
    };
    const me = { prenom: p.prenom, erased: !!p.erased_at };

    switch (body.action) {
      case "view":
        return json({ event, me });

      case "reveal": {
        const r = p.receiver_id ? await participantById(p.receiver_id) : null;
        if (!r) return json({ error: "invalid" }, 404);
        if (!p.opened_at) await updateParticipant(p.id, { opened_at: new Date().toISOString() });
        return json({
          event, me,
          receiver: { prenom: r.prenom, nom: r.nom },
          message: fillMessage(t.template, p, r),
          ...(event.wishlist ? { receiverWishlist: r.wishlist || "", myWishlist: p.wishlist || "" } : {}),
        });
      }

      case "wishlist": {
        if (!event.wishlist) return json({ error: event.wishlistOver ? "L'échange est passé : les listes de souhaits ont été effacées." : "La liste de souhaits n'est pas activée pour ce tirage." }, 409);
        const text = cleanWishlist(body.text);
        await updateParticipant(p.id, { wishlist: text || null, wishlist_at: new Date().toISOString() });
        return json({ ok: true, myWishlist: text });
      }

      case "erase": {
        if (p.erased_at) return json({ ok: true });
        await updateParticipant(p.id, { email: null, erased_at: new Date().toISOString() });
        if (p.email) await eraseEverywhere(t.user_id, p.email);
        await updateTirage(t.id, { journal: withLog(t, "participant", "erase", { prenom: p.prenom }) });
        await notifyErase(t, p).catch((e) => console.error("ami-invisible notify:", e));
        return json({ ok: true });
      }

      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("ami-invisible p:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
