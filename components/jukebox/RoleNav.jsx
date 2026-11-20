"use client";
/*
 * Jukebox — barre de navigation de l'organisateur entre ses trois écrans
 * (modèle components/clicclac/RoleNav.jsx) : participer (page invité :
 * proposer des titres), télécommande (téléphone), régie (ordinateur, lecteur).
 * Affichée seulement sur un appareil qui a les accès régie.
 * Quitter la page invité vers la régie ou la télécommande coupe le mode invité.
 */
import Link from "next/link";
import { setGuestMode } from "./storage";

const ITEMS = [
  ["guest", "🎤 Participer", ""],
  ["remote", "📱 Télécommande", "/telecommande"],
  ["regie", "💻 Régie", "/regie"],
];

export default function RoleNav({ code, current, dark = true, className = "" }) {
  return (
    <nav className={`flex rounded-full p-1 text-sm font-bold ${dark ? "bg-white/10" : "bg-gray-100"} ${className}`}>
      {ITEMS.map(([k, label, path]) => (
        <Link key={k} href={`/jukebox/${code}${path}`} aria-current={current === k ? "page" : undefined}
          onClick={() => { if (k !== "guest") setGuestMode(code, false); }}
          className={`flex-1 text-center rounded-full px-2.5 py-1.5 whitespace-nowrap ${current === k
            ? "bg-fuchsia-600 text-white"
            : dark ? "text-white/70 hover:bg-white/10" : "text-gray-600 hover:bg-gray-200"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
