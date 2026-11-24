/*
 * Nuage de mots — super-admin (en-tête x-nuage-super, jeton remis par /api/admin).
 * POST { action, … }
 *  - list             → tous les nuages (les 500 derniers actifs), nombre de mots
 *  - open | close { code } → ouvrir / fermer les envois
 *  - relink { code }  → nouveau jeton présentateur (l'ancien ne marche plus)
 *  - delete { code }  → suppression (mots et images compris)
 * La modération des mots se fait dans l'écran présentateur (?super).
 * Lecture seulement à la demande (ouverture, bouton Actualiser).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isNuageSuper, loadSession, newAdminToken, hashToken, deleteNuage, PURGE_DAYS } from "@/lib/nuageServer";

export const runtime = "nodejs";

const MAX = 500;
const json = (body, status = 200) => Response.json(body, { status });

async function list(sb) {
  const cols = "code,question,status,max_per_participant,created_at,nuage_words(count)";
  const q = (c, order) => sb.from("nuage_sessions").select(c, { count: "exact" }).order(order, { ascending: false }).limit(MAX);
  let r = await q(`${cols},active_at`, "active_at");
  if (r.error && /active_at/.test(r.error.message || "")) r = await q(cols, "created_at"); // SQL v3 non appliqué
  if (r.error) throw r.error;
  return {
    total: r.count ?? r.data.length,
    nuages: r.data.map((s) => ({
      code: s.code,
      question: s.question,
      status: s.status,
      max: s.max_per_participant,
      words: s.nuage_words?.[0]?.count || 0,
      createdAt: s.created_at,
      activeAt: s.active_at || null,
      purgeAt: s.active_at ? new Date(Date.parse(s.active_at) + PURGE_DAYS * 24 * 3600 * 1000).toISOString() : null,
    })),
  };
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "Requête invalide." }, 400); }
  try {
    if (!isNuageSuper(req)) return json({ error: "Session expirée." }, 401);
    const sb = getSupabaseAdmin();
    if (body?.action === "list") return json(await list(sb));

    const s = await loadSession(body?.code);
    if (!s) return json({ error: "Nuage introuvable." }, 404);
    const update = async (patch) => {
      const { error } = await sb.from("nuage_sessions").update(patch).eq("id", s.id);
      if (error) throw error;
    };

    switch (body.action) {
      case "open":
      case "close":
        await update({ status: body.action === "open" ? "open" : "closed" });
        return json({ ok: true });
      case "relink": {
        const token = newAdminToken();
        await update({ admin_hash: hashToken(token) });
        return json({ token });
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
