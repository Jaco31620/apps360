/*
 * Clic-Clac — fin de vie des albums. Appelé par /api/keep-alive (déclenché 2×/jour
 * par GitHub Actions) :
 *  - alerte (une seule fois) 3 jours avant l'expiration, à l'organisateur et au
 *    propriétaire, pour récupérer l'album ;
 *  - suppression des albums expirés (fichiers + données).
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSettings } from "./settings";
import { deleteAlbum, purgePasses } from "./server";
import { sendMail, wrapHtml, CONTACT_EMAIL, SITE, isEmail } from "./mail";
import { para, button } from "@/lib/mail";

const DAY = 24 * 3600 * 1000;

export async function purgeClicClac() {
  const sb = getSupabaseAdmin();
  const now = Date.now();
  const report = { reminded: 0, deleted: 0 };

  // 1. alertes J-3
  const { data: soon } = await sb.from("clicclac_albums").select("*")
    .eq("reminded", false).lte("expires_at", new Date(now + 3 * DAY).toISOString()).gt("expires_at", new Date(now).toISOString());
  for (const a of soon || []) {
    const when = new Date(a.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const to = [CONTACT_EMAIL, ...(isEmail(a.admin_email) ? [a.admin_email.trim()] : [])];
    try {
      await sendMail({
        to,
        subject: `Clic-Clac — l'album « ${a.name} » sera supprimé le ${when}`,
        html: wrapHtml(`L'album « ${a.name} » sera supprimé le ${when}`, para("Pensez à télécharger l'album complet avant cette date, depuis l'espace organisateur :")
          + button(`${SITE}/clic-clac/${a.code}/admin`, "Ouvrir l'espace organisateur", "clicclac")
          + para("Besoin de plus de temps ? Répondez à cet e-mail.")),
        text: `L'album « ${a.name} » sera supprimé le ${when}. Téléchargez-le : ${SITE}/clic-clac/${a.code}/admin`,
        replyTo: CONTACT_EMAIL,
      });
      await sb.from("clicclac_albums").update({ reminded: true }).eq("id", a.id);
      report.reminded++;
    } catch (e) {
      console.error("clicclac rappel:", e);
    }
  }

  // 2. suppression des albums expirés
  const { data: expired } = await sb.from("clicclac_albums").select("*").lte("expires_at", new Date(now).toISOString());
  for (const a of expired || []) {
    try {
      await deleteAlbum({ ...a, settings: normalizeSettings(a.settings) });
      report.deleted++;
    } catch (e) {
      console.error("clicclac purge:", e);
    }
  }
  await purgePasses().catch((e) => console.error("clicclac passes:", e));
  return report;
}
