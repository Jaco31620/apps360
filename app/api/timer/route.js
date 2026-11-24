/*
 * Timer — timers et favoris du compte connecté (une ligne par compte).
 * GET lit, PUT remplace. Compte vérifié par son jeton Supabase.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { userOf } from "@/lib/timerServer";
import { normalizeData } from "@/lib/timer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error, status) => Response.json({ error }, { status });

export async function GET(req) {
  try {
    const user = await userOf(req);
    if (!user) return fail("Connexion requise.", 401);
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("timer_data").select("data,active_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    // dernière visite (purge à 12 mois) : notée une fois par jour au plus
    if (data && Date.now() - new Date(data.active_at).getTime() > 24 * 3600 * 1000) {
      await sb.from("timer_data").update({ active_at: new Date().toISOString() }).eq("user_id", user.id);
    }
    return Response.json({ data: data ? normalizeData(data.data) : null });
  } catch (e) {
    console.error("timer get:", e);
    return fail("Lecture impossible.", 502);
  }
}

export async function PUT(req) {
  let body;
  try {
    const text = await req.text();
    if (text.length > 60000) return fail("Trop de données.", 413);
    body = JSON.parse(text);
  } catch (e) { return fail("Requête invalide.", 400); }
  try {
    const user = await userOf(req);
    if (!user) return fail("Connexion requise.", 401);
    const data = normalizeData(body);
    const { error } = await getSupabaseAdmin().from("timer_data")
      .upsert({ user_id: user.id, data, active_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("timer put:", e);
    return fail("Enregistrement impossible.", 502);
  }
}
