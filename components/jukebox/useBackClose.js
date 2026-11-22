"use client";
/*
 * Bouton « retour » du téléphone : ferme la fenêtre ou le panneau ouvert
 * (QR en grand, historique, catalogue…) au lieu de quitter la page.
 * À l'ouverture, une étape est ajoutée à l'historique du navigateur ; le
 * retour la retire et ferme. Fermé autrement (✕, bouton) : l'étape est
 * retirée aussi (retour silencieux), pour qu'un retour suivant ne « ferme »
 * pas une 2e fois. Plusieurs fenêtres empilées : chaque retour ferme la plus
 * récente. Une fenêtre ouverte pendant un retour silencieux attend sa fin.
 */
import { useEffect, useRef } from "react";

const open = new Map(); // id → fermeture, dans l'ordre d'ouverture
let silent = 0; // retours silencieux en cours (fermetures à la main)
let waiting = []; // ouvertures en attente de la fin d'un retour silencieux
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", () => {
    if (silent > 0) { // c'est nous : rien à fermer
      silent--;
      if (!silent) { const w = waiting; waiting = []; w.forEach((f) => f()); }
      return;
    }
    const top = window.history.state?.jbBack;
    // toutes les fenêtres ouvertes après l'étape où l'on revient se ferment (la plus récente d'abord)
    const ids = [...open.keys()];
    const keep = top ? ids.indexOf(top) : -1;
    for (const id of ids.slice(keep + 1).reverse()) { const close = open.get(id); open.delete(id); close(); }
  });
}

export function useBackClose(isOpen, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef(null);

  useEffect(() => {
    listen();
    if (isOpen && !idRef.current) {
      const id = Math.random().toString(36).slice(2);
      idRef.current = id;
      open.set(id, () => { idRef.current = null; closeRef.current(); });
      const push = () => { if (idRef.current === id) window.history.pushState({ ...(window.history.state || {}), jbBack: id }, ""); };
      if (silent) waiting.push(push); else push();
    } else if (!isOpen && idRef.current) {
      const id = idRef.current;
      idRef.current = null;
      open.delete(id);
      if (window.history.state?.jbBack === id) { silent++; window.history.back(); } // fermée à la main : on retire son étape
    }
  }, [isOpen]);

  // page quittée avec la fenêtre ouverte : on l'oublie (sans toucher à l'historique)
  useEffect(() => () => { if (idRef.current) open.delete(idRef.current); }, []);
}
