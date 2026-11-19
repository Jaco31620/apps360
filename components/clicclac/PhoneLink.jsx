"use client";
/*
 * Clic-Clac — « 📱 Sur mon téléphone » (espace organisateur) : QR code à
 * scanner avec le téléphone pour y être connecté sans saisir le code
 * organisateur. Passe à usage unique, valable 10 minutes.
 */
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "./client";

export default function PhoneLink({ code, token, onClose }) {
  const [target, setTarget] = useState("admin"); // admin | telecommande
  const [pass, setPass] = useState(null); // { pass, expiresAt }
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());

  const make = useCallback(async () => {
    setErr("");
    setPass(null);
    try { setPass(await api(`/${code}/auth`, { method: "POST", token, body: { pass: true } })); }
    catch (e) { setErr(e.message); }
  }, [code, token]);
  useEffect(() => { make(); }, [make]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const left = pass ? Math.max(0, Math.round((new Date(pass.expiresAt).getTime() - now) / 1000)) : 0;
  const url = pass ? `${window.location.origin}/clic-clac/${code}/${target}#j=${pass.pass}` : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl">
        <div className="flex items-start">
          <h3 className="flex-1 text-lg font-black text-left">📱 Ouvrir sur mon téléphone</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="flex gap-1.5 justify-center">
          {[["admin", "Espace organisateur"], ["telecommande", "Télécommande écran"]].map(([v, l]) => (
            <button key={v} onClick={() => setTarget(v)} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${target === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
          ))}
        </div>
        {err ? <p className="text-red-600 text-sm">{err}</p> : pass && left > 0 ? (
          <>
            <div className="inline-block p-3 border rounded-2xl"><QRCodeSVG value={url} size={220} /></div>
            <p className="text-sm text-gray-500">Scannez avec l'appareil photo du téléphone : il sera connecté <b>sans code</b>, pour 7 jours.</p>
            <p className="text-xs text-gray-400">QR à usage unique · expire dans {Math.floor(left / 60)} min {String(left % 60).padStart(2, "0")} s</p>
          </>
        ) : pass ? <p className="text-gray-500 text-sm">Ce QR code a expiré.</p> : <p className="text-gray-400 text-sm py-10">Préparation…</p>}
        <button onClick={make} className="text-sm text-gray-500 underline">Nouveau QR code</button>
      </div>
    </div>
  );
}
