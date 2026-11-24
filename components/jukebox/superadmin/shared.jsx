"use client";
import { SEARCH_MODES, VALID_CHOICES, validLabel } from "@/lib/jukebox";

export const CREATION_MODES = [
  { id: "open", label: "Tout le monde", hint: "Toute personne qui connaît l'adresse /jukebox peut créer une soirée." },
  { id: "code", label: "Avec un code", hint: "Chaque organisateur saisit son propre code d'activation (onglet 🎟️ Codes)." },
  { id: "super", label: "Super-admin seul", hint: "Vous créez les soirées ici et transmettez l'accès organisateur." },
];
export const fmtDate = (ms) => new Date(ms).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const FR_NEXT = { true: false, false: null, null: true }; // clic sur la langue : 🇫🇷 → 🌍 → ❓
export const MODE_TAG = {
  normal: "bg-sky-100 text-sky-700",
  clip: "bg-emerald-100 text-emerald-700",
  karaoke: "bg-fuchsia-100 text-fuchsia-700",
};

/* Fermeture automatique d'une soirée, N jours après sa création ; value null = jamais. */
export function ValiditySelect({ value, onChange, className = "" }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      title="La soirée se ferme automatiquement ce délai après sa création : plus accessible aux invités ni à l'organisateur. Vous pouvez la rouvrir en allongeant le délai, ou la supprimer."
      className={`border-2 border-gray-200 rounded-xl px-2 py-1.5 font-semibold ${className}`}>
      <option value="">Fermeture : jamais</option>
      {VALID_CHOICES.map((n) => <option key={n} value={n}>Fermeture : {validLabel(n)} après création</option>)}
    </select>
  );
}

export const modeLabel = (m) => SEARCH_MODES.find((x) => x.id === m)?.label || m;
export const MODE_ICON = { normal: "📝", clip: "🎬", karaoke: "🎤" };
const MODE_TEXT = { normal: "text-sky-700", clip: "text-emerald-700", karaoke: "text-fuchsia-700" };
/* Version d'une ligne (au-dessus du titre) : bien visible, une couleur par version. */
export function VersionLabel({ mode, className = "" }) {
  return <p className={`text-[11px] font-black uppercase tracking-wider ${MODE_TEXT[mode] || "text-gray-500"} ${className}`}>{MODE_ICON[mode] || "•"} Version {modeLabel(mode)}</p>;
}

/* Champ de recherche avec croix pour l'effacer (Échap efface aussi). */
export function SearchInput({ value, onChange, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } }}
        className="w-full border-2 border-gray-200 bg-white rounded-full pl-4 pr-9 py-1.5 text-sm focus:border-fuchsia-500 outline-none" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Effacer la recherche" title="Effacer"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs font-bold leading-6 text-center">✕</button>
      )}
    </div>
  );
}

/* Provenance de la vidéo retenue (jukebox_versions.source, source_session, created_at). */
export const SOURCE = {
  guest: "invité en soirée",
  regie: "organisateur en soirée",
  link: "lien YouTube en soirée",
  prefill: "pré-remplissage",
  scan: "recherche de nuit",
  manual: "super-admin",
  copy: "copie d'une autre version",
  search: "recherche auto (invité, organisateur ou pré-remplissage)",
  migration: "origine inconnue (avant le 03/11/2026)",
};
/* « 📍 ajouté le 21/11/2026 · invité en soirée « Anniv » » */
export function Provenance({ song, className = "" }) {
  if (!song.createdAt && !song.source) return null;
  return (
    <span className={className} title="D'où vient la vidéo de ce titre">
      📍 {song.createdAt ? `ajouté le ${new Date(song.createdAt).toLocaleDateString("fr-FR")}` : "ajouté"}
      {song.source && <> · {song.source === "guest" && song.sourceAuthor ? `invité ${song.sourceAuthor} en soirée` : SOURCE[song.source] || song.source}</>}
      {song.sourceSession && <> « {song.sourceSession} »</>}
    </span>
  );
}
