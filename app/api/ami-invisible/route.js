/*
 * Ami Invisible — organisateur (compte apps360 obligatoire).
 * POST { action, … } avec Authorization: Bearer <jeton de session Supabase>.
 *  - load                       → { carnet, tirages } (sans les paires)
 *  - carnet { carnet }          → enregistre le carnet
 *  - draw { eventName, participants, exclusions, template, replaceId? }
 *                               → tirage fait ET gardé ici ; le navigateur ne
 *                                 reçoit que la liste des participants.
 *                                 replaceId : « Refaire » (si rien n'est envoyé)
 *  - send { id, index? }        → envoi à tous ceux qui n'ont rien reçu, ou à un seul (renvoi)
 *  - delete { id }
 *  - reveal { id, password }    → paires du tirage, mot de passe super-admin, tracé au journal
 */
import {
  LIMITS, cleanPerson, cleanCarnet, cleanTemplate, drawPairs, fillMessage, publicTirage,
} from "@/lib/amiInvisible";
import {
  userOf, loadTirages, saveTirages, loadCarnet, saveCarnet, sendPairs, logAction, checkSuperPassword,
} from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const json = (body, status = 200) => Response.json(body, { status });
const sameId = (a, b) => String(a) === String(b);

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    const user = await userOf(req);
    if (!user) return json({ error: "Session expirée : reconnectez-vous." }, 401);
    const uid = user.id;

    switch (body?.action) {
      case "load": {
        const [carnet, tirages] = await Promise.all([loadCarnet(uid), loadTirages(uid)]);
        return json({ carnet, tirages: tirages.map(publicTirage) });
      }

      case "carnet": {
        const carnet = cleanCarnet(body.carnet);
        await saveCarnet(uid, carnet);
        return json({ carnet });
      }

      case "draw": {
        if (await tooMany(`ai:draw:${uid}`, 60, 86400)) return json({ error: "Trop de tirages aujourd'hui. Réessayez demain." }, 429);
        const eventName = String(body.eventName || "").trim().slice(0, LIMITS.field);
        if (!eventName) return json({ error: "Nommez l'événement avant de tirer." }, 400);
        const raw = Array.isArray(body.participants) ? body.participants : [];
        if (raw.length > LIMITS.participants) return json({ error: `${LIMITS.participants} participants au maximum.` }, 400);
        const participants = raw.map(cleanPerson);
        if (participants.some((p) => !p)) return json({ error: "Chaque participant doit avoir un prénom et un e-mail valide." }, 400);
        if (new Set(participants.map((p) => String(p.id))).size !== participants.length) return json({ error: "Participants en double." }, 400);
        if (participants.length < 2) return json({ error: "Il faut au moins 2 participants." }, 400);
        const exclusions = (Array.isArray(body.exclusions) ? body.exclusions : []).slice(0, 2000);
        const result = drawPairs(participants, exclusions);
        if (!result) return json({ error: "Impossible de trouver une combinaison valide. Réduisez les exclusions." }, 422);

        const tirages = await loadTirages(uid);
        let keep = tirages;
        if (body.replaceId !== undefined && body.replaceId !== null) {
          const old = tirages.find((t) => sameId(t.id, body.replaceId));
          if (old?.pairs?.some((p) => p.sentAt)) return json({ error: "Des résultats ont déjà été envoyés : faites un nouveau tirage." }, 409);
          keep = tirages.filter((t) => !sameId(t.id, body.replaceId));
        }
        const tirage = {
          v: 2,
          id: Date.now(),
          eventName,
          date: new Date().toISOString(),
          template: cleanTemplate(body.template),
          pairs: participants.map((g, i) => ({ offreur: g, receveur: participants[result[i]] })),
        };
        await saveTirages(uid, [tirage, ...keep]);
        return json({ tirage: publicTirage(tirage) });
      }

      case "send": {
        const tirages = await loadTirages(uid);
        const tirage = tirages.find((t) => sameId(t.id, body.id));
        if (!tirage) return json({ error: "Tirage introuvable." }, 404);
        const one = Number.isInteger(body.index);
        if (one && !tirage.pairs[body.index]) return json({ error: "Participant introuvable." }, 404);
        const indexes = one ? [body.index] : tirage.pairs.map((p, i) => (p.sentAt ? -1 : i)).filter((i) => i >= 0);
        if (!indexes.length) return json({ tirage: publicTirage(tirage), sent: [], failed: [] });
        if (indexes.some((i) => (tirage.pairs[i].sends || 0) >= LIMITS.sendsPerPair))
          return json({ error: `Ce résultat a déjà été envoyé ${LIMITS.sendsPerPair} fois. Contactez-nous si besoin : contact@apps360.fr` }, 429);
        if (await tooMany(`ai:send:${uid}`, 300, 86400)) return json({ error: "Trop d'envois aujourd'hui. Réessayez demain." }, 429);
        const r = await sendPairs(tirage, indexes);
        if (r.sent.length) await saveTirages(uid, tirages);
        return json({ tirage: publicTirage(tirage), ...r });
      }

      case "delete": {
        const tirages = await loadTirages(uid);
        await saveTirages(uid, tirages.filter((t) => !sameId(t.id, body.id)));
        return json({ ok: true });
      }

      case "reveal": {
        if (await tooMany(`super:${clientIp(req)}`, 10, 900)) return json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, 429);
        if (!(await checkSuperPassword(body.password))) {
          await new Promise((r) => setTimeout(r, 600));
          return json({ error: "Mot de passe incorrect." }, 401);
        }
        const tirages = await loadTirages(uid);
        const tirage = tirages.find((t) => sameId(t.id, body.id));
        if (!tirage) return json({ error: "Tirage introuvable." }, 404);
        logAction(tirage, "organisateur", "reveal");
        await saveTirages(uid, tirages);
        return json({ pairs: tirage.pairs.map((p) => ({ receveur: p.receveur, message: fillMessage(tirage.template, p.offreur, p.receveur) })) });
      }

      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("ami-invisible:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
