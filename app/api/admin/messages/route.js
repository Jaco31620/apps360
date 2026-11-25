/* Backoffice — messages reçus. POST { token, action, id?, … } (jeton du backoffice). */
import { verifyToken } from "@/lib/clicclac/server";
import { STATUS, isLate } from "@/lib/contact";
import { ContactError, countTodo, listMessages, replyTo, markAnswered, setStatus, setNote, removeMessage } from "@/lib/contactServer";

export const runtime = "nodejs";

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch (e) { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  try {
    if (verifyToken(b?.token)?.scope !== "apps360:admin") return Response.json({ error: "Session expirée : reconnectez-vous." }, { status: 401 });
    if (b.action === "count") { const l = await countTodo(); return Response.json({ todo: l.length, late: l.filter((m) => isLate(m)).length }); }
    if (b.action === "list") return Response.json({ messages: await listMessages() });
    if (b.action === "reply") return Response.json({ message: await replyTo(b.id, b.text) });
    if (b.action === "mark") return Response.json({ message: await markAnswered(b.id, b.day) });
    if (b.action === "status" && Object.hasOwn(STATUS, b.status)) return Response.json({ message: await setStatus(b.id, b.status) });
    if (b.action === "note") return Response.json({ message: await setNote(b.id, b.note) });
    if (b.action === "delete") { await removeMessage(b.id); return Response.json({ ok: true }); }
    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    if (e instanceof ContactError) return Response.json({ error: e.message }, { status: 400 });
    console.error("admin messages:", e);
    const missing = e?.code === "42P01" || e?.code === "PGRST205";
    return Response.json({ error: missing ? "Table absente : SQL du formulaire de contact à exécuter dans Supabase." : "Action impossible, réessayez." }, { status: 502 });
  }
}
