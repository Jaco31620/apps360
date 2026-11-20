"use client";
/*
 * Clic-Clac — studio de prise de vue (invités et borne) :
 * caméra (avant/arrière) → compte à rebours → photo seule ou bande de 4 →
 * choix filtre / cadre / légende (selon les réglages de l'album) → envoi.
 * Repli si la caméra est indisponible : appareil photo du téléphone (input file).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAMES, FILTERS, CROPS, MAX_CAPTION } from "@/lib/clicclac/settings";
import { applyFilter, applyFrame, composeStrip, exportForUpload, imageToCanvas, loadImage, scaled, makeCanvas, cropCanvas, cropRect, frameInfo, HD_SIDE, WORK_SIDE } from "./imaging";
import { frameFontsReady } from "./frameFonts";
import { sendWithRetry, enqueue, newUploadId } from "./uploadQueue";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Options proposées selon le mode de l'album. */
function options(mode, enabled, imposed, all) {
  if (mode === "off") return { list: [], value: "none" };
  if (mode === "imposed") return { list: [], value: imposed };
  return { list: all.filter((x) => enabled.includes(x.id)), value: enabled[0] || "none" };
}

export default function Studio({ album, code, booth = false, token, guest, onDone, onClose, initialFile = null, defaultMode = "photo", onRetake, retakeLabel = "↺ Recommencer" }) {
  const s = album.settings;
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const [facing, setFacing] = useState(booth ? "user" : "environment");
  const [camError, setCamError] = useState("");
  const [mode, setMode] = useState(defaultMode === "strip" && album.settings.stripEnabled ? "strip" : "photo"); // photo | strip
  const [count, setCount] = useState(0); // compte à rebours affiché
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState(null); // canvases capturés
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const frameOpt = options(s.framesMode, s.frames.filter((f) => f !== "custom" || s.hasCustomFrame), s.imposedFrame, FRAMES);
  const filterOpt = options(s.filtersMode, s.filters, s.imposedFilter, FILTERS);
  const [frame, setFrame] = useState(frameOpt.value);
  const [filter, setFilter] = useState(filterOpt.value);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState(null);
  const [customImg, setCustomImg] = useState(null);
  // recadrage : format imposé par l'album, ou libre (choix de l'invité), ou désactivé
  const imposedRatio = s.crop && s.crop !== "free" && s.crop !== "off" ? CROPS.find((c) => c.id === s.crop)?.ratio || null : null;
  const cropAllowed = s.crop !== "off";
  const [crop, setCrop] = useState({ ratio: imposedRatio, zoom: 1, cx: 0.5, cy: 0.5 });
  const [tab, setTab] = useState(null); // onglet de personnalisation : frame | filter | crop
  const [thumbs, setThumbs] = useState({}); // miniatures de la photo pour chaque cadre / filtre

  useEffect(() => {
    if (album.customFrameUrl) loadImage(album.customFrameUrl).then(setCustomImg).catch(() => {});
  }, [album.customFrameUrl]);

  /* ── caméra ── */
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => {
    if (shots || initialFile) return undefined; // photo importée : pas de caméra
    let cancelled = false;
    (async () => {
      setCamError("");
      try {
        stop();
        const big = s.keepHd ? { width: { ideal: 3840 }, height: { ideal: 2160 } } : { width: { ideal: 1920 }, height: { ideal: 1440 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, ...big }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch (e) {
        setCamError("Caméra indisponible ici : utilisez l'appareil photo du téléphone.");
      }
    })();
    return () => { cancelled = true; };
  }, [facing, shots, s.keepHd]);
  useEffect(() => () => stop(), []);

  const grab = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = makeCanvas(v.videoWidth, v.videoHeight);
    const ctx = c.getContext("2d");
    // pas d'effet miroir sur la photo (seulement sur l'aperçu) : les textes
    // (t-shirt, panneau…) restent lisibles, comme avec l'appareil photo du téléphone
    ctx.drawImage(v, 0, 0);
    return c;
  };

  const countdown = async (n) => {
    for (let i = n; i > 0; i--) { setCount(i); await sleep(900); }
    setCount(0);
    setFlash(true); setTimeout(() => setFlash(false), 220);
  };

  const shoot = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const taken = [];
      const n = mode === "strip" ? 4 : 1;
      for (let i = 0; i < n; i++) {
        await countdown(3); // caméra dans la page = mode cabine : compte à rebours avant chaque pose
        const c = grab();
        if (!c) throw new Error("Caméra pas encore prête.");
        taken.push(c);
        if (i < n - 1) await sleep(500);
      }
      stop();
      setShots(taken);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fromFile = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      stop();
      setMode("photo");
      setShots([imageToCanvas(img, s.keepHd ? HD_SIDE : WORK_SIDE)]);
    } catch (e) {
      setError("Image illisible.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // photo choisie dans la galerie : on passe directement aux retouches
  useEffect(() => { if (initialFile) fromFile(initialFile); }, [initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // polices des cadres : on redessine dès qu'elles sont chargées
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => { frameFontsReady().then(() => setFontsTick((t) => t + 1)); }, []);

  /* ── rendu final (filtre + cadre / bande) ── */
  const render = useCallback((maxSide) => {
    if (!shots) return null;
    const info = frameInfo(album, customImg);
    const src = shots.length > 1 ? shots : [cropCanvas(shots[0], cropAllowed ? crop : null)];
    const filtered = src.map((c) => applyFilter(scaled(c, maxSide), filter));
    return shots.length > 1 ? composeStrip(filtered, info) : applyFrame(filtered[0], frame, info);
  }, [shots, filter, frame, customImg, album, crop, cropAllowed, fontsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // nouvelle prise : recadrage remis à zéro (format imposé conservé)
  useEffect(() => { setCrop({ ratio: imposedRatio, zoom: 1, cx: 0.5, cy: 0.5 }); setTab(null); }, [shots]); // eslint-disable-line react-hooks/exhaustive-deps

  // onglets proposés : seulement ce que l'organisateur laisse choisir
  const tabs = !shots ? [] : [
    shots.length === 1 && frameOpt.list.length > 1 && ["frame", "🖼️ Cadre"],
    filterOpt.list.length > 1 && ["filter", "🎨 Filtre"],
    cropAllowed && shots.length === 1 && ["crop", "✂️ Recadrer"],
  ].filter(Boolean);
  const activeTab = tabs.some(([k]) => k === tab) ? tab : tabs[0]?.[0] || null;

  // miniatures de SA photo avec chaque cadre (filtre choisi appliqué) ou chaque filtre
  useEffect(() => {
    if (!shots || (activeTab !== "frame" && activeTab !== "filter")) return undefined;
    const t = setTimeout(() => {
      const base = shots.length > 1 ? shots[0] : cropCanvas(shots[0], cropAllowed ? crop : null);
      const info = frameInfo(album, customImg);
      const out = {};
      if (activeTab === "filter") {
        for (const f of filterOpt.list) out[f.id] = applyFilter(scaled(base, 200), f.id).toDataURL("image/jpeg", 0.7);
      } else {
        const filtered = applyFilter(scaled(base, 200), filter);
        for (const f of frameOpt.list) out[f.id] = applyFrame(filtered, f.id, info).toDataURL("image/jpeg", 0.7);
      }
      setThumbs(out);
    }, 30);
    return () => clearTimeout(t);
  }, [shots, activeTab, crop, filter, customImg, fontsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shots) { setPreview(null); return; }
    const c = render(900);
    setPreview(c.toDataURL("image/jpeg", 0.8));
  }, [shots, render]);

  const retake = () => { setShots(null); setCaption(""); setError(""); };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await frameFontsReady();
      const final = render(s.keepHd ? HD_SIDE : WORK_SIDE);
      const { full, thumb, hd } = await exportForUpload(final, { keepHd: s.keepHd });
      const item = {
        id: newUploadId(), code, token: token || null, at: Date.now(), full, thumb, hd: hd || null,
        fields: { guestId: guest?.id || "", guestName: guest?.name || "", caption: caption.trim(), kind: shots.length > 1 ? "strip" : "photo" },
      };
      try {
        const res = await sendWithRetry(item);
        onDone?.({ ...res, preview });
        retake();
      } catch (e) {
        if (!e.retryable) throw e;
        // réseau absent ou saturé : la photo est gardée sur l'appareil et partira toute seule
        await enqueue(item);
        onDone?.({ queued: true, preview });
        retake();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const chip = (active) => `shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active ? "bg-white text-gray-900 border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`;

  return (
    <div className="fixed inset-0 z-40 bg-black text-white flex flex-col">
      {/* barre du haut */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        {onClose ? <button onClick={() => { stop(); onClose(); }} className="text-white/80 hover:text-white text-lg">{shots ? "✕ Annuler" : "✕ Fermer"}</button> : <span />}
        <span className="font-bold truncate px-3">{album.name}</span>
        {!shots && !camError
          ? <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="text-white/80 hover:text-white text-sm">🔄 Caméra</button>
          : <span />}
      </div>

      {!shots && initialFile ? (
        <div className="flex-1 flex items-center justify-center text-white/70 px-6 text-center">{error || "Préparation de la photo…"}</div>
      ) : !shots ? (
        <>
          <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black">
            {camError ? (
              <div className="text-center px-6 space-y-4">
                <p className="text-white/80">{camError}</p>
                <button onClick={() => fileRef.current?.click()} className="bg-white text-gray-900 font-bold px-6 py-3 rounded-full">📷 Prendre une photo</button>
                {!booth && s.allowImport !== false && (
                  <button onClick={() => galleryRef.current?.click()} className="block mx-auto text-white/80 underline">🖼️ ou choisir dans la galerie</button>
                )}
              </div>
            ) : (
              <video ref={videoRef} playsInline muted autoPlay
                className="max-w-full max-h-full object-contain" style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }} />
            )}
            {count > 0 && <div className="absolute inset-0 flex items-center justify-center text-[30vmin] font-black drop-shadow-2xl">{count}</div>}
            {flash && <div className="absolute inset-0 bg-white" />}
          </div>
          <div className="shrink-0 px-4 py-5 flex flex-col items-center gap-4">
            {s.stripEnabled && !camError && (
              <div className="flex gap-2">
                <button onClick={() => setMode("photo")} className={chip(mode === "photo")}>📷 Photo seule</button>
                <button onClick={() => setMode("strip")} className={chip(mode === "strip")}>🎞️ Cabine : 4 poses à la suite</button>
              </div>
            )}
            {!camError && (
              <button onClick={shoot} disabled={busy} aria-label="Prendre la photo"
                className={`rounded-full bg-white border-[6px] border-white/40 disabled:opacity-50 active:scale-95 transition-transform ${booth ? "w-28 h-28" : "w-20 h-20"}`} />
            )}
            {!camError && <p className="text-xs text-white/50">{mode === "strip" ? "Compte à rebours avant chacune des 4 poses" : "Compte à rebours de 3 secondes"}</p>}
            {error && <p className="text-red-300 text-sm">{error}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture={facing === "user" ? "user" : "environment"} className="hidden"
            onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} />
        </>
      ) : (
        <>
          {/* titre de l'étape */}
          <div className="shrink-0 text-center px-4 pb-2">
            <p className="text-xl font-black">✨ {shots.length > 1 ? "Votre bande est prête !" : "Votre photo est prête !"}</p>
            <p className="text-sm text-white/60">{tabs.length ? "Ajoutez une touche si vous voulez, puis envoyez-la." : "Ajoutez un petit mot si vous voulez, puis envoyez-la."}</p>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-3 pb-2">
            {activeTab === "crop"
              ? <CropEditor shot={shots[0]} crop={crop} setCrop={setCrop} />
              : preview && <img src={preview} alt="Aperçu" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />}
          </div>

          <div className="shrink-0 px-4 pb-5 space-y-3">
            {tabs.length > 1 && (
              <div className="flex justify-center gap-1 bg-white/10 rounded-full p-1">
                {tabs.map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`flex-1 rounded-full py-2 text-sm font-bold ${activeTab === k ? "bg-white text-gray-900" : "text-white/80"}`}>{l}</button>
                ))}
              </div>
            )}
            {tabs.length === 1 && <p className="text-sm font-bold text-white/80">{tabs[0][1]}</p>}

            {(activeTab === "frame" || activeTab === "filter") && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                {(activeTab === "frame" ? frameOpt.list : filterOpt.list).map((o) => {
                  const on = activeTab === "frame" ? frame === o.id : filter === o.id;
                  return (
                    <button key={o.id} onClick={() => (activeTab === "frame" ? setFrame(o.id) : setFilter(o.id))} className="shrink-0 w-[76px] flex flex-col items-center gap-1">
                      <span className={`w-[76px] h-[76px] rounded-xl bg-white/10 flex items-center justify-center overflow-hidden ring-2 ${on ? "ring-[#ff5a5f]" : "ring-transparent"}`}>
                        {thumbs[o.id] ? <img src={thumbs[o.id]} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-white/30 text-xs">…</span>}
                      </span>
                      <span className={`text-xs leading-tight text-center ${on ? "text-white font-bold" : "text-white/60"}`}>{o.id === "none" && activeTab === "frame" ? "Aucun" : o.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "crop" && (
              <div className="space-y-2">
                {!imposedRatio ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CROPS.map((c) => (
                      <button key={c.id} onClick={() => setCrop((x) => ({ ...x, ratio: c.ratio }))} className={chip(crop.ratio === c.ratio)}>{c.label}</button>
                    ))}
                  </div>
                ) : <p className="text-xs text-white/50">Format {CROPS.find((c) => c.ratio === imposedRatio)?.label} choisi par l'organisateur.</p>}
                <label className="flex items-center gap-3 text-sm text-white/80">
                  Zoom
                  <input type="range" min={1} max={3} step={0.05} value={crop.zoom} onChange={(e) => setCrop((x) => ({ ...x, zoom: +e.target.value }))} className="flex-1 accent-[#ff5a5f]" />
                </label>
                <p className="text-xs text-white/50 text-center">
                  Faites glisser la zone claire pour choisir le cadrage ·{" "}
                  <button onClick={() => setCrop({ ratio: imposedRatio, zoom: 1, cx: 0.5, cy: 0.5 })} className="underline">réinitialiser</button>
                </p>
              </div>
            )}

            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={MAX_CAPTION} placeholder="💬 Un petit mot ? (facultatif)"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/60" />
            {error && <p className="text-red-300 text-sm text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={initialFile ? (onRetake || onClose) : retake} disabled={busy}
                className="flex-1 bg-white/10 border border-white/20 font-bold py-3.5 rounded-full disabled:opacity-40">{initialFile && !onRetake ? "✕ Annuler" : retakeLabel}</button>
              <button onClick={save} disabled={busy} className="flex-[2] bg-[#ff5a5f] font-black py-3.5 rounded-full disabled:opacity-60">
                {busy ? "Envoi…" : "📤 Envoyer à l'album"}
              </button>
            </div>
            <p className="text-xs text-white/50 text-center -mt-1">
              {s.moderation && !token ? "Elle sera publiée après validation par l'organisateur." : "Elle sera visible par tous les invités."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* Éditeur de recadrage : photo entière, zone claire déplaçable (doigt / souris),
 * le reste assombri. Le format et le zoom se règlent sous l'image. */
function CropEditor({ shot, crop, setCrop }) {
  const [src, setSrc] = useState(null);
  const [size, setSize] = useState(null); // taille d'affichage exacte de la photo
  const outerRef = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);
  useEffect(() => { setSrc(scaled(shot, 1000).toDataURL("image/jpeg", 0.85)); }, [shot]);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const fit = () => {
      const k = Math.min(el.clientWidth / shot.width, el.clientHeight / shot.height);
      setSize({ w: shot.width * k, h: shot.height * k });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shot]);
  const W = shot.width, H = shot.height;
  const r = cropRect(W, H, crop.ratio, crop.zoom, crop.cx, crop.cy);
  const pct = { left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%` };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: (r.x + r.w / 2) / W, cy: (r.y + r.h / 2) / H };
  };
  const onMove = (e) => {
    if (!drag.current || !imgRef.current) return;
    const box = imgRef.current.getBoundingClientRect();
    const cx = drag.current.cx + (e.clientX - drag.current.x) / box.width;
    const cy = drag.current.cy + (e.clientY - drag.current.y) / box.height;
    // centre borné pour que la zone reste dans la photo
    const n = cropRect(W, H, crop.ratio, crop.zoom, cx, cy);
    setCrop((x) => ({ ...x, cx: (n.x + n.w / 2) / W, cy: (n.y + n.h / 2) / H }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <div ref={outerRef} className="w-full h-full flex items-center justify-center">
    {src && size && (
    <div className="relative select-none touch-none overflow-hidden rounded-lg" style={{ width: size.w, height: size.h }}>
      <img ref={imgRef} src={src} alt="" className="w-full h-full rounded-lg" draggable={false} />
      <div className="absolute border-2 border-white cursor-move rounded-sm" style={{ ...pct, boxShadow: "0 0 0 9999px rgba(0,0,0,.6)" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/25" />)}
        </div>
      </div>
    </div>
    )}
    </div>
  );
}
