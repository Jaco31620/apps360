/*
 * Route serveur PUBLIQUE d'un nuage de mots.
 * - GET  : question, statut et mots agrégés (sans les mots masqués).
 *          ?pid=<participant> : ajoute le nombre de mots déjà envoyés par lui.
 *          ?lite=1 : ne renvoie que la session (relecture légère des participants).
 *          ?rev=<version> : si le nuage n'a pas changé depuis, répond seulement
 *            { same: true } (une seule petite lecture en base).
 *          ?adm=1 + en-tête x-nuage-admin valide : ajoute la liste des mots masqués.
 *          Sans pid ni adm, la réponse est la même pour tous → gardée 2 s par le
 *          CDN Vercel (100 participants ≈ 1 appel serveur toutes les 2 s).
 * - POST : envoi d'un mot { participantId, word }.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSession, publicSession, canManage, renewToken } from "@/lib/nuageServer";
import { tooMany, clientIp } from "@/lib/jukeboxRate";
import { cleanWord, wordKey, UNLIMITED_CAP } from "@/lib/nuage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validPid = (pid) => /^[a-z0-9-]{8,64}$/i.test(String(pid || ""));

async function sentBy(sb, sessionId, pid) {
  const { count, error } = await sb
    .from("nuage_words").select("id", { count: "exact", head: true })
    .eq("session_id", sessionId).eq("participant_id", pid);
  if (error) throw error;
  return count || 0;
}

export async function GET(req, { params }) {
  const { code } = await params;
  try {
    const url = new URL(req.url);
    const pid = url.searchParams.get("pid");
    const wantsAdmin = url.searchParams.has("adm") || !!req.headers.get("x-nuage-admin");
    // réponse identique pour tous (ni participant ni présentateur) → cache CDN 2 s
    const headers = { "cache-control": "no-store" };
    if (!pid && !wantsAdmin) headers["vercel-cdn-cache-control"] = "max-age=2";

    const s = await loadSession(code);
    if (!s) return Response.json({ session: null }, { status: 404, headers: { "cache-control": "no-store" } });
    const sb = getSupabaseAdmin();

    if (url.searchParams.get("lite")) {
      const out = { session: publicSession(s) };
      if (validPid(pid)) out.sent = await sentBy(sb, s.id, pid);
      return Response.json(out, { headers });
    }

    const rev = url.searchParams.get("rev");
    if (rev && s.rev != null && String(s.rev) === rev && !validPid(pid))
      return Response.json({ same: true, rev: s.rev }, { headers });

    const { data: stats, error } = await sb.rpc("nuage_stats", { sid: s.id });
    if (error) throw error;
    const hidden = new Set(s.hidden || []);
    const all = stats?.words || [];
    const out = {
      session: publicSession(s),
      rev: s.rev ?? null,
      words: all.filter((w) => !hidden.has(w.k)),
      total: stats?.total || 0,
      participants: stats?.participants || 0,
    };
    // les envois ajoutés par l'admin (participant « admin ») ne comptent pas comme un participant
    if (typeof stats?.humans === "number") out.participants = stats.humans; // SQL v3
    else if (out.participants) {
      const { count } = await sb.from("nuage_words").select("id", { count: "exact", head: true })
        .eq("session_id", s.id).eq("participant_id", "admin");
      if (count) out.participants -= 1;
    }

    if (validPid(pid)) out.sent = await sentBy(sb, s.id, pid);

    if (wantsAdmin && canManage(req.headers.get("x-nuage-admin"), s)) {
      const t = req.headers.get("x-nuage-admin");
      out.admin = true;
      out.presenterCode = s.presenter_code;
      out.owned = !!s.owner_id;
      const fresh = renewToken(t, s); // jeton bientôt expiré : prolongé
      if (fresh) out.token = fresh;
      out.hidden = all.filter((w) => hidden.has(w.k));
    }
    return Response.json(out, { headers });
  } catch (e) {
    console.error("nuage GET:", e);
    return Response.json({ error: "Chargement impossible." }, { status: 502 });
  }
}

export async function POST(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }

  const pid = body?.participantId;
  const word = cleanWord(body?.word);
  const key = wordKey(word);
  if (!validPid(pid)) return Response.json({ error: "Participant invalide." }, { status: 400 });
  if (!key) return Response.json({ error: "Merci d'écrire un mot." }, { status: 400 });

  try {
    const s = await loadSession(code);
    if (!s) return Response.json({ error: "Nuage introuvable." }, { status: 404 });
    if (s.status !== "open") return Response.json({ error: "Les envois sont fermés." }, { status: 403 });

    // large : toute une salle partage souvent la même adresse
    if (await tooMany(`nuage:w:${s.id}:${clientIp(req)}`, 600, 60))
      return Response.json({ error: "Trop d'envois d'un coup : réessayez dans une minute." }, { status: 429 });

    const sb = getSupabaseAdmin();
    const already = await sentBy(sb, s.id, pid);
    const limit = s.max_per_participant > 0 ? s.max_per_participant : UNLIMITED_CAP;
    if (already >= limit)
      return Response.json({ error: "Vous avez atteint le nombre maximum de mots.", sent: already }, { status: 429 });

    const { error } = await sb.from("nuage_words").insert({ session_id: s.id, word_key: key, word, participant_id: pid });
    if (error) throw error;
    return Response.json({ ok: true, sent: already + 1, max: s.max_per_participant });
  } catch (e) {
    console.error("nuage POST:", e);
    return Response.json({ error: "Envoi impossible." }, { status: 502 });
  }
}
