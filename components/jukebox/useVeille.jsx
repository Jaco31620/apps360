"use client";
/*
 * Jukebox — veille des pages laissées ouvertes (même logique que Clic-Clac live
 * et le nuage de mots) : sans activité pendant `sleepAfter`, la page passe en
 * veille (relecture lente, voir useLive `mode`) ; après `stopAfter` de veille,
 * arrêt complet (plus aucune lecture ; stopAfter 0 : arrêt dès la veille).
 * Activité : toucher, clic, touche, retour sur la page (visibleWakes), ou
 * appel de activity() par la page (titre ajouté, musique qui joue…).
 * ?veille=test : veille après 30 s, arrêt 1 min plus tard, pour essayer.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const SLEEP_POLL = 15000; // relecture en veille

export function useVeille({ sleepAfter = 3600e3, stopAfter = 24 * 3600e3, visibleWakes = false, enabled = true } = {}) {
  const [mode, setMode] = useState("on"); // on | sleep | stopped
  const modeRef = useRef("on");
  const lastAct = useRef(Date.now());
  const sleptAt = useRef(0);
  const set = (m) => { modeRef.current = m; setMode(m); };
  const activity = useCallback(() => {
    lastAct.current = Date.now();
    if (modeRef.current !== "on") set("on");
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const test = new URLSearchParams(window.location.search).get("veille") === "test";
    const sleepMs = test ? 30000 : sleepAfter, stopMs = test ? (stopAfter ? 60000 : 0) : stopAfter;
    const watch = setInterval(() => {
      const now = Date.now();
      if (modeRef.current === "on" && now - lastAct.current > sleepMs) { sleptAt.current = now; set(stopMs ? "sleep" : "stopped"); }
      else if (modeRef.current === "sleep" && now - sleptAt.current > stopMs) set("stopped");
    }, test ? 5000 : 30000);
    const onVisible = () => { if (!document.hidden) activity(); };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    if (visibleWakes) document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(watch);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, sleepAfter, stopAfter, visibleWakes, activity]);
  return { mode, activity };
}

/* Signature de l'état d'une soirée : quand elle change (titre en cours, file,
 * blind test, lecture / pause, soirée ouverte ou non), c'est une activité. */
export const partyStamp = (d) => d
  ? [d.now?.id || "", (d.queue || []).map((t) => t.id).join(","), d.total ?? "", d.blind?.on ? 1 : 0, d.playback?.playing ? 1 : 0, d.session?.status || ""].join("|")
  : "";

/* Bandeau de veille, par-dessus la page (un toucher relance). */
export function VeilleOverlay({ mode, onWake, sleepText = "Touchez l'écran ou ajoutez un titre pour relancer", stopText = "Touchez l'écran pour relancer", title = "en veille", stopTitle = "Arrêté" }) {
  if (mode === "on") return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 cursor-pointer p-6" onClick={onWake}>
      <div className="text-center bg-black/75 text-white rounded-3xl px-8 py-7 shadow-2xl max-w-lg">
        <p className="text-3xl font-black">⏸ {mode === "sleep" ? title.charAt(0).toUpperCase() + title.slice(1) : stopTitle}</p>
        <p className="text-lg text-white/75 mt-3">{mode === "sleep" ? sleepText : stopText}</p>
      </div>
    </div>
  );
}
