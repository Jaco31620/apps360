/*
 * Carte d'une app (page d'accueil, aperçu dans le backoffice) : accroche colorée
 * dans le coin (une au plus), accès en bas. preview : sans lien.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AppIcon from "@/components/AppIcon";
import { ACCESS } from "@/lib/homeConfig";

// ici et non dans lib/ : Tailwind ne lit que app/ et components/
export const TAG_CLS = {
  orange: "bg-brand-orange text-brand-navy",
  teal: "bg-brand-teal text-brand-navy",
  navy: "bg-brand-navy text-white",
  red: "bg-[#C81E3A] text-white",
};

export function TagChip({ tag, className = "" }) {
  return <span className={`inline-block font-bold rounded-full ${className || "text-xs px-3 py-1"} ${TAG_CLS[tag.color]}`}>{tag.text}</span>;
}

export default function HomeCard({ app, preview = false }) {
  const cls = "group flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm p-8";
  const free = app.access !== "request";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3 mb-5">
        <AppIcon app={app.icon} className="w-16 h-16 group-hover:scale-110 transition-transform" />
        <span className="flex flex-col items-end gap-1.5">
          {app.tag && <TagChip tag={app.tag} />}
          {app.state === "test" && <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">En test</span>}
        </span>
      </div>
      <h2 className="font-outfit text-2xl font-extrabold text-brand-navy mb-2">{app.title}</h2>
      <p className="text-gray-500 leading-relaxed">{app.desc}</p>
      <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-gray-600">
          <span className={`w-2 h-2 rounded-full ${free ? "bg-brand-teal" : "bg-brand-orange"}`} aria-hidden="true" />{ACCESS[app.access]}
        </span>
        <span className="font-semibold text-brand-navy inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
          {free ? "Ouvrir l'app" : "Découvrir"} <ArrowRight size={16} className="text-brand-orange" aria-hidden="true" />
        </span>
      </div>
    </>
  );
  if (preview) return <div className={cls}>{body}</div>;
  return <Link href={app.href} className={`${cls} hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}>{body}</Link>;
}
