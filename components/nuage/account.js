"use client";
import { supabase } from "@/lib/supabase";

/* En-tête du compte apps360 connecté ({} sinon). */
export async function bearer() {
  try {
    const { data } = await supabase.auth.getSession();
    const t = data?.session?.access_token;
    return t ? { authorization: `Bearer ${t}` } : {};
  } catch (e) { return {}; }
}
