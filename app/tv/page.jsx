"use client";
/*
 * apps360.fr/tv — écran d'affichage du Jukebox sur une télé connectée (navigateur
 * de la télé, clé TV) : QR code à scanner avec le téléphone, qui choisit la
 * soirée (jumelage, /api/jukebox/tv), ou code saisi au pavé numérique de
 * l'écran (flèches + OK de la télécommande) ; dernier code retenu.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { formatCode, setAdminToken, getAdminToken } from "@/components/jukebox/storage";
import { TV_PAIRED_KEY } from "@/lib/jukebox";

const LAST_KEY = "jukebox:tvCode";
const SOUND_KEY = "jukebox:tvSound"; // dernière soirée ouverte en mode son
const SECRET_KEY = "jukebox:tvSecret";
// Jumelage : la télé garde un secret ; le QR code ne montre que son empreinte
// (identifiant de jumelage). Seule la télé peut donc relire la réponse du
// téléphone (et le jeton du mode son) : photographier le QR ne suffit pas.
const newSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const pairOf = async (secret) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))),
  (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

export default function TvPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState("");
  const secret = useRef("");
  const [origin, setOrigin] = useState("");
  const firstKey = useRef(null);

  useEffect(() => {
    let sec = "";
    try {
      setLast(localStorage.getItem(LAST_KEY) || "");
      sec = localStorage.getItem(SECRET_KEY) || "";
      if (!sec) { sec = newSecret(); localStorage.setItem(SECRET_KEY, sec); }
    } catch (e) { sec ||= newSecret(); /* stockage indisponible */ }
    secret.current = sec;
    pairOf(sec).then(setPair).catch(() => {});
    setOrigin(window.location.origin);
    firstKey.current?.focus();
  }, []);

  // jumelage : soirée choisie sur le téléphone qui a scanné le QR code. Rythme : 2 s
  // pendant 15 min, puis 10 s ; après 6 h sans action, arrêt (télé oubliée sur cette page) :
  // « appuyez sur OK » réaffiche le QR code et relance. Une touche ou un toucher repart à 2 s.
  const [asleep, setAsleep] = useState(false);
  const since = useRef(Date.now());
  useEffect(() => {
    const wake = () => { since.current = Date.now(); setAsleep(false); };
    window.addEventListener("keydown", wake);
    window.addEventListener("pointerdown", wake);
    return () => { window.removeEventListener("keydown", wake); window.removeEventListener("pointerdown", wake); };
  }, []);
  useEffect(() => {
    if (!pair || asleep) return;
    let timer = null, alive = true;
    const loop = async () => {
      const idle = Date.now() - since.current;
      if (idle > 6 * 3600e3) { setAsleep(true); return; }
      await check();
      if (alive) timer = setTimeout(loop, idle < 15 * 60e3 ? 2000 : 10000);
    };
    const check = async () => {
      if (document.hidden) return;
      try {
        const d = await (await fetch(`/api/jukebox/tv?id=${pair}&s=${secret.current}`, { cache: "no-store" })).json();
        if (d.code && d.app === "clicclac") { router.push(`/clic-clac/${d.code}/live?tv=1`); return; } // album photo
        if (d.code) {
          if (d.token) setAdminToken(d.code, d.token); // mode son : la télé devient le lecteur de la régie
          open(d.code, !!d.token, true); // choix fait sur le téléphone : la télé prend le son
        }
      } catch (e) { /* réseau : on retentera */ }
    };
    timer = setTimeout(loop, 2000);
    return () => { alive = false; clearTimeout(timer); };
  }, [pair, asleep]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (c, sound = false, claim = false) => {
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jukebox/${c}`, { cache: "no-store" });
      if (res.status === 404) throw new Error(`Aucune soirée avec le code ${formatCode(c)}.`);
      try {
        localStorage.setItem(LAST_KEY, c);
        localStorage.setItem(SOUND_KEY, sound ? "1" : "");
        localStorage.setItem(TV_PAIRED_KEY(c), "1"); // vraie télé : peut reprendre le son à la demande de la régie
      } catch (e) { /* stockage indisponible */ }
      router.push(`/jukebox/${c}/ecran${sound ? `?son=1${claim ? "&claim=1" : ""}` : ""}`);
    } catch (e) {
      setError(e.message || "Connexion impossible, réessayez.");
      setBusy(false);
    }
  };

  const press = (k) => {
    setError("");
    if (k === "⌫") setCode((c) => c.slice(0, -1));
    else if (k === "OK") open(code);
    else {
      const next = (code + k).slice(0, 6);
      setCode(next);
      if (next.length === 6) open(next); // 6 chiffres : ouverture directe
    }
  };

  // clavier physique ou touches chiffrées de la télécommande
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); press("⌫"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const digits = code.padEnd(6, "·");
  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-700 via-purple-800 to-indigo-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid gap-10 md:grid-cols-2 items-center">
        <div className="text-center md:text-left space-y-5">
          <h1 className="text-5xl font-black">📺 apps360 sur la télé</h1>
          <p className="text-xl text-white/70 -mt-2">🎶 Jukebox · 📸 Clic-Clac</p>
          {pair && origin && asleep && (
            <button type="button" onClick={() => { since.current = Date.now(); setAsleep(false); }}
              className="block w-full md:w-auto text-2xl font-bold bg-white/15 hover:bg-white/25 focus:bg-white/25 rounded-3xl px-8 py-6">
              ⏸ En veille · Appuyez sur OK pour réafficher le QR code
            </button>
          )}
          {pair && origin && !asleep && (
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="bg-white p-4 rounded-3xl shrink-0">
                <QRCodeSVG value={`${origin}/tv/${pair}`} size={512} style={{ width: "min(26vw, 42vh)", height: "min(26vw, 42vh)", minWidth: 220, minHeight: 220 }} />
              </div>
              <div className="text-center md:text-left space-y-2">
                <p className="text-2xl text-white/90">Scannez avec l'appareil photo du téléphone, ou depuis la télécommande Jukebox / Clic-Clac (📺 Connecter une télé).</p>
                <p className="text-lg text-white/60">Code télé : <span className="font-mono font-bold text-white tracking-widest">{pair.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ")}</span></p>
              </div>
            </div>
          )}
          <p className="text-xl text-white/70">Jukebox : ou saisissez le code de la soirée, affiché dans la régie :</p>
          <p className="font-mono text-6xl font-black tracking-[0.25em]">
            {digits.slice(0, 3)} {digits.slice(3)}
          </p>
          {error && <p className="text-2xl text-amber-300">{error}</p>}
          {busy && <p className="text-2xl text-white/70">Ouverture…</p>}
          {last && !code && (
            <button onClick={() => {
              let sound = false;
              try { sound = localStorage.getItem(SOUND_KEY) === "1" && !!getAdminToken(last); } catch (e) { /* stockage indisponible */ }
              open(last, sound);
            }}
              className="text-2xl font-bold bg-white/15 hover:bg-white/25 focus:bg-white focus:text-purple-900 outline-none rounded-full px-8 py-4">
              ▶ Reprendre la soirée {formatCode(last)}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto w-full">
          {KEYS.map((k, i) => (
            <button key={k} ref={i === 0 ? firstKey : null} onClick={() => press(k)} disabled={busy}
              className={`aspect-square rounded-3xl text-5xl font-black outline-none transition
                focus:scale-110 focus:ring-8 focus:ring-white ${k === "OK" ? "bg-green-500 hover:bg-green-600" : "bg-white/15 hover:bg-white/25"}
                ${k === "OK" && code.length !== 6 ? "opacity-40" : ""}`}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
