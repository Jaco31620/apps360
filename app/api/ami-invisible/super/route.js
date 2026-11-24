/*
 * Ami Invisible — super-admin (mot de passe commun Clic-Clac / Jukebox).
 * POST { action, … } ; hors « login », en-tête x-ai-super (jeton signé).
 *  - login { password }                       → { token }
 *  - list                                     → tous les tirages (organisateur, activité, envois, ouvertures)
 *  - find { q }                              → participants trouvés, par tirage
 *  - get { id }                               → un tirage : participants, envois, ouvertures, journal (paires masquées)
 *  - reveal { id }                            → paires (affichage volontaire, tracé au journal)
 *  - send { id, participantId }               → renvoi du lien personnel par e-mail
 *  - edit { id, participantId, person, send? } → correction (nom, e-mail) ; nouvel e-mail = nouveau lien ; send: true → renvoi
 *  - delete { id }                            → suppression d'un tirage
 * Lecture seulement à la demande (ouverture, bouton Actualiser).
 */
import { LIMITS, cleanPerson } from "@/lib/amiInvisible";
import {
  isAmiSuper, checkSuperPassword, superToken, tirageSummaries, organizersById, getTirage, participantsOf,
  tirageView, updateTirage, withLog, sendLinks, updateParticipant, deleteTirage, changeEmail, findParticipants,
} from "@/lib/amiInvisibleServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    if (body?.action === "login") {
      if (await tooMany(`super:${clientIp(req)}`, 10, 900)) return json({ error: "Trop d'essais. Réessayez dans 15 minutes." }, 429);
      if (!(await checkSuperPassword(body.password))) {
        await new Promise((r) => setTimeout(r, 600));
        return json({ error: "Mot de passe incorrect." }, 401);
      }
      return json({ token: superToken() });
    }
    if (!isAmiSuper(req)) return json({ error: "Session expirée." }, 401);

    if (body?.action === "list") {
      const [tirages, orgs] = await Promise.all([tirageSummaries(null), organizersById()]);
      return json({ tirages: tirages.map((t) => ({ ...t, organizer: orgs[t.userId]?.email || null, lastActive: orgs[t.userId]?.last_active_at || null })) });
    }

    if (body?.action === "find") return json({ found: await findParticipants(String(body.q || "").slice(0, 120)) });

    const t = await getTirage(body?.id);
    if (!t) return json({ error: "Tirage introuvable." }, 404);
    const parts = t.status === "drawn" ? await participantsOf(t.id) : [];
    const part = body.participantId ? parts.find((p) => p.id === body.participantId) : null;
    if (["send", "edit"].includes(body.action) && !part) return json({ error: "Participant introuvable." }, 404);
    const orgs = await organizersById();
    const view = async (tt = t) => ({
      ...tirageView(tt, tt.status === "drawn" ? await participantsOf(tt.id) : [], { links: true }),
      journal: tt.journal || [],
      organizer: orgs[t.user_id]?.email || null,
      lastActive: orgs[t.user_id]?.last_active_at || null,
    });

    switch (body.action) {
      case "get":
        return json({ tirage: await view() });

      case "reveal": {
        if (t.status !== "drawn") return json({ error: "Tirage pas encore fait." }, 409);
        const saved = await updateTirage(t.id, { journal: withLog(t, "super-admin", "reveal") });
        const byId = new Map(parts.map((p) => [p.id, p]));
        return json({
          tirage: await view(saved),
          pairs: Object.fromEntries(parts.map((p) => [p.id, { prenom: byId.get(p.receiver_id)?.prenom || "", nom: byId.get(p.receiver_id)?.nom || "" }])),
        });
      }

      case "send": {
        if (!part.email) return json({ error: "Cette personne a supprimé ses coordonnées." }, 409);
        if ((part.sends || 0) >= LIMITS.sendsPerPair * 2) return json({ error: "Trop d'envois pour ce participant." }, 429);
        const r = await sendLinks(t, [part]);
        if (!r.sent.length) return json({ error: "Échec de l'envoi." }, 502);
        const saved = await updateTirage(t.id, { journal: withLog(t, "super-admin", "send", { prenom: part.prenom }) });
        return json({ tirage: await view(saved) });
      }

      case "edit": {
        if (part.erased_at && body.person?.email) return json({ error: "Cette personne a demandé la suppression de ses coordonnées : son e-mail ne peut pas être ressaisi." }, 409);
        const next = part.erased_at
          ? { prenom: String(body.person?.prenom || "").trim().slice(0, LIMITS.field), nom: String(body.person?.nom || "").trim().slice(0, LIMITS.field) }
          : cleanPerson({ ...body.person, key: part.id });
        if (!next || !next.prenom) return json({ error: "Prénom et e-mail valide requis." }, 400);
        const moved = !part.erased_at && next.email !== part.email;
        if (moved && parts.some((p) => p.id !== part.id && p.email === next.email)) return json({ error: "Cette adresse est déjà celle d'un autre participant." }, 409);
        if (body.send && (part.sends || 0) >= LIMITS.sendsPerPair * 2) return json({ error: "Trop d'envois pour ce participant." }, 429);
        await updateParticipant(part.id, { prenom: next.prenom, nom: next.nom });
        let cur = t;
        if (moved) cur = (await changeEmail(t, part, next.email)).tirage;
        cur = await updateTirage(t.id, { journal: withLog(cur, "super-admin", "edit", { prenom: next.prenom }) });
        let mailFailed = false;
        if (body.send && !part.erased_at) {
          const fresh = (await participantsOf(t.id)).find((p) => p.id === part.id);
          const r = await sendLinks(cur, [fresh]).catch(() => ({ sent: [] }));
          mailFailed = !r.sent.length;
          if (!mailFailed) cur = await updateTirage(t.id, { journal: withLog(cur, "super-admin", "send", { prenom: next.prenom }) });
        }
        return json({ tirage: await view(cur), moved, mailFailed });
      }

      case "delete":
        await deleteTirage(t.id);
        return json({ ok: true });

      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("ami-invisible super:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
