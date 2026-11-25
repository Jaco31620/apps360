/*
 * Super-admin — e-mail d'accès d'un album à l'organisateur (« Envoyer depuis apps360 ») :
 * un seul lien (connexion directe, 7 jours), le code organisateur s'il est connu, le QR
 * code invités en pièce jointe (à transférer séparément), quotas et date de suppression.
 * Body : { to?, pin?, regenPin?, qr? (PNG base64), message? }
 *  - pin : code organisateur connu (juste après création) — vérifié avant envoi ;
 *  - regenPin : génère un nouveau code organisateur et l'inclut (l'ancien expire) ;
 *  - sinon le récap est envoyé sans code organisateur.
 *  - qr : QR code invités (rendu côté navigateur) joint en image.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isSuper, randomCode, sha256, checkPin, createPass, ADMIN_TTL } from "@/lib/clicclac/server";
import { organizerLink, organizerMessage } from "@/lib/clicclac/messages";
import { normalizeSettings } from "@/lib/clicclac/settings";
import { sendMail, wrapHtml, isEmail, CONTACT_EMAIL, SITE } from "@/lib/clicclac/mail";
import { esc, para, rich, small, table, button } from "@/lib/mail";

export const runtime = "nodejs";

const fmt = (d) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "");

export async function POST(req, { params }) {
  if (!isSuper(req)) return Response.json({ error: "Accès refusé." }, { status: 401 });
  const { id } = await params;
  let b;
  try { b = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    const sb = getSupabaseAdmin();
    const { data: a, error } = await sb.from("clicclac_albums").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!a) return Response.json({ error: "Album introuvable." }, { status: 404 });
    const to = String(b?.to || a.admin_email || "").trim();
    if (!isEmail(to)) return Response.json({ error: "Adresse de l'organisateur invalide." }, { status: 400 });

    let pin = null;
    if (b?.regenPin) {
      pin = randomCode(8); // enregistré seulement APRÈS un envoi réussi (sinon l'ancien code reste valable)
    } else if (b?.pin) {
      if (!checkPin(b.pin, a.admin_hash)) return Response.json({ error: "Ce code organisateur n'est plus valable." }, { status: 400 });
      pin = String(b.pin).toUpperCase().trim();
    }

    const s = normalizeSettings(a.settings);
    // lien lié au code en vigueur APRÈS l'envoi (nouveau code compris)
    const link = {
      pass: await createPass(b?.regenPin ? { ...a, admin_hash: sha256(pin) } : a, { ttlMs: ADMIN_TTL, multi: true }),
      expiresAt: new Date(Date.now() + ADMIN_TTL).toISOString(),
    };
    const admin = organizerLink(SITE, a.code, link.pass);
    const qr = typeof b?.qr === "string" && /^[A-Za-z0-9+/=]+$/.test(b.qr) && b.qr.length < 400000 ? b.qr : null;
    const message = String(b?.message || "").trim().slice(0, 1000);

    const html = wrapHtml(`Votre album « ${a.name} » est prêt`, para(message)
      + button(admin, "Ouvrir mon espace organisateur", "clicclac")
      + (pin
        ? rich(`Code organisateur : <b style="font-size:19px">${esc(pin)}</b><br>Il sera demandé après le ${fmt(link.expiresAt)} ou sur un autre appareil : gardez-le.`)
        : rich(`Lien direct valable jusqu'au ${fmt(link.expiresAt)}. Ensuite, le code organisateur qui vous a été communiqué est demandé.`))
      + rich("Tout le reste est sur la page : lien et QR code pour les invités, écran d'affichage, télécommande, réglages, borne photo et téléchargement de l'album.")
      + (qr ? rich("Le <b>QR code des invités</b> est joint à cet e-mail, prêt à imprimer ou à transférer.") : "")
      + small("Gardez cet e-mail pour vous : il donne les commandes de l'album.")
      + rich("<b>📋 Votre album</b>")
      + table([
        a.event_date && ["Date", fmt(a.event_date)],
        ["Photos", `${s.maxPhotos} maximum`],
        ["Par invité", s.guestQuota ? `${s.guestQuota} photos` : "illimité"],
        ["Modération", s.moderation ? "oui (photos validées avant publication)" : "non (publication directe)"],
        ["Haute définition", s.keepHd ? "conservée (pour impression)" : "non"],
        ["Suppression", `${fmt(a.expires_at)} — pensez à télécharger l'album avant (rappel envoyé 3 jours avant)`],
      ].filter(Boolean))
      + rich("Une question ? Répondez simplement à cet e-mail."));

    const text = `${message ? `${message}\n\n` : ""}${organizerMessage(SITE, a, link, pin).text}\n\nPhotos max : ${s.maxPhotos} · par invité : ${s.guestQuota || "illimité"} · suppression le ${fmt(a.expires_at)}.`;

    await sendMail({
      to,
      replyTo: CONTACT_EMAIL,
      subject: `📸 Clic-Clac — votre album « ${a.name} »`,
      html,
      text,
      ...(qr ? { attachments: [{ filename: `qr-clic-clac-${a.code}.png`, content: qr }] } : {}),
    });
    const patch = {};
    if (b?.regenPin) patch.admin_hash = sha256(pin);
    if (!a.admin_email) patch.admin_email = to;
    if (Object.keys(patch).length) {
      const { error: e3 } = await sb.from("clicclac_albums").update(patch).eq("id", id);
      if (e3) throw e3;
    }
    return Response.json({ ok: true, to, pin: b?.regenPin ? pin : undefined });
  } catch (e) {
    console.error("clicclac recap:", e);
    return Response.json({ error: e.message || "Envoi impossible." }, { status: 502 });
  }
}
