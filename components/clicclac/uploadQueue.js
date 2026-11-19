"use client";
/*
 * Clic-Clac — envoi fiable des photos.
 *  - sendWithRetry : 3 essais rapprochés (réseau coupé ou erreur serveur) ;
 *  - si ça échoue encore, la photo est gardée sur l'appareil (IndexedDB, ou en
 *    mémoire si indisponible) et renvoyée automatiquement : toutes les 20 s,
 *    au retour du réseau et à la réouverture de la page.
 * L'identifiant d'envoi (uploadId) est fixé à la prise de vue : le serveur
 * ignore un doublon si une réponse s'est perdue.
 * Les refus définitifs (album complet, quota atteint…) ne sont pas réessayés.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";

const DB = "clicclac", STORE = "uploads";
const memory = new Map(); // repli sans IndexedDB (navigation privée…)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function newUploadId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponible"));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}
async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function save(item) {
  try { await run("readwrite", (s) => s.put(item)); } catch (e) { memory.set(item.id, item); }
}
async function remove(id) {
  memory.delete(id);
  try { await run("readwrite", (s) => s.delete(id)); } catch (e) { /* mémoire seule */ }
}
export async function pendingUploads(code) {
  let list = [];
  try { list = (await run("readonly", (s) => s.getAll())) || []; } catch (e) { /* mémoire seule */ }
  const all = [...list, ...[...memory.values()].filter((m) => !list.some((x) => x.id === m.id))];
  return all.filter((x) => x.code === code).sort((a, b) => a.at - b.at);
}

const retryable = (e) => !e.status || e.status >= 500 || e.status === 408;

function send(item) {
  const form = new FormData();
  form.append("uploadId", item.id);
  form.append("full", item.full, "photo.jpg");
  form.append("thumb", item.thumb, "thumb.jpg");
  if (item.hd) form.append("hd", item.hd, "hd.jpg");
  for (const [k, v] of Object.entries(item.fields)) if (v) form.append(k, v);
  return api(`/${item.code}/photos`, { method: "POST", token: item.token || undefined, form });
}

/* Envoi immédiat avec 3 essais. Échec réseau/serveur → erreur marquée retryable. */
export async function sendWithRetry(item) {
  let last;
  for (const wait of [0, 1500, 4000]) {
    if (wait) await sleep(wait);
    try { return await send(item); } catch (e) {
      last = e;
      if (!retryable(e)) throw e;
    }
  }
  last.retryable = true;
  throw last;
}

export const enqueue = (item) => save(item);

let flushing = false;
/* Renvoie les photos en attente de cet album. → { sent, dropped: [messages] } */
export async function flushUploads(code) {
  if (flushing) return { sent: 0, dropped: [] };
  flushing = true;
  const out = { sent: 0, dropped: [] };
  try {
    for (const item of await pendingUploads(code)) {
      try {
        await send(item);
        await remove(item.id);
        out.sent++;
      } catch (e) {
        if (retryable(e)) break; // toujours pas de réseau : on réessaiera plus tard
        await remove(item.id);
        out.dropped.push(e.message);
      }
    }
  } finally {
    flushing = false;
  }
  return out;
}

/* Hook : nombre de photos en attente + renvoi automatique.
 * onSent(result) est appelé quand des photos sont parties (ou refusées). */
export function useUploadQueue(code, onSent) {
  const [pending, setPending] = useState(0);
  const cb = useRef(onSent);
  cb.current = onSent;

  const refresh = useCallback(async () => setPending((await pendingUploads(code)).length), [code]);
  const flush = useCallback(async () => {
    const r = await flushUploads(code);
    await refresh();
    if (r.sent || r.dropped.length) cb.current?.(r);
  }, [code, refresh]);

  useEffect(() => {
    flush();
    const t = setInterval(() => { if (!document.hidden) flush(); }, 20000);
    const onOnline = () => flush();
    const onVis = () => { if (!document.hidden) flush(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVis); };
  }, [flush]);

  return { pending, refresh, flush };
}
