"use client";
/* Régie / télécommande, « Inviter & accès » : faire venir les invités (QR
 * code en grand, message à envoyer dans le groupe de la soirée, affiche à
 * imprimer), écran d'affichage (ouvrir, lien à copier : sans accès régie, à
 * ouvrir sur l'ordinateur ou la télé qui affiche), télé connectée, mode d'emploi. */
import { useEffect, useState } from "react";
import Link from "next/link";
import ShareActions from "./ShareActions";
import { guestText } from "@/lib/jukeboxMessages";

export default function GuestShare({ code, name, endsAt, onQr, onTv }) {
  const [open, setOpen] = useState(null); // "guests" | "screen" | null
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const tile = "flex items-center justify-center gap-1.5 text-center font-bold bg-white/10 hover:bg-white/20 active:bg-white/20 rounded-2xl py-3 text-sm";
  const toggle = (k) => setOpen((v) => (v === k ? null : k));
  const screenUrl = `${origin}/jukebox/${code}/ecran`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => toggle("guests")} className={`${tile} ${open === "guests" ? "!bg-fuchsia-600" : ""}`}>📣 Inviter</button>
        <Link href={`/jukebox/${code}/affiche`} target="_blank" className={tile}>🖨️ Affiche à imprimer</Link>
      </div>
      {open === "guests" && origin && (
        <div className="bg-white/5 rounded-2xl p-3 space-y-2">
          {onQr && <button type="button" onClick={onQr} className="w-full font-bold bg-white/10 hover:bg-white/20 rounded-full py-2 text-sm">🔳 Montrer le QR code en grand</button>}
          <pre className="whitespace-pre-wrap break-words text-xs text-white/80 font-sans">{guestText({ origin, code, name })}</pre>
          <ShareActions dark subject={`Jukebox « ${name} »`} message={guestText({ origin, code, name })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => toggle("screen")} className={`${tile} ${onTv ? "" : "col-span-2"} ${open === "screen" ? "!bg-fuchsia-600" : ""}`}>📺 Écran d'affichage</button>
        {onTv && <button type="button" onClick={onTv} className={tile}>📺 Connecter une télé</button>}
      </div>
      {open === "screen" && origin && (
        <div className="bg-white/5 rounded-2xl p-3 space-y-2">
          <Link href={`/jukebox/${code}/ecran`} target="_blank" className="block text-center font-bold bg-white/10 hover:bg-white/20 rounded-full py-2 text-sm">Ouvrir l'écran ici</Link>
          <p className="font-mono text-sm text-white break-all">{screenUrl}</p>
          <p className="text-xs text-white/60">À ouvrir sur l'ordinateur ou la télé qui affiche la soirée (vidéo, file, QR invités). Affichage seul : le son reste sur l'appareil qui joue. Pour le son sur la télé : « Connecter une télé ».</p>
          <ShareActions dark subject={`Jukebox « ${name} » : écran`} message={screenUrl} />
        </div>
      )}
      {endsAt && <p className="text-center text-xs text-white/60">⏳ Soirée ouverte jusqu'au {new Date(endsAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · <Link href={`/jukebox?prolonger=${code}`} className="underline">demander une prolongation</Link></p>}
      <Link href="/jukebox/aide" target="_blank" className="block text-center text-xs text-white/50 hover:text-white underline">❓ Mode d'emploi</Link>
    </div>
  );
}
