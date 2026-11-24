"use client";
/*
 * Timers perso et favoris : sur l'appareil (localStorage), et sur le compte
 * apps360 si l'on est connecté. `owner` = compte auquel appartient la copie
 * locale (null : anonyme, ajoutée au compte à la première connexion).
 * `dirty` : modification pas encore enregistrée sur le compte.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { normalizeData, mergeData } from "@/lib/timer";

const KEY = "timer_data";
const EMPTY = { mine: [], favs: [] };
export const readLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
export const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage refusé */ } };

async function api(method, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("no session");
  const r = await fetch("/api/timer", {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function useTimers() {
  const { user, loading, signOut } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState(false);
  const ref = useRef({ owner: null, dirty: false, ...EMPTY });
  const timer = useRef(null);
  const uid = user?.id || null;

  const store = useCallback((patch) => {
    ref.current = { ...ref.current, ...patch };
    writeLocal(KEY, ref.current);
    setData({ mine: ref.current.mine, favs: ref.current.favs });
  }, []);

  const push = useCallback(async () => {
    const sent = ref.current;
    try {
      await api("PUT", { mine: sent.mine, favs: sent.favs });
      // une autre modification a pu arriver pendant l'envoi : elle reste à envoyer
      if (ref.current === sent) store({ dirty: false });
      setError(false);
    } catch (e) { setError(true); }
  }, [store]);

  const pull = useCallback(async () => {
    if (!uid) return;
    const before = ref.current;
    if (before.owner === uid && before.dirty) return push();
    try {
      const { data: remote } = await api("GET");
      if (ref.current !== before) return; // modifié entre-temps
      setError(false);
      if (before.owner === uid) { store(remote || EMPTY); return; }
      // anonyme : on ajoute au compte ; autre compte : on remplace
      const merged = before.owner ? normalizeData(remote) : mergeData(before, remote);
      const dirty = JSON.stringify(merged) !== JSON.stringify(normalizeData(remote));
      store({ ...merged, owner: uid, dirty });
      if (dirty) push();
    } catch (e) { setError(true); }
  }, [uid, push, store]);

  useEffect(() => {
    const l = readLocal(KEY);
    ref.current = { owner: l?.owner || null, dirty: !!l?.dirty, ...normalizeData(l) };
    setData({ mine: ref.current.mine, favs: ref.current.favs });
  }, []);

  useEffect(() => {
    if (loading || !uid) return;
    pull();
    const back = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("online", back); };
  }, [loading, uid, pull]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (fn) => {
    store({ ...normalizeData(fn(ref.current)), dirty: true });
    if (!uid) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(push, 600);
  };
  /* Déconnexion : les timers du compte ne restent pas sur l'appareil. */
  const leave = async () => {
    clearTimeout(timer.current);
    if (ref.current.owner && ref.current.dirty) await push();
    await signOut();
    store({ ...EMPTY, owner: null, dirty: false });
  };
  return { ...data, change, leave, user, error };
}
