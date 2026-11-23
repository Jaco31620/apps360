/*
 * Ami Invisible — super-admin (mot de passe commun Clic-Clac / Jukebox).
 * POST { action, … } ; hors « login », en-tête x-ai-super (jeton signé).
 *  - login { password }                 → { token }
 *  - list                               → tous les tirages (organisateur, date, envois), sans les paires
 *  - get { userId, id }                 → un tirage : participants, envois, journal (paires masquées)
 *  - reveal { userId, id }              → paires (affichage volontaire, tracé au journal)
 *  - send { userId, id, index }         → renvoi du résultat par e-mail à un participant
 *  - edit { userId, id, index, person } → correction d'un participant (e-mail, nom…), partout dans le tirage
 *  - link { userId, id, index }         → lien personnel du participant (à envoyer par SMS…), tracé
 * Lecture seulement à la demande (ouverture, bouton Actualiser) : aucun rafraîchissement automatique.
 */
import { LIMITS, cleanPerson, fillMessage, publicTirage } from "@/lib/amiInvisible";
import {
  isAmiSuper, checkSuperPassword, superToken, allTirages, loadTirages, saveTirages,
  sendPairs, logAction, pairLink, organizerEmail,
} from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const json = (body, status = 200) => Response.json(body, { status });
const sameId = (a, b) => String(a) === String(b);
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ""));

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    if (body?.action === "login") {
      // même compteur que les autres super-admins (mot de passe commun)
      if (await tooMany(`super:${clientIp(req)}`, 10, 900)) return json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, 429);
      if (!(await checkSuperPassword(body.password))) {
        await new Promise((r) => setTimeout(r, 600));
        return json({ error: "Mot de passe incorrect." }, 401);
      }
      return json({ token: superToken() });
    }
    if (!isAmiSuper(req)) return json({ error: "Session expirée." }, 401);
    if (body?.action === "list") return json({ tirages: await allTirages() });

    if (!isUuid(body?.userId)) return json({ error: "Tirage introuvable." }, 404);
    const tirages = await loadTirages(body.userId);
    const tirage = tirages.find((t) => sameId(t.id, body.id));
    if (!tirage) return json({ error: "Tirage introuvable." }, 404);
    const index = body.index;
    const needPair = ["send", "edit", "link"].includes(body.action);
    if (needPair && !(Number.isInteger(index) && tirage.pairs[index])) return json({ error: "Participant introuvable." }, 404);
    const view = () => ({ ...publicTirage(tirage), journal: tirage.journal || [] });

    switch (body.action) {
      case "get":
        return json({ tirage: view(), organizer: await organizerEmail(body.userId) });

      case "reveal":
        logAction(tirage, "super-admin", "reveal");
        await saveTirages(body.userId, tirages);
        return json({
          tirage: view(),
          pairs: tirage.pairs.map((p) => ({ receveur: p.receveur, message: fillMessage(tirage.template, p.offreur, p.receveur) })),
        });

      case "send": {
        if ((tirage.pairs[index].sends || 0) >= LIMITS.sendsPerPair * 2) return json({ error: "Trop d'envois pour ce participant." }, 429);
        const r = await sendPairs(tirage, [index]);
        if (!r.sent.length) return json({ error: "Échec de l'envoi." }, 502);
        logAction(tirage, "super-admin", "send", index);
        await saveTirages(body.userId, tirages);
        return json({ tirage: view() });
      }

      case "edit": {
        const before = tirage.pairs[index].offreur;
        const next = cleanPerson({ ...body.person, id: before.id });
        if (!next) return json({ error: "Prénom et e-mail valide requis." }, 400);
        for (const p of tirage.pairs) {
          if (sameId(p.offreur.id, before.id)) p.offreur = next;
          if (sameId(p.receveur.id, before.id)) p.receveur = next;
        }
        if (next.email !== before.email) { tirage.pairs[index].sentAt = null; } // nouvelle adresse : à renvoyer
        logAction(tirage, "super-admin", "edit", index);
        await saveTirages(body.userId, tirages);
        return json({ tirage: view() });
      }

      case "link":
        logAction(tirage, "super-admin", "link", index);
        await saveTirages(body.userId, tirages);
        return json({ tirage: view(), url: pairLink(body.userId, tirage.id, index) });

      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("ami-invisible super:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
