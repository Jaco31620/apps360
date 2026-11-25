/*
 * Route serveur ORGANISATEUR — envoi de l'image du nuage par e-mail (Resend).
 * En-tête x-nuage-admin requis, ET : super-admin, nuage débloqué par lui
 * (mail_ok), ou organisateur connecté à son compte (Authorization: Bearer …).
 * Créer un nuage étant ouvert à tous, le jeton seul ne suffit pas (relais de
 * spam). Plafonds par jour, sauf super-admin ; compteur en panne = refus.
 * Body : { to: string[] (≤ 10), message?: string, replyTo?: string, image: base64 PNG }
 */
import { Resend } from "resend";
import { loadSession, canManage, isSuperToken, overLimit } from "@/lib/nuageServer";
import { userOf } from "@/lib/timerServer";
import { esc, title, para, small, mailPage, sendEach } from "@/lib/mail";
import { clientIp } from "@/lib/jukeboxRate";

export const runtime = "nodejs";
export const maxDuration = 60; // un envoi par destinataire

const FROM = "apps360 — Nuage de mots <noreply@apps360.fr>";
const MAX_TO = 10;
const MAX_IMAGE = 3 * 1024 * 1024; // octets (base64 décodé) — envoyée en 2 exemplaires
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());

export async function POST(req, { params }) {
  const { code } = await params;
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }

  const to = [...new Set((Array.isArray(body?.to) ? body.to : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return Response.json({ error: "Indiquez au moins une adresse e-mail." }, { status: 400 });
  if (to.length > MAX_TO) return Response.json({ error: `${MAX_TO} destinataires maximum.` }, { status: 400 });
  const bad = to.filter((e) => !isEmail(e));
  if (bad.length) return Response.json({ error: `Adresse invalide : ${bad.join(", ")}` }, { status: 400 });
  const replyTo = isEmail(body?.replyTo) ? String(body.replyTo).trim() : undefined;
  const message = String(body?.message || "").trim().slice(0, 1000);

  const image = Buffer.from(String(body?.image || ""), "base64");
  const isPng = image.length > 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) return Response.json({ error: "Image invalide." }, { status: 400 });
  if (image.length > MAX_IMAGE) return Response.json({ error: "Image trop lourde." }, { status: 413 });

  try {
    const s = await loadSession(code);
    if (!s) return Response.json({ error: "Nuage introuvable." }, { status: 404 });
    if (!canManage(req.headers.get("x-nuage-admin"), s))
      return Response.json({ error: "Accès refusé." }, { status: 401 });

    if (!isSuperToken(req.headers.get("x-nuage-admin"))) {
      const user = await userOf(req);
      if (!user && !s.mail_ok)
        return Response.json({ error: "Connectez-vous à votre compte apps360 pour envoyer l'image par e-mail (ou téléchargez-la avec « Image »).", login: true }, { status: 403 });
      const DAY = 86400;
      if (await overLimit(`nuage:mail:${s.id}`, 5, DAY)
        || await overLimit(user ? `nuage:mailu:${user.id}` : `nuage:mailip:${clientIp(req)}`, 10, DAY)
        || await overLimit("nuage:mail:all", 50, DAY))
        return Response.json({ error: "Nombre maximum d'envois atteint pour aujourd'hui." }, { status: 429 });
    }

    const apiKey = process.env.RESEND_FFBB_KEY;
    if (!apiKey) return Response.json({ error: "Service e-mail non configuré." }, { status: 503 });

    const html = mailPage("nuage", title(s.question) + para(message)
      + `<img src="cid:nuage" alt="Nuage de mots" width="640" style="width:100%;max-width:640px;display:block;border:0;margin:0 0 16px">`
      + small(`L'image en haute définition (1920×1080) est en pièce jointe : <b>nuage-${esc(code)}.png</b>.`), { width: 640 });
    const text = `${s.question}\n\n${message ? message + "\n\n" : ""}Le nuage de mots est en pièce jointe (PNG 1920×1080).`;

    const resend = new Resend(apiKey);
    const mail = {
      from: FROM,
      replyTo,
      subject: `Nuage de mots — ${s.question}`.slice(0, 150),
      html,
      text,
      // 2 exemplaires : l'un affiché dans le corps (cid), l'autre en vraie pièce
      // jointe — Outlook ne propose pas d'ouvrir/enregistrer une image intégrée.
      attachments: [
        { filename: "apercu-nuage.png", content: image.toString("base64"), contentId: "nuage" },
        { filename: `nuage-${code}.png`, content: image.toString("base64") },
      ],
    };
    const r = await sendEach(to, async (addr) => {
      const { error } = await resend.emails.send({ ...mail, to: addr });
      if (error) throw new Error(error.message);
    });
    if (!r.sent) return Response.json({ error: r.error }, { status: 502 });
    return Response.json({ ok: true, sent: r.sent, failed: r.failed });
  } catch (e) {
    console.error("nuage email:", e);
    return Response.json({ error: "Envoi impossible." }, { status: 502 });
  }
}
