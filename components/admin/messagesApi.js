/* Backoffice — appel de /api/admin/messages avec le jeton de l'appareil. */
import { adminToken } from "./session";

export async function messagesApi(body) {
  const token = adminToken();
  if (!token) throw Object.assign(new Error("Session expirée : reconnectez-vous."), { status: 401 });
  const res = await fetch("/api/admin/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...body }) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(r.error || "Action impossible, réessayez."), { status: res.status });
  return r;
}
