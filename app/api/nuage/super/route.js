/*
 * Nuage de mots — super-admin (en-tête x-nuage-super, jeton remis par /api/admin).
 * POST { action, … }
 *  - list                    → tous les nuages (500 derniers actifs), nombre de mots
 *  - find { q }              → codes des nuages contenant ce mot
 *  - create { question, max, open, note, mailOk } · duplicate { code } (sans les mots)
 *  - open | close { code }   → envois ouverts / fermés
 *  - edit { code, question, max, note, keep, mailOk } → nuage à jour
 *  - delete { code }
 *  - newcode { code }        → nouveau code présentateur (déconnecte les appareils)
 *  - owner { code }          → adresse du compte propriétaire
 *  - send { code, kind: presenter | view, to } → accès par e-mail (adresse non gardée)
 * La modération des mots se fait dans l'écran présentateur (?super).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { COLS, isNuageSuper, loadSession, createNuage, resetPresenterCode, deleteNuage, purgeDate, ownerEmail, mailText } from "@/lib/nuageServer";
import { MAX_QUESTION_LEN, normalizeMax, wordKey } from "@/lib/nuage";
import { normalizeStyle } from "@/lib/nuageThemes";
import { nuageMessage } from "@/lib/nuageMessages";
import { isEmail, SITE } from "@/lib/clicclac/mail";

export const runtime = "nodejs";

const MAX = 500;
const json = (body, status = 200) => Response.json(body, { status });
const view = (s) => ({
  code: s.code, question: s.question, status: s.status, max: s.max_per_participant,
  words: s.nuage_words?.[0]?.count || 0,
  presenterCode: s.presenter_code, owned: !!s.owner_id, note: s.note, keep: s.keep, mailOk: s.mail_ok,
  createdAt: s.created_at, activeAt: s.active_at, purgeAt: purgeDate(s),
});

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    if (!isNuageSuper(req)) return json({ error: "Session expirée." }, 401);
    const sb = getSupabaseAdmin();
    const note = String(body?.note || "").trim().slice(0, 300);

    if (body?.action === "list") {
      const { data, count, error } = await sb.from("nuage_sessions").select(`${COLS},nuage_words(count)`, { count: "exact" })
        .order("active_at", { ascending: false }).limit(MAX);
      if (error) throw error;
      return json({ total: count ?? data.length, nuages: data.map(view) });
    }
    if (body?.action === "find") {
      const key = wordKey(body.q).replace(/[%_\\]/g, "");
      if (key.length < 2) return json({ error: "Deux lettres au minimum." }, 400);
      const { data, error } = await sb.from("nuage_sessions").select("code,nuage_words!inner(word_key)")
        .ilike("nuage_words.word_key", `%${key}%`).limit(1, { referencedTable: "nuage_words" }).limit(MAX);
      if (error) throw error;
      return json({ codes: data.map((s) => s.code) });
    }
    if (body?.action === "create") {
      const question = String(body.question || "").trim().slice(0, MAX_QUESTION_LEN);
      if (!question) return json({ error: "Merci d'indiquer une question." }, 400);
      return json({ nuage: view(await createNuage({ question, note, max_per_participant: normalizeMax(body.max), status: body.open === false ? "closed" : "open", mail_ok: !!body.mailOk })) });
    }

    const s = await loadSession(body?.code);
    if (!s) return json({ error: "Nuage introuvable." }, 404);
    switch (body.action) {
      case "open":
      case "close": {
        const { error } = await sb.from("nuage_sessions").update({ status: body.action === "open" ? "open" : "closed" }).eq("id", s.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "edit": {
        const question = String(body.question || "").trim().slice(0, MAX_QUESTION_LEN);
        if (!question) return json({ error: "Question vide." }, 400);
        // deux mises à jour séparées : le déclencheur ne change la version (écrans
        // relus) que si aucune colonne de gestion n'est modifiée en même temps
        const groups = [
          { question, max_per_participant: normalizeMax(body.max) },
          { note, keep: !!body.keep, mail_ok: !!body.mailOk },
        ];
        for (const g of groups) {
          if (Object.keys(g).every((k) => g[k] === s[k])) continue;
          const { error } = await sb.from("nuage_sessions").update(g).eq("id", s.id);
          if (error) throw error;
        }
        const { data, error } = await sb.from("nuage_sessions").select(`${COLS},nuage_words(count)`).eq("id", s.id).single();
        if (error) throw error;
        return json({ nuage: view(data) });
      }
      case "newcode": return json({ presenterCode: (await resetPresenterCode(s)).presenter_code });
      case "duplicate": // l'image de titre reste au nuage d'origine (supprimée avec lui)
        return json({ nuage: view(await createNuage({
          question: s.question, max_per_participant: s.max_per_participant, note: s.note, mail_ok: s.mail_ok,
          style: { ...normalizeStyle(s.style), image: null },
        })) });
      case "owner": return json({ email: await ownerEmail(s) });
      case "send": {
        const to = String(body.to || "").trim();
        if (!isEmail(to)) return json({ error: "Adresse e-mail invalide." }, 400);
        const m = nuageMessage(body.kind === "view" ? "view" : "presenter", SITE, { code: s.code, question: s.question, presenterCode: s.presenter_code });
        await mailText({ to, ...m });
        return json({ ok: true });
      }
      case "delete":
        await deleteNuage(s);
        return json({ ok: true });
      default:
        return json({ error: "Action inconnue." }, 400);
    }
  } catch (e) {
    console.error("nuage super:", e);
    return json({ error: "Service momentanément indisponible." }, 502);
  }
}
