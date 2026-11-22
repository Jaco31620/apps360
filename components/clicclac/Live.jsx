"use client";
/*
 * Clic-Clac — écran live (TV / vidéoprojecteur).
 * Affichages : photo seule (fondu, zoom lent, glissement), mosaïque, mur de
 * polaroïds. Réglages (organisateur seulement, partagés avec la télécommande) : vitesse, ordre (récentes,
 * chronologique, aléatoire), nouvelles photos en priorité + bandeau, légendes,
 * QR code. Plein écran (bouton ou F) ; organisateur : pause (espace ou OK), ← →.
 * Diaporama SYNCHRONISÉ : tous les écrans ouverts montrent la même photo au
 * même moment (programme commun tenu par le serveur, voir lib/clicclac/liveSeq.js),
 * piloté depuis la télécommande Clic-Clac. ?tv=1 : écran ouvert par apps360.fr/tv.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, syncPhotos, useWakeLock, adminToken, superToken } from "./client";
import { normalizeLive } from "@/lib/clicclac/settings";
import { photoAt, durationMs } from "@/lib/clicclac/liveSeq";
import { LIVE_DEFAULTS as DEFAULTS, LIVE_SPEEDS as SPEEDS, LIVE_ORDERS as ORDERS, LIVE_LAYOUTS as LAYOUTS, LIVE_TRANSITIONS as TRANSITIONS, LIVE_QR_SIZES, liveSpeedLabel } from "@/lib/clicclac/settings";
const MOSAIC = 12;

/* Préchargement des photos en grand (→ proportions, ou null si échec / trop long). */
const pre = new Map();
function preload(url) {
  if (!url) return Promise.resolve(null);
  if (!pre.has(url)) {
    if (pre.size > 24) pre.delete(pre.keys().next().value);
    pre.set(url, new Promise((res) => {
      const img = new Image();
      const t = setTimeout(() => res(null), 8000); // trop long : on affiche quand même
      img.onload = () => {
        clearTimeout(t);
        const r = img.naturalWidth / img.naturalHeight;
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(r));
      };
      img.onerror = () => { clearTimeout(t); pre.delete(url); res(null); };
      img.src = url;
    }));
  }
  return pre.get(url);
}

export default function Live({ code }) {
  const [album, setAlbum] = useState(undefined);
  const [count, setCount] = useState(0);
  const [cfg, setCfg] = useState(DEFAULTS);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]); // photos déjà montrées (mosaïque / mur)
  const [banner, setBanner] = useState(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [ui, setUi] = useState(true);
  const [panel, setPanel] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [origin, setOrigin] = useState("");
  const [fromTv, setFromTv] = useState(false); // ouvert depuis apps360.fr/tv : bouton de retour au QR code
  const [screen, setScreen] = useState({ w: 1280, h: 720 });
  const [qrBox, setQrBox] = useState({ w: 0, h: 0 });
  const [ratios, setRatios] = useState({}); // proportions des photos (id → largeur/hauteur)
  const qrRef = useRef(null);
  const listRef = useRef([]);
  const stateRef = useRef(null); // programme du diaporama (serveur)
  const clock = useRef({ off: 0, rtt: Infinity }); // écart avec l'horloge du serveur
  const lastRev = useRef(-1);
  const hideT = useRef(null);
  const cfgRef = useRef(cfg);
  const currentRef = useRef(null);
  const seeded = useRef(false); // historique reconstitué au premier affichage
  const [shown, setShown] = useState(null); // photo seule : affichée une fois chargée
  const [under, setUnder] = useState(null); // …la précédente, laissée dessous pendant l'arrivée
  const shownRef = useRef(null);
  cfgRef.current = cfg;
  useWakeLock(); // l'écran ne doit pas se mettre en veille pendant la soirée
  // réglages et commandes depuis l'écran : réservés à l'organisateur connecté
  // sur cet appareil (les autres écrans n'ont que le plein écran)
  const [org, setOrg] = useState(null);
  const orgRef = useRef(null);
  orgRef.current = org;
  useEffect(() => {
    const t = adminToken(code) || superToken();
    if (t) api(`/${code}`, { token: t }).then((d) => { if (d.role === "admin" || d.role === "super") setOrg(t); }).catch(() => {});
  }, [code]);

  // dimensions de l'écran et de la pastille QR (pour ne jamais la recouvrir)
  useEffect(() => {
    const measure = () => {
      setScreen({ w: window.innerWidth, h: window.innerHeight });
      const r = qrRef.current?.getBoundingClientRect();
      setQrBox(r ? { w: Math.round(r.width), h: Math.round(r.height) } : { w: 0, h: 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (qrRef.current) ro.observe(qrRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [cfg.qr, album]);

  useEffect(() => { setOrigin(window.location.origin); setFromTv(new URLSearchParams(window.location.search).get("tv") === "1"); }, []);
  const send = (body) => { if (orgRef.current) api(`/${code}/live`, { method: "POST", token: orgRef.current, body }).catch(() => {}); };
  // changement fait sur l'écran (organisateur) : appliqué ici, puis partout
  const change = (patch) => { setCfg((c) => ({ ...c, ...patch })); send({ cfg: patch }); };
  const togglePause = () => { const next = !pausedRef.current; setPaused(next); send({ paused: next }); };
  const togglePauseRef = useRef(togglePause);
  togglePauseRef.current = togglePause;

  // photos publiées (liens signés tenus à jour)
  const load = useCallback(async () => {
    try {
      const d = await api(`/${code}`);
      setAlbum(d.album);
      listRef.current = await syncPhotos(code, listRef.current);
      setCount(listRef.current.length);
    } catch (e) { if (e.status === 404) setAlbum(null); }
  }, [code]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  // état partagé (programme, réglages, pause) + horloge du serveur. Chaque écran
  // a un identifiant (par onglet), accuse réception de la version appliquée, et se
  // recharge tout seul après une mise à jour du site (télés laissées allumées).
  useEffect(() => {
    const tv = new URLSearchParams(window.location.search).get("tv") === "1";
    let id = "";
    try { id = sessionStorage.getItem("cc_screen") || ""; } catch (e) { /* stockage indisponible */ }
    if (!/^[a-z0-9]{8,32}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
      try { sessionStorage.setItem("cc_screen", id); } catch (e) { /* stockage indisponible */ }
    }
    let build = null;
    const poll = async () => {
      try {
        const t0 = Date.now();
        const st = await api(`/${code}/live?screen=${id}&ack=${Math.max(0, lastRev.current)}${tv ? "&tv=1" : ""}`);
        const t1 = Date.now();
        if (build && st.build && st.build !== build) { window.location.reload(); return; } // nouvelle version du site
        build = st.build || build;
        // horloge : on garde la mesure la plus fiable (aller-retour le plus court)
        const c = clock.current, rtt = t1 - t0;
        if (st.now && (rtt <= c.rtt * 1.5 || rtt < 400)) { c.off = st.now - (t0 + t1) / 2; c.rtt = Math.min(c.rtt, rtt); }
        stateRef.current = st;
        if (st.rev !== lastRev.current) {
          lastRev.current = st.rev;
          setCfg(normalizeLive(st.cfg));
          setPaused(!!st.paused);
        }
        tick();
      } catch (e) { /* réseau : on retentera */ }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // photo du moment : calculée à partir de l'heure du serveur → la même sur tous les écrans
  const tick = () => {
    const st = stateRef.current;
    if (!st) return;
    const r = photoAt(st, listRef.current, Date.now() + clock.current.off);
    let p = r.photo;
    if (p) p = listRef.current.find((x) => x.id === p.id) || p; // liens les plus récents
    // photo suivante préchargée pendant celle-ci (photo seule : affichage en grand)
    if (p && cfgRef.current.layout === "single" && Number.isFinite(r.until)) {
      const n = photoAt(st, listRef.current, r.until + 1).photo;
      const nf = n && (listRef.current.find((x) => x.id === n.id) || n);
      if (nf?.full) preload(nf.full);
    }
    if ((p?.id || null) === (currentRef.current?.id || null)) return;
    currentRef.current = p;
    setCurrent(p);
    if (!p) return;
    // premier affichage (ouverture, rechargement après une mise à jour du site) :
    // on reconstitue les photos des créneaux précédents, pour retrouver un mur
    // déjà rempli plutôt qu'un écran vide — le même sur tous les écrans
    let past = [];
    if (!seeded.current && listRef.current.length) {
      seeded.current = true;
      const now = Date.now() + clock.current.off, d = durationMs(st.cfg), seen = new Set([p.id]);
      for (let i = 1; i <= 120 && past.length < 63; i++) {
        const q = photoAt(st, listRef.current, now - i * d).photo;
        const full = q && listRef.current.find((x) => x.id === q.id);
        if (full && !seen.has(full.id)) { seen.add(full.id); past.push(full); }
      }
    }
    setHistory((h) => [p, ...past, ...h.filter((x) => x.id !== p.id && !past.some((y) => y.id === x.id))].slice(0, 64)); // mosaïque : 12 ; pêle-mêle : jusqu'à 45
    if (r.fresh && cfgRef.current.newFirst) { setBanner(p); setTimeout(() => setBanner((b) => (b?.id === p.id ? null : b)), 4500); }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => { const t = setInterval(() => tickRef.current(), 250); return () => clearInterval(t); }, []);

  // photo seule : on attend que la photo soit chargée avant de l'afficher
  useEffect(() => {
    if (!current) { shownRef.current = null; setShown(null); setUnder(null); return; }
    let alive = true;
    preload(current.full).then((r) => {
      if (!alive) return;
      if (r) setRatios((m) => (m[current.id] === r ? m : { ...m, [current.id]: r }));
      const prev = shownRef.current;
      setUnder(prev && prev.id !== current.id ? prev : null);
      shownRef.current = current;
      setShown(current);
    });
    return () => { alive = false; };
  }, [current]);

  // plein écran, clavier (organisateur : pause, ← →), barre auto-masquée
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.());
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    const onKey = (e) => {
      wake(); // télécommande de la télé : les boutons réapparaissent
      if (e.target.tagName === "SELECT") return;
      if (e.key === "f" || e.key === "F") fullscreen();
      else if (!orgRef.current) return; // écran public (télé…) : rien d'autre, il suit le programme commun
      else if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); togglePauseRef.current(); }
      else if (e.key === "ArrowRight") send({ cmd: { type: "next" } });
      else if (e.key === "ArrowLeft") send({ cmd: { type: "prev" } });
    };
    const wake = () => { setUi(true); clearTimeout(hideT.current); hideT.current = setTimeout(() => setUi(false), 3500); };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", wake);
    wake();
    return () => { document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("keydown", onKey); window.removeEventListener("mousemove", wake); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (album === null) return <div className="min-h-screen bg-black text-white flex items-center justify-center text-2xl">Album introuvable.</div>;
  const joinUrl = `${origin}/clic-clac/${code}`;
  const dur = `${cfg.speed}s`;

  return (
    <div className={`h-[100dvh] bg-[#0d0a09] text-white overflow-hidden relative select-none ${ui || panel ? "" : "cursor-none"}`}>
      {!current ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <img src="/icon-clicclac.svg" alt="" className="w-24 h-24 rounded-3xl" />
          <p className="text-4xl font-black">{album?.name}</p>
          <p className="text-2xl text-white/60">Les premières photos arrivent bientôt…</p>
        </div>
      ) : cfg.layout === "mosaic" ? (
        <Mosaic photos={history} current={current} captions={cfg.captions} qr={cfg.qr} />
      ) : cfg.layout === "wall" ? (
        <Wall photos={history} current={current} captions={cfg.captions} qr={cfg.qr} screen={screen} qrBox={qrBox} polaroid />
      ) : cfg.layout === "collage" ? (
        <Wall photos={history} current={current} captions={cfg.captions} qr={cfg.qr} screen={screen} qrBox={qrBox} polaroid={false} />
      ) : (
        // photo seule : la photo n'apparaît qu'une fois chargée (préchargée pendant la
        // précédente) et se pose PAR-DESSUS la précédente → jamais d'écran noir entre deux
        [under, shown].filter(Boolean).map((current) => {
          const top = current === shown;
          return (
            <div key={current.id} className="absolute inset-0 bg-[#0d0a09] overflow-hidden" style={top ? { animation: `${cfg.transition === "slide" ? "ccslide" : "ccfade"} .9s ease-out` } : undefined}>
              <img src={current.full} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110" />
              {(() => {
                const ratio = ratios[current.id] || 4 / 3;
                const r = photoRect(screen, photoBox(screen, cfg.qr ? qrBox : null, ratio, cfg.captions && (current.caption || current.name)), ratio);
                return (
                  <div className="absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
                    <img src={current.full} alt={current.caption || ""} className="w-full h-full object-contain"
                      style={cfg.transition === "kenburns" ? { animation: `cczoom ${dur} linear forwards` } : undefined} />
                  </div>
                );
              })()}
              {cfg.captions && (current.caption || current.name) && (
                <div className="absolute bottom-6 left-8 text-2xl drop-shadow-lg truncate" style={{ right: cfg.qr && qrBox.w ? qrBox.w + 56 : 32 }}>
                  {current.caption && <span className="font-bold">{current.caption}</span>}
                  {current.name && <span className="text-white/75">{current.caption ? " — " : ""}📸 {current.name}</span>}
                </div>
              )}
            </div>
          );
        })
      )}

      {banner && cfg.layout !== "wall" && cfg.layout !== "collage" && ( // en pêle-mêle, l'arrivée en grand suffit
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[250] bg-[#ff5a5f] text-white text-2xl font-black px-8 py-3 rounded-full shadow-2xl" style={{ animation: "ccdrop .5s ease-out" }}>
          📸 Nouvelle photo{banner.name ? ` de ${banner.name}` : ""} !
        </div>
      )}

      {cfg.qr && (
        (() => {
          // tailles proportionnelles à la hauteur de l'écran : lisible de loin sur une télé
          // et borné à ~30 % de la largeur. Zone de texte proportionnelle aux polices :
          // titre et consigne tiennent sur une ligne quel que soit l'écran (sauf écran très étroit)
          const scale = { s: 0.75, m: 1, l: 1.35 }[cfg.qrSize] || 1; // réglage « Taille du QR »
          const u = (screen.h / 100) * scale, px = (k, min) => Math.round(Math.max(min, k * u));
          const closed = album?.settings?.uploadsOpen === false;
          const pad = px(1.6, 12), qrSize = Math.round(Math.max(84, Math.min(px(14, 96), screen.w * 0.1)));
          const textW = Math.round(Math.max(150, Math.min(px(32, 240), screen.w * 0.3 - qrSize - 3 * pad)));
          return (
            <div ref={qrRef} className="absolute bottom-6 right-6 z-[250] bg-white text-gray-900 rounded-3xl flex items-center shadow-2xl"
              style={{ padding: pad, gap: pad }}>
              <div className="text-right" style={{ maxWidth: textW }}>
                {album?.name && <p className="font-bold text-[#ff5a5f] leading-tight truncate mb-1" style={{ fontSize: px(1.5, 13) }}>{album.name}</p>}
                <p className="font-black leading-tight" style={{ fontSize: px(2.3, 18) }}>{closed ? "🖼️ Revoyez l'album !" : "📸 Ajoutez vos photos !"}</p>
                <p className="text-gray-700 font-semibold leading-snug mt-1" style={{ fontSize: px(1.7, 14) }}>
                  {closed ? "Scannez pour voir et télécharger les photos" : "Scannez le QR code"}
                </p>
                <div className="text-gray-500 leading-snug" style={{ marginTop: px(1.1, 8), fontSize: px(1.25, 11) }}>
                  <p>Sans QR code : {origin.replace(/^https?:\/\//, "")}/clic-clac</p>
                  <p>code <b className="tracking-[0.2em] text-gray-900" style={{ fontSize: px(1.9, 15) }}>{code}</b></p>
                  {count > 0 && <p className="text-gray-400" style={{ fontSize: px(1.15, 10) }}>{count} photo{count > 1 ? "s" : ""} déjà partagée{count > 1 ? "s" : ""}</p>}
                </div>
              </div>
              {origin && <QRCodeSVG value={joinUrl} size={qrSize} />}
            </div>
          );
        })()
      )}

      {/* commandes (apparaissent au mouvement de la souris) */}
      <div className={`absolute top-4 right-4 z-[300] flex gap-2 transition-opacity ${ui || panel ? "opacity-100" : "opacity-0 pointer-events-none focus-within:opacity-100"}`}>
        {paused && <span className="bg-black/60 px-3 py-2 rounded-full text-sm">⏸ En pause</span>}
        {org && <button onClick={() => setPanel((v) => !v)} className="bg-black/60 hover:bg-black/80 px-4 py-2 rounded-full text-sm font-semibold">⚙️ Réglages</button>}
        {fromTv && <a href="/tv" className="bg-black/60 hover:bg-black/80 focus:bg-[#ff5a5f] focus:ring-4 focus:ring-white outline-none px-4 py-2 rounded-full text-sm font-semibold">📺 Changer d'affichage</a>}
        <button onClick={fullscreen} className="bg-black/60 hover:bg-black/80 px-4 py-2 rounded-full text-sm font-semibold">{isFull ? "Quitter le plein écran" : "⛶ Plein écran"}</button>
      </div>

      {panel && org && (
        <div className="absolute top-16 right-4 z-[300] w-80 max-h-[calc(100dvh-5rem)] overflow-y-auto bg-white text-gray-900 rounded-2xl shadow-2xl p-5 space-y-4 text-sm">
          <Field label="Affichage"><Seg options={LAYOUTS} value={cfg.layout} onChange={(v) => change({ layout: v })} /></Field>
          {cfg.layout === "single" && <Field label="Transition"><Seg options={TRANSITIONS} value={cfg.transition} onChange={(v) => change({ transition: v })} /></Field>}
          <Field label={`${liveSpeedLabel(cfg.layout)} : ${cfg.speed} s`}>
            <input type="range" min={0} max={SPEEDS.length - 1} step={1} value={Math.max(0, SPEEDS.indexOf(cfg.speed))}
              onChange={(e) => change({ speed: SPEEDS[+e.target.value] })} className="w-full accent-[#ff5a5f]" />
            <div className="flex justify-between text-xs text-gray-400"><span>rapide</span><span>lent</span></div>
          </Field>
          <Field label="Ordre"><Seg options={ORDERS} value={cfg.order} onChange={(v) => change({ order: v })} /></Field>
          {cfg.qr && <Field label="Taille du QR code"><Seg options={LIVE_QR_SIZES} value={cfg.qrSize} onChange={(v) => change({ qrSize: v })} /></Field>}
          <div className="space-y-1.5">
            {[["newFirst", "Nouvelles photos en priorité (avec bandeau)"], ["captions", "Afficher prénom et légende"], ["qr", "Afficher le QR code"]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cfg[k]} onChange={(e) => change({ [k]: e.target.checked })} className="w-4 h-4 accent-[#ff5a5f]" />{l}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">Espace : pause · ← → : photo précédente / suivante · F : plein écran. Réglages partagés avec la télécommande.</p>
          <button onClick={() => setPanel(false)} className="w-full bg-gray-900 text-white font-bold py-2 rounded-full">Fermer</button>
        </div>
      )}

      <style>{`
        @keyframes ccfade{from{opacity:0}to{opacity:1}}
        @keyframes ccslide{from{opacity:0;transform:translateX(6%)}to{opacity:1;transform:none}}
        @keyframes cczoom{from{transform:scale(1)}to{transform:scale(1.04)}}
        @keyframes ccdrop{from{opacity:0;transform:translate(-50%,-30px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes ccpop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
        @keyframes ccfall{from{opacity:0;transform:var(--r) translateY(-60px) scale(1.15)}to{opacity:1;transform:var(--r)}}
      `}</style>
    </div>
  );
}

/* Zone d'affichage de la photo seule : on essaie (a) une bande libre en bas pour
 * la pastille QR, (b) une colonne libre à droite, et on garde celle qui affiche
 * la photo (proportions ratio) le plus grand. */
function photoBox(screen, qr, ratio, caption) {
  const m = 24, gap = 16, capH = caption ? 56 : 0;
  const fit = (w, h) => Math.min(w, h * ratio) * Math.min(h, w / ratio);
  if (!qr || !qr.w) {
    return { x: m, y: m, w: screen.w - 2 * m, h: screen.h - 2 * m - capH };
  }
  const a = { x: m, y: m, w: screen.w - 2 * m, h: screen.h - m - (qr.h + m + gap) }; // bande en bas
  const b = { x: m, y: m, w: screen.w - m - (qr.w + m + gap), h: screen.h - 2 * m - capH }; // colonne à droite
  return fit(a.w, a.h) >= fit(b.w, b.h) ? a : b;
}

/* Taille maximale de la photo dans la zone libre, puis position CENTRÉE sur
 * l'écran — décalée seulement si nécessaire pour rester dans la zone libre. */
function photoRect(screen, box, ratio) {
  const w = Math.min(box.w, box.h * ratio), h = w / ratio;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    w, h,
    x: clamp((screen.w - w) / 2, box.x, box.x + box.w - w),
    y: clamp((screen.h - h) / 2, box.y, box.y + box.h - h),
  };
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><p className="font-semibold text-gray-600">{label}</p>{children}</div>;
}
function Seg({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`px-3 py-1.5 rounded-full font-semibold ${value === v ? "bg-[#ff5a5f] text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
      ))}
    </div>
  );
}

/* Mosaïque : grille des dernières photos montrées ; la plus récente en grand. */
function Mosaic({ photos, current, captions, qr }) {
  // la grande occupe 4 cases ; avec le QR, la dernière case (en bas à droite) reste libre pour la pastille
  const rest = photos.filter((p) => p.id !== current.id).slice(0, MOSAIC - 4 - (qr ? 1 : 0));
  return (
    <div className="absolute inset-0 p-4 pb-4 grid grid-cols-4 grid-rows-3 gap-3">
      <div key={current.id} className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden bg-black" style={{ animation: "ccpop .7s ease-out" }}>
        <img src={current.thumb} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-110" />
        <img src={current.full} alt="" className="relative w-full h-full object-contain" />
        {captions && current.name && <span className="absolute bottom-3 left-4 text-xl font-bold drop-shadow-lg">📸 {current.name}</span>}
      </div>
      {rest.map((p) => (
        <div key={p.id} className="relative rounded-xl overflow-hidden bg-black" style={{ animation: "ccfade .6s ease-out" }}>
          <img src={p.thumb} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-110" />
          <img src={p.thumb} alt="" className="relative w-full h-full object-contain" />
        </div>
      ))}
    </div>
  );
}

/* Pêle-mêle (polaroïds ou photos seules).
 * Placement « au moins couvert » : l'écran est suivi par une carte de couverture
 * (combien de photos recouvrent chaque zone). Chaque nouvelle photo, à sa taille
 * RÉELLE (portrait / paysage / carré), est posée à l'endroit qui recouvre le moins
 * les autres → les trous se comblent en premier, sans effet de colonnes. Une fois
 * posée, elle ne bouge plus. La photo du moment s'affiche en grand au centre puis
 * rejoint sa place. Débord léger aux bords ; zone du QR évitée (le QR reste au-dessus). */
const GW = 40, GH = 24; // résolution de la carte de couverture
function Wall({ photos, current, captions, qr, screen, qrBox, polaroid = true }) {
  const W = screen.w, H = screen.h, m = 20;
  const store = useRef({ map: new Map(), ratio: new Map(), cover: new Float32Array(GW * GH), z: 0, hero: null, seed: 1 });
  const st = store.current;
  const [, setTick] = useState(0);

  // proportions des photos (nécessaires pour les poser à leur vraie taille)
  useEffect(() => {
    let alive = true;
    for (const p of photos) {
      if (st.ratio.has(p.id) || !p.thumb) continue;
      st.ratio.set(p.id, null);
      const img = new Image();
      img.onload = () => { if (!alive) return; st.ratio.set(p.id, img.naturalWidth / img.naturalHeight); setTick((t) => t + 1); };
      img.onerror = () => st.ratio.set(p.id, 4 / 3);
      img.src = p.thumb;
    }
    return () => { alive = false; };
  }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps

  // taille d'une carte (fraction de l'écran) selon les proportions de la photo
  const pad = polaroid ? { side: 24, extra: 64 } : { side: 0, extra: 0 };
  const boxW = 0.25 * W, boxH = 0.37 * H; // taille maximale d'une carte au repos
  const cardSize = (ratio) => {
    const iw = Math.min(boxW - pad.side, (boxH - pad.extra) * ratio), ih = iw / ratio;
    return { w: iw + pad.side, h: ih + pad.extra };
  };

  // carte de couverture : ajoute (+1) ou retire (-1) un rectangle (en fractions)
  const cells = (fx, fy, fw, fh) => {
    const x0 = Math.max(0, Math.floor((fx - fw / 2) * GW)), x1 = Math.min(GW - 1, Math.floor((fx + fw / 2) * GW));
    const y0 = Math.max(0, Math.floor((fy - fh / 2) * GH)), y1 = Math.min(GH - 1, Math.floor((fy + fh / 2) * GH));
    return [x0, x1, y0, y1];
  };
  const paint = (v, sign) => {
    const [x0, x1, y0, y1] = cells(v.fx, v.fy, v.fw, v.fh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) st.cover[y * GW + x] += sign;
  };
  const rnd = () => ((st.seed = (st.seed * 16807) % 2147483647) / 2147483647);
  // zone du QR : un peu « déjà couverte » pour l'éviter sans l'interdire
  const qrPenalty = (x, y) => (qr && qrBox.w && x >= (W - 24 - qrBox.w) / W && y >= (H - 24 - qrBox.h) / H ? 1.5 : 0);

  const place = (id) => {
    const { w, h } = cardSize(st.ratio.get(id) || 4 / 3);
    const fw = w / W, fh = h / H;
    const over = 0.025; // débord autorisé aux bords (fraction de l'écran)
    let best = null;
    for (let k = 0; k < 90; k++) {
      const fx = fw / 2 - over + rnd() * (1 - fw + 2 * over);
      const fy = fh / 2 - over + rnd() * (1 - fh + 2 * over);
      const [x0, x1, y0, y1] = cells(fx, fy, fw, fh);
      let sum = 0, n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { sum += st.cover[y * GW + x] + qrPenalty((x + 0.5) / GW, (y + 0.5) / GH); n++; }
      const score = sum / Math.max(1, n);
      if (!best || score < best.score) best = { fx, fy, score };
    }
    const v = { fx: best.fx, fy: best.fy, fw, fh, r: rnd() * 32 - 16, z: ++st.z };
    paint(v, 1);
    st.map.set(id, v);
  };

  // retire les photos sorties de l'historique, pose les nouvelles (dont les proportions sont connues)
  // seulement les MAX plus récentes : sinon, au-delà, chaque rafraîchissement
  // reposait des photos retirées et en retirait d'autres (le mur bougeait en pause)
  const MAX = 45;
  const onWall = photos.slice(0, MAX);
  const inHistory = new Set(onWall.map((p) => p.id));
  for (const [id, v] of [...st.map]) if (!inHistory.has(id)) { paint(v, -1); st.map.delete(id); }
  for (const p of [...onWall].reverse()) if (!st.map.has(p.id) && st.ratio.get(p.id)) place(p.id);
  if (current && current.id !== st.hero && st.map.has(current.id)) { st.hero = current.id; st.map.get(current.id).z = ++st.z; }
  while (st.map.size > MAX) {
    let oldest = null;
    for (const [id, v] of st.map) if (id !== current?.id && (!oldest || v.z < st.map.get(oldest).z)) oldest = id;
    paint(st.map.get(oldest), -1);
    st.map.delete(oldest);
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  const placed = [...st.map.entries()].filter(([id]) => byId.has(id)).sort((a, b) => a[1].z - b[1].z);
  const qrRect = qr && qrBox.w ? { x: W - 24 - qrBox.w, y: H - 24 - qrBox.h } : null;

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#3a2a22,#120d0b)]">
      {placed.map(([id, v], i) => {
        const p = byId.get(id);
        const hero = current && id === current.id;
        const cardW = v.fw * W, cardH = v.fh * H, cx = v.fx * W, cy = v.fy * H;
        let t = `rotate(${v.r}deg)`;
        if (hero) {
          // en vedette : agrandie au centre, entière et hors du QR
          const sc = Math.min((W * 0.66) / cardW, (H * 0.8) / cardH);
          let hx = W / 2, hy = H / 2;
          hx = Math.max(m + (cardW * sc) / 2, Math.min(W - m - (cardW * sc) / 2, hx));
          hy = Math.max(m + (cardH * sc) / 2, Math.min(H - m - (cardH * sc) / 2, hy));
          if (qrRect && hx + (cardW * sc) / 2 > qrRect.x - 12 && hy + (cardH * sc) / 2 > qrRect.y - 12) {
            const up = hy + (cardH * sc) / 2 - (qrRect.y - 12), left = hx + (cardW * sc) / 2 - (qrRect.x - 12);
            if (up <= left) hy -= up; else hx -= left;
          }
          t = `translate(${hx - cx}px, ${hy - cy}px) rotate(${v.r / 4}deg) scale(${sc})`;
        }
        return (
          <div key={id} className="absolute flex items-center justify-center"
            style={{ left: cx - cardW / 2, top: cy - cardH / 2, width: cardW, height: cardH, zIndex: hero ? 100 : i, transform: t,
              transition: "transform 1.1s cubic-bezier(.22,.8,.25,1)" }}>
            {/* l'apparition (pop) est sur l'élément intérieur : elle ne gêne pas le déplacement */}
            <div className={`relative ${polaroid ? "bg-[#fbfaf5] p-3 pb-12" : ""} shadow-[0_18px_40px_rgba(0,0,0,.55)]`}
              style={{ animation: hero ? "ccpop .7s ease-out" : undefined }}>
              <img src={p.full} alt="" className="block" style={{ width: cardW - pad.side, height: cardH - pad.extra }} />
              {captions && polaroid && (p.name || p.caption) && (
                <p className="absolute bottom-2 left-0 right-0 text-center text-gray-800 truncate px-3"
                  style={{ fontFamily: '"Segoe Print","Bradley Hand","Comic Sans MS",cursive', fontSize: Math.max(13, H * 0.022) }}>
                  {p.caption || p.name}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
