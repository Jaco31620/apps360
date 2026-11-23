"use client";
/*
 * Temps réel côté écran : abonnement aux signaux « quelque chose a changé »
 * de la soirée (Supabase Realtime, canal public sans données, voir
 * lib/jukeboxLive.js) → relecture immédiate de l'état. La relecture
 * périodique reste en filet de sécurité : lente quand le canal est connecté
 * (`slow`), à l'ancienne cadence sinon (`fast` : canal bloqué, réseau
 * capricieux). `ctl` : aussi le canal de contrôle (position de lecture,
 * ordres de la télécommande, réponses du blind test).
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { SLEEP_POLL } from "./useVeille";

let client = null;
function rt() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export function useLive(code, refresh, { ctl = false, fast, slow, enabled: on = true, hiddenPause = false, mode = "on" }) {
  // veille (useVeille) : relecture lente ; arrêt : plus rien (ni relecture, ni canal)
  const enabled = on && mode !== "stopped";
  const [live, setLive] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  // hiddenPause : onglet caché (autre onglet, autre appli, ordinateur qui ne gèle pas les
  // onglets) → ni relecture périodique, ni relecture à chaque signal ; au retour, une seule
  // relecture tout de suite (l'affichage est aussitôt à jour)
  const hiddenRef = useRef(hiddenPause);
  hiddenRef.current = hiddenPause;
  const skipNow = () => hiddenRef.current && typeof document !== "undefined" && document.hidden;

  // abonnement : chaque signal → relecture (regroupée : rafale = une seule relecture)
  useEffect(() => {
    if (!enabled || !code) return;
    const sb = rt();
    if (!sb) return;
    let timer = null;
    const ping = () => {
      if (timer || skipNow()) return; // caché : relu au retour sur l'onglet
      timer = setTimeout(() => { timer = null; refreshRef.current(); }, 120);
    };
    const subs = [`jukebox:${code}`, ...(ctl ? [`jukebox:${code}:ctl`] : [])].map((topic) => {
      const ch = sb.channel(topic, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "changed" }, ping);
      return ch;
    });
    const ok = new Set();
    subs.forEach((ch, i) => ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { ok.add(i); if (ok.size === subs.length) { setLive(true); ping(); } }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { ok.delete(i); setLive(false); }
    }));
    return () => { clearTimeout(timer); setLive(false); subs.forEach((ch) => sb.removeChannel(ch)); };
  }, [code, ctl, enabled]);

  // retour sur un onglet qui ne relisait plus (caché) : relecture tout de suite
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => { if (hiddenRef.current && !document.hidden) refreshRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  // réveil (sortie de veille) : relecture tout de suite
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== "on" && mode === "on") refreshRef.current();
    prevMode.current = mode;
  }, [mode]);

  // relecture périodique : filet de sécurité
  const every = mode === "sleep" ? Math.max(SLEEP_POLL, live ? slow : fast) : live ? slow : fast;
  useEffect(() => {
    if (!enabled || !every) return;
    const id = setInterval(() => { if (!skipNow()) refreshRef.current(); }, every);
    return () => clearInterval(id);
  }, [every, enabled, hiddenPause]);

  return live;
}
