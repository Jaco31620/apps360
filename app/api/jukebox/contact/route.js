/*
 * Jukebox — demande d'accès (accueil /jukebox) : e-mail au propriétaire, qui
 * la valide en un clic (super-admin › Demandes : code d'activation créé et
 * envoyé par e-mail). Sans la table v23 : e-mail seul, réponse à la main.
 * Pot de miel + limite par adresse IP. L'adresse du propriétaire reste côté serveur.
 */
import { sendMail, isEmail, CONTACT_EMAIL } from "@/lib/clicclac/mail";
import { tooMany, clientIp } from "@/lib/jukeboxRate";
import { createRequest, acknowledgeRequest } from "@/lib/jukeboxRequests";
import { fmtDateFr } from "@/lib/dates";
import { esc, mailPage, title, table, quote, button, small, rich } from "@/lib/mail";

export const runtime = "nodejs";

const ADMIN = "https://apps360.fr/jukebox/admin"; // domaine habituel : session super-admin déjà ouverte

const clip = (v, n) => String(v || "").trim().slice(0, n);

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  if (b?.website) return Response.json({ ok: true }); // pot de miel anti-robots
  const name = clip(b?.name, 80);
  const email = clip(b?.email, 120);
  const date = clip(b?.date, 60);
  const guests = clip(b?.guests, 40);
  const message = clip(b?.message, 2000);
  if (!name || !isEmail(email))
    return Response.json({ error: "Merci d'indiquer votre nom et un e-mail valide." }, { status: 400 });
  if (await tooMany(`contact:${clientIp(req)}`, 5, 3600))
    return Response.json({ error: "Trop de demandes, réessayez plus tard." }, { status: 429 });
  const id = await createRequest({ name, email, date, guests, message });
  const rows = [["E-mail", email], ["Date de la soirée", fmtDateFr(date)], ["Invités", guests]].filter(([, v]) => v);
  const html = mailPage("jukebox", title(`Demande d'accès de ${name}`) + table(rows) + (message ? quote(message, "#c026d3") : "") + (id
    ? button(`${ADMIN}?demande=${id}`, "Voir et valider la demande", "jukebox") + small(`La validation crée le code d'activation et l'envoie par e-mail à ${esc(email)}.`)
    : rich(`Pour répondre : <a href="${ADMIN}">super-admin</a> › Codes › créer un code puis 📨 Envoyer.`)));
  try {
    await sendMail({
      from: "Jukebox <noreply@apps360.fr>",
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `Jukebox — demande d'accès de ${name}`,
      html,
      text: `De : ${name} <${email}>\n${rows.slice(1).map(([k, v]) => `${k} : ${v}`).join("\n")}\n\n${message}${id ? `\n\nValider : ${ADMIN}?demande=${id}` : ""}`,
    });
    await acknowledgeRequest({ name, email }).catch((e) => console.warn("jukebox ack:", e.message));
    return Response.json({ ok: true, email });
  } catch (e) {
    console.error("jukebox contact:", e);
    return Response.json({ error: "Envoi impossible pour le moment." }, { status: 502 });
  }
}
