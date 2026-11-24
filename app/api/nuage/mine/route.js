/* Nuages du compte connecté (Authorization: Bearer …). */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { userOf } from "@/lib/timerServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const user = await userOf(req);
    if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
    const { data, error } = await getSupabaseAdmin().from("nuage_sessions")
      .select("code,question,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return Response.json({ nuages: data.map((n) => ({ code: n.code, question: n.question, createdAt: n.created_at })) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("nuage mine:", e);
    return Response.json({ error: "Lecture impossible." }, { status: 502 });
  }
}
