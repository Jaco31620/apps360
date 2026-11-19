"use client";
/*
 * Clic-Clac — barre de navigation de l'organisateur entre ses trois écrans :
 * participer (page invité : prendre / envoyer des photos), organiser (espace
 * organisateur), télécommande de l'écran. Affichée seulement à l'organisateur.
 */
import Link from "next/link";

const ITEMS = [
  ["guest", "📸 Participer", ""],
  ["admin", "🛠️ Organiser", "/admin"],
  ["remote", "📺 Télécommande", "/telecommande"],
];

export default function RoleNav({ code, current, dark = false }) {
  return (
    <nav className={`flex rounded-full p-1 mb-4 text-sm font-bold ${dark ? "bg-white/10" : "bg-white border border-orange-100 shadow-sm"}`}>
      {ITEMS.map(([k, label, path]) => (
        <Link key={k} href={`/clic-clac/${code}${path}`} aria-current={current === k ? "page" : undefined}
          className={`flex-1 text-center rounded-full px-2 py-2 whitespace-nowrap ${current === k
            ? "bg-[#ff5a5f] text-white"
            : dark ? "text-white/80 hover:bg-white/10" : "text-gray-600 hover:bg-orange-50"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
