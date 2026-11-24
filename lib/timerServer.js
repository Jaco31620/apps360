/* Timer — helpers SERVEUR (route /api/timer et purge quotidienne). */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function userOf(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(m[1]);
  return error ? null : data?.user || null;
}

/* Purge : données dont le compte n'a pas ouvert Timer depuis 12 mois. */
export async function purgeTimer() {
  const limit = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { error, count } = await getSupabaseAdmin().from("timer_data").delete({ count: "exact" }).lt("active_at", limit);
  if (error) return { skipped: error.message };
  return { deleted: count || 0 };
}
