/*
 * Page d'accueil : réglage des apps (jukebox_config, clé « apps360:home »), lu
 * seulement quand une page gardée en cache se régénère (une fois par heure au
 * plus, et après chaque enregistrement dans le backoffice).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { apps } from "@/lib/apps";
import { applyHome } from "@/lib/homeConfig";

const KEY = "apps360:home";

/* Apps dans l'ordre, avec leur état. Base injoignable : erreur (Next garde la
 * dernière page générée) ; pendant la compilation : valeurs de lib/apps.js. */
export async function homeApps() {
  try {
    const { data, error } = await getSupabaseAdmin().from("jukebox_config").select("value").eq("key", KEY).maybeSingle();
    if (error) throw error;
    return applyHome(apps, data ? JSON.parse(data.value) : null);
  } catch (e) {
    if (process.env.NEXT_PHASE !== "phase-production-build" && process.env.NODE_ENV === "production") throw e;
    return applyHome(apps, null);
  }
}

export async function saveHome(cfg) {
  const { error } = await getSupabaseAdmin().from("jukebox_config").upsert({ key: KEY, value: JSON.stringify(cfg) });
  if (error) throw error;
}

/* Métadonnées d'une app en test : pas d'indexation par Google. */
export async function testRobots(href) {
  const a = (await homeApps()).find((x) => x.href === href);
  return a?.state === "public" ? {} : { robots: { index: false, follow: false } };
}
