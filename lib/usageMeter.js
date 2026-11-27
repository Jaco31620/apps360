/*
 * Mesure interne de la consommation (Vercel « Fluid Active CPU ») par app, soirée
 * et route : `metered(handler)` enveloppe un route handler, compte l'appel et le
 * temps CPU du processus pendant son exécution, en MÉMOIRE. Au plus une fois par
 * minute et par instance, après la réponse (after), les totaux partent en base
 * en une écriture (fonction SQL usage_add, scripts/usage.sql), par heure.
 *
 * Plusieurs appels traités en même temps se partagent le CPU du processus : au
 * moment de l'envoi, les temps sont ramenés au CPU réel du processus sur la
 * période ; le reste (pages, routes non mesurées, Next) part en « _autre ».
 *
 * JAMAIS bloquant : toute erreur de mesure ou d'envoi est ignorée, la réponse de
 * la route est rendue telle quelle (y compris ses exceptions).
 */
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const FLUSH_MS = 60e3;
const MAX_KEYS = 400;

let buf = new Map(); // clé → { app, code, route, method, calls, cpu }
let lastFlush = Date.now();
let lastCpu = null;  // CPU du processus (µs) au dernier envoi
let flushing = false;

const cpuNow = () => { const u = process.cpuUsage(); return u.user + u.system; };
const clean = (s, max = 24) => (/^[A-Za-z0-9_-]{1,40}$/.test(String(s || "")) ? String(s).slice(0, max) : "?");

/* /api/<app>/<code>/<route…> → app, code, route (code = params.code s'il existe). */
export function describe(pathname, code) {
  const seg = String(pathname || "").split("/").filter(Boolean).slice(1); // sans « api »
  const app = clean(seg[0]);
  let rest = seg.slice(1);
  let c = "-";
  if (code && rest[0] === code) { c = clean(code); rest = rest.slice(1); }
  const route = rest.length ? rest.map((x) => (/^[a-z-]{1,20}$/.test(x) ? x : "*")).join("/") : "";
  return { app, code: c, route };
}

function record(info, method, us) {
  const key = `${info.app}|${info.code}|${info.route}|${method}`;
  let e = buf.get(key);
  if (!e) {
    if (buf.size >= MAX_KEYS) return;
    e = { ...info, method, calls: 0, cpu: 0 };
    buf.set(key, e);
  }
  e.calls += 1;
  e.cpu += Math.max(0, us);
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const now = cpuNow();
    const total = lastCpu == null ? null : now - lastCpu;
    lastCpu = now;
    const rows = [...buf.values()];
    buf = new Map();
    lastFlush = Date.now();
    if (!rows.length) return;
    const raw = rows.reduce((s, r) => s + r.cpu, 0);
    const k = total != null && raw > total ? total / raw : 1;
    const hour = new Date(Math.floor(Date.now() / 3600e3) * 3600e3).toISOString();
    const out = rows.map((r) => ({ hour, app: r.app, code: r.code, route: r.route, method: r.method, calls: r.calls, cpu_ms: Math.round((r.cpu * k) / 10) / 100 }));
    if (total != null && total > raw * k) out.push({ hour, app: "_autre", code: "-", route: "", method: "", calls: 0, cpu_ms: Math.round((total - raw * k) / 10) / 100 });
    const { error } = await getSupabaseAdmin().rpc("usage_add", { p_rows: out });
    if (error) console.warn("usage meter:", error.message);
  } catch (e) {
    console.warn("usage meter:", e?.message || e);
  } finally {
    flushing = false;
  }
}

export function metered(handler) {
  return async function meteredHandler(req, ctx) {
    let t0 = null;
    try { t0 = cpuNow(); if (lastCpu == null) lastCpu = t0; } catch {}
    try {
      return await handler(req, ctx);
    } finally {
      try {
        if (t0 != null) {
          const us = cpuNow() - t0;
          const p = ctx?.params ? await ctx.params : null;
          record(describe(new URL(req.url).pathname, p?.code), req.method || "?", us);
          if (Date.now() - lastFlush >= FLUSH_MS && !flushing) { lastFlush = Date.now(); after(flush); }
        }
      } catch {}
    }
  };
}

/* Purge quotidienne (keep-alive) : lignes de plus de 3 mois. Sans la table : sans effet. */
export async function purgeUsage() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  await getSupabaseAdmin().from("usage_meter").delete().lt("hour", d.toISOString());
}
