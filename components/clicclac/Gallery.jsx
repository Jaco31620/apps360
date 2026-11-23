"use client";
/*
 * Clic-Clac — galerie : grille de miniatures (légères), visionneuse plein écran
 * avec la version standard, téléchargement photo par photo, suppression de ses
 * propres photos (invité) ou de toutes (organisateur), validation (modération).
 */
import { useEffect, useRef, useState } from "react";
import SoutenirLink from "@/components/SoutenirLink";

/* Téléchargement. Sur téléphone / tablette : feuille de partage du système
 * (« Enregistrer l'image » → Photos sur iPhone) ; sinon fichier téléchargé. */
async function download(url, name) {
  try {
    // cache: "no-store" : l'image déjà affichée est en cache SANS en-têtes CORS
    // (R2 ne les renvoie qu'aux requêtes avec Origin) → sinon fetch bloqué.
    const blob = await (await fetch(url, { cache: "no-store" })).blob();
    const file = new File([blob], name, { type: "image/jpeg" });
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) { /* partage annulé */ }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    window.open(url, "_blank");
  }
}

/* favs (Set d'ids) + onFav(photo, on) : sélection « livre photo » de l'organisateur (⭐). */
/* soutien : après un téléchargement, ligne discrète « soutenir apps360 » (invités) */
export default function Gallery({ photos, canDownload = true, onDelete, onApprove, admin = false, empty, favs, onFav, soutien = false }) {
  const [downloaded, setDownloaded] = useState(false);
  const [open, setOpen] = useState(null); // index
  const current = open != null ? photos[open] : null;
  const touch = useRef(null);
  // balayage du doigt : photo précédente / suivante
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setOpen((i) => (dx < 0 ? Math.min(photos.length - 1, i + 1) : Math.max(0, i - 1)));
  };

  useEffect(() => {
    if (open == null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => Math.min(photos.length - 1, i + 1));
      if (e.key === "ArrowLeft") setOpen((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  if (!photos.length) return <p className="text-center text-gray-400 py-16">{empty || "Aucune photo pour l'instant."}</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} className="relative aspect-square overflow-hidden rounded-lg bg-gray-200 group">
            <img src={p.thumb} alt={p.caption || p.name || "Photo"} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            {p.status === "pending" && <span className="absolute top-1 left-1 bg-amber-400 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded">À valider</span>}
            {p.kind === "strip" && <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">🎞️</span>}
            {onFav && (
              <span role="button" tabIndex={0} aria-label={favs?.has(p.id) ? "Retirer du livre photo" : "Ajouter au livre photo"}
                onClick={(e) => { e.stopPropagation(); onFav(p, !favs?.has(p.id)); }}
                className={`absolute bottom-1 left-1 w-7 h-7 flex items-center justify-center rounded-full text-sm ${favs?.has(p.id) ? "bg-amber-400" : "bg-black/40 opacity-80 grayscale"}`}>⭐</span>
            )}
            {p.mine && <span className="absolute top-1 right-1 bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Moi</span>}
          </button>
        ))}
      </div>

      {current && (
        <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/70">{open + 1} / {photos.length}</span>
            <button onClick={() => setOpen(null)} className="text-white/80 hover:text-white text-lg">✕</button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-2 relative" onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {open > 0 && <button onClick={() => setOpen(open - 1)} className="absolute left-2 z-10 bg-white/10 hover:bg-white/20 rounded-full w-11 h-11 text-2xl">‹</button>}
            <img src={current.full} alt={current.caption || "Photo"} className="max-w-full max-h-full object-contain" />
            {open < photos.length - 1 && <button onClick={() => setOpen(open + 1)} className="absolute right-2 z-10 bg-white/10 hover:bg-white/20 rounded-full w-11 h-11 text-2xl">›</button>}
          </div>
          <div className="px-4 py-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {(current.name || current.caption) && (
              <p className="text-center">
                {current.caption && <span className="font-semibold">{current.caption}</span>}
                {current.name && <span className="text-white/60">{current.caption ? " — " : ""}📸 {current.name}</span>}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {admin && current.status === "pending" && (
                <button onClick={() => onApprove?.(current)} className="bg-green-500 font-bold px-5 py-2.5 rounded-full">✓ Publier</button>
              )}
              {onFav && (
                <button onClick={() => onFav(current, !favs?.has(current.id))}
                  className={`font-bold px-5 py-2.5 rounded-full ${favs?.has(current.id) ? "bg-amber-400 text-amber-950" : "bg-white/15"}`}>
                  {favs?.has(current.id) ? "⭐ Dans le livre photo" : "☆ Ajouter au livre photo"}
                </button>
              )}
              {canDownload && (
                <button onClick={async () => { await download(current.hd || current.full, `clic-clac-${current.id.slice(0, 8)}.jpg`); setDownloaded(true); }}
                  className="bg-white text-gray-900 font-bold px-5 py-2.5 rounded-full">⬇ Télécharger</button>
              )}
              {(admin || current.mine) && onDelete && (
                <button onClick={async () => {
                  if (!confirm("Supprimer définitivement cette photo ?")) return;
                  await onDelete(current);
                  setOpen(photos.length <= 1 ? null : Math.max(0, open - (open === photos.length - 1 ? 1 : 0)));
                }} className="bg-red-500/90 font-bold px-5 py-2.5 rounded-full">🗑 Supprimer</button>
              )}
            </div>
            {soutien && downloaded && <SoutenirLink dark />}
          </div>
        </div>
      )}
    </>
  );
}
