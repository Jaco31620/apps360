"use client";
/*
 * Clic-Clac — affiche à imprimer (/clic-clac/<code>/affiche) : QR code, code de
 * l'album et mode d'emploi en 3 étapes. Deux formats : affiche A4, ou 4 petits
 * chevalets par feuille A4 (à découper, pour les tables). Infos publiques
 * uniquement (celles que voient les invités).
 */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, formatDate } from "./client";

const STEPS = [
  ["📱", "Scannez le QR code", "avec l'appareil photo de votre téléphone"],
  ["👋", "Indiquez votre prénom", "aucune application à installer"],
  ["📸", "Prenez vos photos", "elles rejoignent l'album de la soirée !"],
];

export default function Poster({ code }) {
  const [album, setAlbum] = useState(undefined);
  const [format, setFormat] = useState("a4"); // a4 | cards
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    api(`/${code}`).then((d) => setAlbum(d.album)).catch(() => setAlbum(null));
  }, [code]);

  if (album === undefined) return <p className="p-10 text-center text-gray-400">Chargement…</p>;
  if (album === null) return <p className="p-10 text-center text-gray-500">Album introuvable.</p>;
  const url = `${origin}/clic-clac/${code}`;
  const host = origin.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-screen bg-gray-200 print:bg-white py-6 print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print { html, body { background: #fff; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>

      <div className="print:hidden max-w-[210mm] mx-auto mb-4 px-4 flex flex-wrap items-center gap-2">
        <span className="font-bold text-gray-700 mr-2">Format :</span>
        {[["a4", "Affiche A4"], ["cards", "4 chevalets de table (A4 à découper)"]].map(([v, l]) => (
          <button key={v} onClick={() => setFormat(v)} className={`px-4 py-2 rounded-full text-sm font-semibold ${format === v ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}>{l}</button>
        ))}
        <div className="flex-1" />
        <button onClick={() => window.print()} className="px-5 py-2 rounded-full text-sm font-bold bg-[#ff5a5f] text-white">🖨️ Imprimer</button>
      </div>

      <div className="bg-white mx-auto shadow-xl print:shadow-none overflow-hidden" style={{ width: "210mm", height: "297mm" }}>
        {format === "a4" ? (
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-br from-[#ff5a5f] to-[#ffb347] text-white text-center px-[14mm] pt-[14mm] pb-[12mm]">
              <p className="text-[5mm] font-bold uppercase tracking-[0.3em] opacity-90">📸 Clic-Clac</p>
              <p className="text-[14mm] leading-none font-black mt-[5mm] break-words">{album.name}</p>
              {album.eventDate && <p className="text-[6mm] mt-[3mm] opacity-90">{formatDate(album.eventDate)}</p>}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-[7mm] px-[14mm]">
              <p className="text-[9mm] font-black text-gray-900 text-center leading-tight">Partagez vos photos de la soirée !</p>
              {origin && <QRCodeSVG value={url} size={300} marginSize={1} style={{ width: "88mm", height: "88mm" }} />}
              <p className="text-[5mm] text-gray-500">ou rendez-vous sur <b className="text-gray-800">{host}/clic-clac</b> avec le code</p>
              <p className="text-[16mm] leading-none font-black tracking-[0.25em] text-gray-900">{code}</p>
            </div>
            <div className="grid grid-cols-3 gap-[5mm] px-[14mm] pb-[16mm]">
              {STEPS.map(([e, t, d], i) => (
                <div key={t} className="bg-orange-50 rounded-[5mm] p-[5mm] text-center">
                  <p className="text-[10mm] leading-none">{e}</p>
                  <p className="text-[4.6mm] font-black text-gray-900 mt-[2mm]">{i + 1}. {t}</p>
                  <p className="text-[3.6mm] text-gray-600 mt-[1mm] leading-snug">{d}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-2 grid-rows-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border border-dashed border-gray-300 flex flex-col items-center justify-center text-center px-[8mm] gap-[3mm]">
                <p className="text-[3.6mm] font-bold uppercase tracking-[0.25em] text-[#ff5a5f]">📸 Clic-Clac</p>
                <p className="text-[6.5mm] font-black text-gray-900 leading-tight break-words">{album.name}</p>
                <p className="text-[4.2mm] font-semibold text-gray-700">Partagez vos photos !</p>
                {origin && <QRCodeSVG value={url} size={200} marginSize={1} style={{ width: "48mm", height: "48mm" }} />}
                <p className="text-[3.4mm] text-gray-500 leading-snug">Scannez avec l'appareil photo<br />ou code <b className="text-gray-900 tracking-widest">{code}</b> sur {host}/clic-clac</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
