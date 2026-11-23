"use client";
/*
 * Barre commune du backoffice apps360 : en haut de /admin et des super-admins
 * (Jukebox, Clic-Clac) pour passer de l'un à l'autre sans se reconnecter.
 * Aucune requête, sauf renouvellement d'un jeton expiré au clic (session.js).
 */
import { useRouter } from "next/navigation";
import { ensureApp } from "./session";

const ITEMS = [
  { key: "admin", label: "Backoffice", icon: "/icon-apps360.svg", href: "/admin" },
  { key: "jukebox", label: "Jukebox", icon: "/icon-jukebox.svg", href: "/jukebox/admin" },
  { key: "clicclac", label: "Clic-Clac", icon: "/icon-clicclac.svg", href: "/clic-clac/super" },
];

export default function AdminBar({ current }) {
  const router = useRouter();
  const go = async (e, it) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // nouvel onglet : lien normal
    e.preventDefault();
    if (it.key !== "admin") await ensureApp(it.key);
    router.push(it.href);
  };
  return (
    <nav aria-label="Backoffice apps360" className="bg-brand-navy text-white">
      <div className="max-w-5xl mx-auto px-4 h-11 flex items-center gap-1 overflow-x-auto text-sm">
        {ITEMS.map((it) => {
          const on = it.key === current;
          return (
            <a key={it.key} href={it.href} onClick={(e) => go(e, it)} aria-current={on ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-colors ${on ? "bg-white text-brand-navy" : "text-white/80 hover:text-white hover:bg-white/10"}`}>
              <img src={it.icon} alt="" className="w-4 h-4 rounded" />
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
