"use client";
/*
 * apps360.fr/tv — écran d'affichage (Jukebox, Clic-Clac, Nuage de mots) sur une
 * télé connectée (navigateur de la télé, clé TV), aux couleurs d'apps360 :
 *  - QR code à scanner avec le téléphone, qui choisit quoi afficher (jumelage,
 *    /api/jukebox/tv) ;
 *  - « Reprendre » : derniers affichages de cette télé (app et nom) ;
 *  - code à 6 chiffres (soirée Jukebox ou nuage) au petit pavé de l'écran.
 * Télécommande : flèches + OK (déplacement géré ici). Tailles en em, calées sur
 * la taille de l'écran : tout tient sans défiler, de 960×540 à la 4K.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { formatCode, setAdminToken, getAdminToken } from "@/components/jukebox/storage";
import { APPS, loadRecents, remember, forget, rename, lookup, when } from "@/components/tv/recents";
import { TV_PAIRED_KEY } from "@/lib/jukebox";
import AppIcon from "@/components/AppIcon";

const SECRET_KEY = "jukebox:tvSecret";
// Jumelage : la télé garde un secret ; le QR code ne montre que son empreinte
// (identifiant de jumelage). Seule la télé peut donc relire la réponse du
// téléphone (et le jeton du mode son) : photographier le QR ne suffit pas.
const newSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const pairOf = async (secret) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))),
  (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫", "OK"];
const focusCls = "outline-none transition focus:ring-[0.25em] focus:ring-brand-orange";

/* Flèches de la télécommande : élément le plus proche dans la direction. */
function moveFocus(dir) {
  const els = [...document.querySelectorAll("[data-tv]:not(:disabled)")];
  const cur = document.activeElement;
  if (!els.includes(cur)) { els[0]?.focus(); return; }
  const c = cur.getBoundingClientRect();
  const x = c.left + c.width / 2, y = c.top + c.height / 2;
  let best = null, score = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
    const along = dir === "ArrowRight" ? dx : dir === "ArrowLeft" ? -dx : dir === "ArrowDown" ? dy : -dy;
    if (along < 4) continue;
    const horizontal = dir === "ArrowRight" || dir === "ArrowLeft";
    const s = along + 3 * Math.abs(horizontal ? dy : dx);
    if (s < score) { score = s; best = el; }
  }
  best?.focus();
}

export default function TvPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recents, setRecents] = useState(null); // null : pas encore lus
  const [choice, setChoice] = useState(null); // même code dans deux apps : [{ app, code, name }]
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState("");
  const [origin, setOrigin] = useState("");
  const [px, setPx] = useState(16); // taille de base
  const secret = useRef("");
  const opening = useRef(false);

  useEffect(() => {
    let sec = "";
    try {
      sec = localStorage.getItem(SECRET_KEY) || "";
      if (!sec) { sec = newSecret(); localStorage.setItem(SECRET_KEY, sec); }
    } catch (e) { sec ||= newSecret(); /* stockage indisponible */ }
    secret.current = sec;
    pairOf(sec).then(setPair).catch(() => {});
    setOrigin(window.location.origin);
    const list = loadRecents();
    setRecents(list);
    // ancienne entrée sans nom : relue une seule fois
    list.filter((r) => !r.name).forEach((r) => lookup(r.app, r.code)
      .then((d) => { remember(r); setRecents(d.found && d.name ? rename(r, d.name) : d.closed ? rename(r, "Soirée fermée") : forget(r)); }).catch(() => {}));
  }, []);

  useEffect(() => {
    const fit = () => setPx(window.innerWidth < 768 ? 16 : Math.max(9, Math.min(window.innerWidth / 80, window.innerHeight / 45)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // premier élément sélectionné : « Reprendre » s'il y en a, sinon le pavé
  useEffect(() => { if (recents) document.querySelector("[data-tv]")?.focus({ preventScroll: true }); }, [recents === null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (choice) document.querySelector("[data-choice]")?.focus(); }, [choice]);

  // jumelage : affichage choisi sur le téléphone qui a scanné le QR code. Rythme : 2 s
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
        if (!d.code || !APPS[d.app]) return;
        if (d.token) setAdminToken(d.code, d.token); // mode son : la télé devient le lecteur de la soirée
        go({ app: d.app, code: d.code, name: d.name || "", sound: !!d.token }, true); // choix fait sur le téléphone : la télé prend le son
      } catch (e) { /* réseau : on retentera */ }
    };
    timer = setTimeout(loop, 2000);
    return () => { alive = false; clearTimeout(timer); };
  }, [pair, asleep]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Ouvre l'écran (déjà vérifié) et le retient pour « Reprendre ». */
  const go = (r, claim = false) => {
    opening.current = true;
    setBusy(true);
    setError("");
    remember({ app: r.app, code: r.code, name: r.name || "", sound: !!r.sound });
    if (r.app === "clicclac") return router.push(`/clic-clac/${r.code}/live?tv=1`);
    if (r.app === "nuage") return router.push(`/nuage/${r.code}/presenter?affichage&tv=1`);
    try { localStorage.setItem(TV_PAIRED_KEY(r.code), "1"); } catch (e) { /* stockage indisponible */ } // vraie télé : peut reprendre le son à la demande de l'organisateur
    router.push(`/jukebox/${r.code}/ecran${r.sound ? `?son=1${claim ? "&claim=1" : ""}` : ""}`);
  };

  const resume = async (r) => {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const d = await lookup(r.app, r.code);
      if (!d.found) {
        if (!d.closed) setRecents(forget(r));
        throw new Error(d.closed ? `La soirée « ${r.name || formatCode(r.code)} » est fermée.` : APPS[r.app].missing);
      }
      go({ ...r, name: d.name || r.name, sound: r.app === "jukebox" && r.sound && !!getAdminToken(r.code) });
    } catch (e) { opening.current = false; setBusy(false); setError(e.message || "Connexion impossible, réessayez."); }
  };

  /* Code à 6 chiffres : soirée Jukebox ou nuage (les deux peuvent exister). */
  const openCode = async (c) => {
    if (c.length !== 6 || opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const [j, n] = await Promise.all(["jukebox", "nuage"].map((app) => lookup(app, c).then((d) => ({ ...d, app, code: c })).catch(() => ({ app, failed: true }))));
      const hits = [j, n].filter((d) => d.found);
      if (hits.length === 1 && !j.failed && !n.failed) return go(hits[0]);
      if (hits.length) { setChoice(hits); opening.current = false; setBusy(false); return; }
      if (j.failed || n.failed) throw new Error("Connexion impossible, réessayez.");
      throw new Error(j.closed ? `La soirée ${formatCode(c)} est fermée.` : `Aucune soirée ni nuage avec le code ${formatCode(c)}.`);
    } catch (e) { opening.current = false; setBusy(false); setCode(""); setError(e.message || "Connexion impossible, réessayez."); }
  };

  const press = (k) => {
    if (opening.current) return;
    setError("");
    setChoice(null);
    if (k === "⌫") setCode((c) => c.slice(0, -1));
    else if (k === "OK") openCode(code);
    else {
      const next = (code.length === 6 ? k : code + k);
      setCode(next);
      if (next.length === 6) openCode(next); // 6 chiffres : ouverture directe
    }
  };

  // flèches, clavier physique ou touches chiffrées de la télécommande
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) { e.preventDefault(); moveFocus(e.key); }
      else if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace" && code) { e.preventDefault(); press("⌫"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const digits = code.padEnd(6, "·");
  const list = recents || [];
  return (
    <div style={{ fontSize: px }} className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white flex flex-col px-[2.5em] py-[1.8em]">
      <header className="flex flex-wrap items-center justify-between gap-x-[2em] gap-y-[0.8em]">
        <img src="/brand/apps360-logo-fond-sombre.svg" alt="apps360.fr" className="h-[2.8em] w-auto" />
        <p className="flex flex-wrap gap-x-[1.4em] gap-y-[0.4em] text-[1.1em] text-brand-mist">
          {list.length > 0 && Object.entries(APPS).map(([k, a]) => (
            <span key={k} className="inline-flex items-center gap-[0.5em]"><AppIcon app={k} className="w-[1.7em] h-[1.7em]" /> {a.label}</span>
          ))}
        </p>
      </header>

      <main className="flex-1 grid gap-[2.5em] md:grid-cols-[27em_minmax(0,1fr)] items-center py-[1.5em]">
        {/* téléphone : la façon normale */}
        <section className="text-center">
          <h1 className="font-outfit font-extrabold text-[2em] leading-tight">Scannez pour afficher</h1>
          <p className="text-[1.1em] text-brand-mist mt-[0.3em] mb-[1em]">avec l'appareil photo de votre téléphone</p>
          {asleep ? (
            <button type="button" data-tv onClick={() => { since.current = Date.now(); setAsleep(false); }}
              className={`w-full text-[1.3em] font-bold bg-white/10 hover:bg-white/20 rounded-[1em] px-[1.5em] py-[3em] ${focusCls}`}>
              ⏸ En veille · Appuyez sur OK pour réafficher le QR code
            </button>
          ) : (
            <div className="inline-block bg-white p-[1.1em] rounded-[1.6em]">
              <div className="w-[17em] h-[17em]">
                {pair && origin && <QRCodeSVG value={`${origin}/tv/${pair}`} size={512} fgColor="#0E2350" style={{ width: "100%", height: "100%" }} />}
              </div>
            </div>
          )}
          <p className="text-brand-mist mt-[1em]">Ou dans l'app, bouton <b className="text-white">📺 Connecter une télé</b>
            {pair && <><br />Code télé : <span className="font-mono font-bold text-white tracking-widest">{pair.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ")}</span></>}</p>
        </section>

        <div className="min-w-0 space-y-[1.6em]">
          {(list.length > 0 || choice) && (
            <section>
              <h2 className="font-outfit font-extrabold text-[1.5em] mb-[0.6em]">{choice ? "Que voulez-vous afficher ?" : "Reprendre"}</h2>
              <div className={`grid gap-[0.9em] ${(choice || list).length > 1 ? "sm:grid-cols-2" : ""}`}>
                {(choice || list).map((r) => (
                  <button key={r.app + r.code} data-tv data-choice={choice ? "" : undefined} disabled={busy} onClick={() => (choice ? go(r) : resume(r))}
                    className={`min-w-0 flex items-center gap-[1em] text-left bg-white/10 hover:bg-white/20 focus:bg-white focus:text-brand-navy rounded-[1.2em] p-[1em] group disabled:opacity-60 ${focusCls}`}>
                    <AppIcon app={r.app} className="w-[3.6em] h-[3.6em]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95em] text-brand-mist group-focus:text-brand-grey">{APPS[r.app].label}</span>
                      <span className="font-bold text-[1.25em] leading-tight line-clamp-2 break-words">{r.name || formatCode(r.code)}</span>
                      {!choice && <span className="block text-[0.85em] text-brand-mist group-focus:text-brand-grey mt-[0.2em]">{when(r.at)}{r.app === "jukebox" && r.sound ? " · 🔊 avec le son" : ""}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recents && !list.length && !choice && (
            <section>
              <h2 className="font-outfit font-extrabold text-[1.5em] mb-[0.6em]">Sur cet écran</h2>
              <ul className="space-y-[0.9em]">
                {Object.entries(APPS).map(([k, a]) => (
                  <li key={k} className="flex items-center gap-[1em]">
                    <AppIcon app={k} className="w-[3em] h-[3em]" />
                    <span><span className="block font-bold text-[1.15em]">{a.label}</span><span className="block text-brand-mist">{a.desc}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-white/5 rounded-[1.2em] p-[1.2em]">
            <div className="flex flex-wrap items-center justify-between gap-[1em]">
              <div>
                <h2 className="font-outfit font-bold text-[1.15em]">Ou tapez un code</h2>
                <p className="text-[0.9em] text-brand-mist">Soirée Jukebox ou nuage de mots</p>
                <p className="font-mono text-[2.3em] font-black tracking-[0.15em] leading-tight mt-[0.15em]">{digits.slice(0, 3)} {digits.slice(3)}</p>
              </div>
              <div className="grid grid-cols-6 gap-[0.5em]">
                {KEYS.map((k) => (
                  <button key={k} data-tv onClick={() => press(k)} disabled={busy} aria-label={k === "⌫" ? "Effacer" : undefined}
                    className={`w-[2.9em] h-[2.9em] rounded-[0.8em] font-bold text-[1.1em] ${focusCls} focus:bg-white focus:text-brand-navy
                      ${k === "OK" ? "bg-brand-orange text-brand-navy" : "bg-white/10 hover:bg-white/20"} ${k === "OK" && code.length !== 6 ? "opacity-40" : ""}`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <p role="status" className={`text-[1.2em] min-h-[1.5em] ${error ? "text-brand-orange font-semibold" : "text-brand-mist"}`}>{error || (busy ? "Ouverture…" : "")}</p>
        </div>
      </main>
    </div>
  );
}
