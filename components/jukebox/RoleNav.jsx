"use client";
/*
 * Jukebox — barre de navigation de l'organisateur entre ses deux pages
 * (modèle components/clicclac/RoleNav.jsx) : participer (page invité :
 * proposer des titres) et organiser (téléphone ou ordinateur, lecteur ou
 * pilotage). Affichée seulement sur un appareil qui a les accès régie.
 * Aller vers Organiser coupe le mode invité.
 */
import Link from "next/link";
import { setGuestMode } from "./storage";

const ITEMS = [
  ["guest", "🎤 Participer", ""],
  ["organiser", "🎛️ Organiser", "/organiser"],
];

/* onNavigate(k) → true : la page gère elle-même ce passage (lecteur en cours : sans quitter la page). */
export default function RoleNav({ code, current, dark = true, className = "", onNavigate }) {
  return (
    <nav className={`flex rounded-full p-1 text-sm font-bold ${dark ? "bg-white/10" : "bg-gray-100"} ${className}`}>
      {ITEMS.map(([k, label, path]) => (
        <Link key={k} href={`/jukebox/${code}${path}`} aria-current={current === k ? "page" : undefined}
          onClick={(e) => {
            if (onNavigate?.(k)) { e.preventDefault(); return; }
            if (k !== "guest") setGuestMode(code, false);
          }}
          className={`flex-1 text-center rounded-full px-2.5 py-1.5 whitespace-nowrap ${current === k
            ? "bg-fuchsia-600 text-white"
            : dark ? "text-white/70 hover:bg-white/10" : "text-gray-600 hover:bg-gray-200"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
