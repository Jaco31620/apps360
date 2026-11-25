"use client";
/* Backoffice — réglages non enregistrés au moment de quitter. */
import { useEffect, useState } from "react";

export default function Unsaved({ onSave, onStay, onDrop, text = "La page d'accueil a été modifiée." }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !busy) onStay(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onStay]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && onStay()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="uns-t" aria-describedby="uns-d" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 text-center">
        <p id="uns-t" className="font-outfit text-xl font-extrabold text-brand-navy">Vous n'avez pas enregistré</p>
        <p id="uns-d" className="text-sm text-gray-600">{text}</p>
        <div className="space-y-2">
          <button autoFocus disabled={busy} onClick={() => { setBusy(true); onSave(); }} className="w-full bg-brand-navy text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer"}</button>
          <button disabled={busy} onClick={onStay} className="w-full border border-gray-300 font-semibold py-2.5 rounded-full text-sm">Continuer les réglages</button>
          <button disabled={busy} onClick={onDrop} className="w-full text-red-600 font-semibold py-2 text-sm">Abandonner</button>
        </div>
      </div>
    </div>
  );
}
