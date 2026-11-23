/*
 * Ami Invisible — organisateur (compte apps360 obligatoire).
 * POST { action, … } avec Authorization: Bearer <jeton de session Supabase>.
 *  - load                       → { email, carnet, tirages } (résumés)
 *  - get { id }                 → un tirage (jamais les receveurs)
 *  - create { fromId? }         → nouveau brouillon, vide ou repris d'un tirage
 *  - save { id, patch }         → brouillon : nom, options, message, participants,
 *                                 exclusions, tirages à éviter (sauvegarde au fil de la saisie).
 *                                 Tirage fait : date, lieu, budget, liste de souhaits seulement.
 *  - draw { id } / undraw { id }→ tirage ; « Refaire » (si rien n'est envoyé)
 *  - send { id, participantId? }→ lien personnel à tous ceux qui ne l'ont pas reçu, ou à un seul
 *  - reveal { id }              → paires, seulement si l'organisateur ne participe pas (tracé)
 *  - delete { id } / deleteAll  → suppression d'un tirage / de toutes ses données
 *  - carnet { carnet }
 */
import {
  LIMITS, cleanCarnet, cleanDraft, cleanExclusions, cleanOptions, cleanTemplate, defaultTemplate, drawProblem, cleanPerson,
} from "@/lib/amiInvisible";
import {
  userOf, touchOrganizer, saveCarnet, getTirage, participantsOf, updateTirage, withLog, tirageSummaries, tirageView,
  drawTirage, undrawTirage, sendLinks, createTirage, deleteTirage, deleteOrganizerData,
} from "@/lib/amiInvisibleServer";
import { tooMany } from "@/lib/jukeboxRate";

export const runtime = "nodejs";

const json = (body, status = 200) => Response.json(body, { status });
const DRAWN_OPTIONS = ["date", "place", "budget", "wishlist"]; // modifiables après le tirage

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    const user = await userOf(req);
    if (!user) return json({ error: "Session expirée : reconnectez-vous." }, 401);
    const org = await touchOrganizer(user);
    const uid = user.id;

    if (body?.action === "load") {
      return json({ email: org.email, carnet: org.carnet || [], tirages: await tirageSummaries(uid) });
    }
    if (body?.action === "carnet") {
      const carnet = cleanCarnet(body.carnet);
      await saveCarnet(uid, carnet);
      return json({ carnet });
    }
    if (body?.action === "deleteAll") {
      await deleteOrganizerData(uid);
      return json({ ok: true });
    }
    if (body?.action === "create") {
      if (await tooMany(`ai:create:${uid}`, 60, 86400)) return json({ error: "Trop de tirages créés aujourd'hui. Réessayez demain." }, 429);
      const from = body.fromId ? await getTirage(body.fromId, uid) : null;
      let fields;
      if (from) {
        const parts = from.status === "drawn" ? await participantsOf(from.id) : [];
        const erased = new Set(parts.filter((p) => p.erased_at).map((p) => p.position));
        const draft = (from.draft || []).filter((_, i) => !erased.has(i));
        const options = { ...cleanOptions(from.options), date: "" };
        fields = {
          name: from.name,
          options,
          template: from.template || defaultTemplate(options.tone),
          draft,
          exclusions: cleanExclusions(from.exclusions, draft.map((p) => p.key)),
          avoid: from.status === "drawn" ? [from.id] : [],
        };
      } else {
        const options = cleanOptions({});
        fields = { name: "", options, template: defaultTemplate(options.tone), draft: [], exclusions: [], avoid: [] };
      }
      const t = await createTirage(uid, fields);
      return json({ tirage: tirageView(t) });
    }

    const t = await getTirage(body?.id, uid);
    if (!t) return json({ error: "Tirage introuvable." }, 404);

    switch (body.action) {
      case "get":
        return json({ tirage: tirageView(t, t.status === "drawn" ? await participantsOf(t.id) : []) });

      case "save": {
        const p = body.patch || {};
        const patch = {};
        if (t.status === "draft") {
          if (p.name !== undefined) patch.name = String(p.name).trim().slice(0, LIMITS.field);
          if (p.options !== undefined) patch.options = cleanOptions(p.options);
          if (p.template !== undefined) patch.template = cleanTemplate(p.template, (patch.options || t.options).tone);
          if (p.draft !== undefined) patch.draft = cleanDraft(p.draft);
          const keys = (patch.draft || t.draft || []).map((x) => x.key);
          if (p.exclusions !== undefined || patch.draft) patch.exclusions = cleanExclusions(p.exclusions ?? t.exclusions, keys);
          if (p.avoid !== undefined) patch.avoid = (Array.isArray(p.avoid) ? p.avoid : []).map(String).filter((x) => x !== t.id).slice(0, 20);
        } else if (p.options) {
          const next = cleanOptions({ ...t.options, ...Object.fromEntries(DRAWN_OPTIONS.filter((k) => k in p.options).map((k) => [k, p.options[k]])) });
          patch.options = { ...cleanOptions(t.options), ...Object.fromEntries(DRAWN_OPTIONS.map((k) => [k, next[k]])) };
        }
        if (!Object.keys(patch).length) return json({ tirage: tirageView(t) });
        const saved = await updateTirage(t.id, patch);
        return json({ tirage: tirageView(saved, saved.status === "drawn" ? await participantsOf(t.id) : []) });
      }

      case "draw": {
        if (t.status !== "draft") return json({ error: "Ce tirage est déjà fait." }, 409);
        if (await tooMany(`ai:draw:${uid}`, 100, 86400)) return json({ error: "Trop de tirages aujourd'hui. Réessayez demain." }, 429);
        const problem = drawProblem(t.name, t.draft || []);
        if (problem) return json({ error: problem }, 400);
        const r = await drawTirage(t);
        if (r.error) return json({ error: r.error }, 422);
        // les participants rejoignent le carnet de l'organisateur
        const carnet = cleanCarnet([...(org.carnet || []), ...(t.draft || []).map(cleanPerson)]);
        if (carnet.length !== (org.carnet || []).length) await saveCarnet(uid, carnet);
        return json({ tirage: tirageView(r.tirage, r.participants), carnet });
      }

      case "undraw": {
        if (t.status !== "drawn") return json({ tirage: tirageView(t) });
        const parts = await participantsOf(t.id);
        if (parts.some((p) => p.sent_at)) return json({ error: "Des liens ont déjà été envoyés : faites un nouveau tirage." }, 409);
        return json({ tirage: tirageView(await undrawTirage(t)) });
      }

      case "send": {
        if (t.status !== "drawn") return json({ error: "Faites d'abord le tirage." }, 409);
        const parts = await participantsOf(t.id);
        const targets = body.participantId
          ? parts.filter((p) => p.id === body.participantId)
          : parts.filter((p) => !p.sent_at && p.email);
        if (body.participantId && !targets.length) return json({ error: "Participant introuvable." }, 404);
        if (targets.some((p) => !p.email)) return json({ error: "Cette personne a supprimé ses coordonnées." }, 409);
        if (targets.some((p) => (p.sends || 0) >= LIMITS.sendsPerPair))
          return json({ error: `Ce lien a déjà été envoyé ${LIMITS.sendsPerPair} fois. Copiez-le pour l'envoyer autrement, ou écrivez-nous : contact@apps360.fr` }, 429);
        if (targets.length && (await tooMany(`ai:send:${uid}`, 300, 86400))) return json({ error: "Trop d'envois aujourd'hui. Réessayez demain." }, 429);
        const r = targets.length ? await sendLinks(t, targets) : { sent: [], failed: [] };
        return json({ tirage: tirageView(t, await participantsOf(t.id)), ...r });
      }

      case "reveal": {
        if (t.status !== "drawn") return json({ error: "Faites d'abord le tirage." }, 409);
        if (t.options?.organizerPlays !== false) return json({ error: "Vous participez à ce tirage : les paires restent secrètes, même pour vous." }, 403);
        const parts = await participantsOf(t.id);
        const byId = new Map(parts.map((p) => [p.id, p]));
        await updateTirage(t.id, { journal: withLog(t, "organisateur", "reveal") });
        return json({ pairs: Object.fromEntries(parts.map((p) => {
          const r = byId.get(p.receiver_id);
          return [p.id, { prenom: r?.prenom || "", nom: r?.nom || "" }];
        })) });
      }

      case "delete":
        await deleteTirage(t.id);
        return json({ ok: true });

      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("ami-invisible:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
