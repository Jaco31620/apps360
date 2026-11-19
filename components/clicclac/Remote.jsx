"use client";
/*
 * Clic-Clac — télécommande de l'écran live (/clic-clac/<code>/telecommande),
 * sur le téléphone de l'organisateur : connecter une télé (apps360.fr/tv),
 * pause / photo précédente / suivante, affichage (mise en page, vitesse,
 * ordre…), « afficher cette photo sur l'écran », validation des photos en
 * attente, ouverture / fermeture des envois.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TvLink from "@/components/jukebox/TvLink";
import { UploadsToggle } from "./AdminApp";
import RoleNav from "./RoleNav";
import { api, adminToken, superToken, storage, joinFromHash, syncPhotos, useWakeLock } from "./client";
import { LIVE_DEFAULTS, LIVE_SPEEDS, LIVE_ORDERS, LIVE_LAYOUTS, LIVE_TRANSITIONS } from "@/lib/clicclac/settings";

export default function Remote({ code }) {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null);
  const [live, setLive] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [tv, setTv] = useState(false);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(Date.now());
  const photosRef = useRef([]);
  useWakeLock();

  useEffect(() => {
    joinFromHash(code)
      .then((t) => setToken(t || adminToken(code) || superToken()))
      .catch((e) => { setErr(e.message); setToken(adminToken(code) || superToken()); })
      .finally(() => setReady(true));
  }, [code]);

  const loadInfo = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api(`/${code}`, { token });
      if (!d.admin) { storage.set(`cc_admin_${code}`, null); setToken(null); return; }
      setInfo(d);
      photosRef.current = await syncPhotos(code, photosRef.current, { token });
      setPhotos(photosRef.current);
    } catch (e) { if (e.status === 404) setInfo(null); }
  }, [code, token]);
  const loadLive = useCallback(async () => {
    try { setLive(await api(`/${code}/live`)); setNow(Date.now()); } catch (e) { /* réseau */ }
  }, [code]);

  useEffect(() => {
    if (!token) return undefined;
    loadInfo(); loadLive();
    const a = setInterval(() => { if (!document.hidden) loadInfo(); }, 10000);
    const b = setInterval(() => { if (!document.hidden) loadLive(); }, 3000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [token, loadInfo, loadLive]);

  const flash = (t) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? "" : x)), 2500); };
  const send = async (body, msg) => {
    try {
      const st = await api(`/${code}/live`, { method: "POST", token, body });
      setLive(st);
      if (msg) flash(msg);
    } catch (e) { flash(`⚠ ${e.message}`); }
  };

  const login = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const { token: t } = await api(`/${code}/auth`, { method: "POST", body: { pin } });
      storage.set(`cc_admin_${code}`, t);
      setToken(t);
    } catch (e2) { setErr(e2.message); }
  };

  if (!ready) return null;
  if (!token) {
    return (
      <Shell>
        <form onSubmit={login} className="bg-white text-gray-900 rounded-3xl p-6 space-y-4 mt-6">
          <h1 className="text-xl font-black">📱 Télécommande de l'écran</h1>
          <p className="text-gray-500 text-sm">Album <b>{code}</b> — saisissez votre code organisateur.</p>
          <input autoFocus value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} placeholder="Code organisateur"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg tracking-widest focus:border-[#ff5a5f] outline-none" />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button className="w-full bg-[#ff5a5f] text-white font-bold py-3 rounded-full">Se connecter</button>
        </form>
      </Shell>
    );
  }
  if (!info || !live) return <Shell><p className="text-center text-white/60 pt-20">Chargement…</p></Shell>;

  const cfg = { ...LIVE_DEFAULTS, ...(live.cfg || {}) };
  const setCfg = (patch) => { setLive((l) => ({ ...l, cfg: { ...cfg, ...patch } })); send({ cfg: patch }); };
  const published = photos.filter((p) => p.status === "published");
  const pending = photos.filter((p) => p.status === "pending");
  const ago = live.seen ? Math.round((now - live.seen) / 1000) : null;
  const tvOn = ago !== null && ago < 40;

  const approve = async (p, ok) => {
    try {
      if (ok) await api(`/${code}/photos/${p.id}`, { method: "PATCH", token, body: { status: "published" } });
      else if (confirm("Supprimer définitivement cette photo ?")) await api(`/${code}/photos/${p.id}`, { method: "DELETE", token });
      else return;
      photosRef.current = photosRef.current.map((x) => (x.id === p.id ? { ...x, status: ok ? "published" : "deleted" } : x)).filter((x) => x.status !== "deleted");
      setPhotos(photosRef.current);
      flash(ok ? "✓ Photo publiée" : "Photo supprimée");
    } catch (e) { flash(`⚠ ${e.message}`); }
  };

  const chip = (on) => `px-3 py-1.5 rounded-full text-sm font-semibold ${on ? "bg-[#ff5a5f] text-white" : "bg-white/10 text-white/80"}`;
  return (
    <Shell>
      <RoleNav code={code} current="remote" dark />
      <header className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#ff8a8d]">Télécommande</p>
          <h1 className="text-2xl font-black truncate">{info.album.name}</h1>
          <p className={`text-sm ${tvOn ? "text-green-300" : "text-white/50"}`}>
            {tvOn ? "● Télé connectée" : live.seen ? `○ Télé vue il y a ${ago > 120 ? `${Math.round(ago / 60)} min` : `${ago} s`}` : "○ Aucune télé connectée"}
          </p>
        </div>
        <button onClick={() => setTv(true)} className="shrink-0 bg-white text-gray-900 font-bold px-4 py-2 rounded-full text-sm">📺 Connecter une télé</button>
      </header>

      {/* lecture */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <button onClick={() => send({ cmd: { type: "prev" } })} className="bg-white/10 active:bg-white/20 rounded-2xl py-5 text-3xl" aria-label="Photo précédente">⏮</button>
        <button onClick={() => send({ paused: !live.paused }, live.paused ? "▶ Lecture" : "⏸ En pause")}
          className={`rounded-2xl py-5 text-3xl ${live.paused ? "bg-[#ff5a5f]" : "bg-white/10 active:bg-white/20"}`} aria-label="Pause / lecture">{live.paused ? "▶" : "⏸"}</button>
        <button onClick={() => send({ cmd: { type: "next" } })} className="bg-white/10 active:bg-white/20 rounded-2xl py-5 text-3xl" aria-label="Photo suivante">⏭</button>
      </div>

      {/* photos à valider */}
      {pending.length > 0 && (
        <section className="bg-amber-400/10 border border-amber-400/30 rounded-3xl p-4 mb-5">
          <h2 className="font-bold mb-3">⏳ À valider ({pending.length})</h2>
          <div className="grid grid-cols-2 gap-3">
            {pending.slice(0, 20).map((p) => (
              <div key={p.id} className="bg-black/30 rounded-2xl overflow-hidden">
                <img src={p.full} alt="" className="w-full aspect-square object-cover" />
                {p.name && <p className="text-xs text-white/60 px-2 pt-1 truncate">📸 {p.name}</p>}
                <div className="flex">
                  <button onClick={() => approve(p, true)} className="flex-1 py-2.5 font-bold text-green-300">✓ Publier</button>
                  <button onClick={() => approve(p, false)} className="flex-1 py-2.5 font-bold text-red-300">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* affichage */}
      <section className="bg-white/5 rounded-3xl p-4 space-y-4 mb-5">
        <Row label="Affichage">{LIVE_LAYOUTS.map(([v, l]) => <button key={v} onClick={() => setCfg({ layout: v })} className={chip(cfg.layout === v)}>{l}</button>)}</Row>
        {cfg.layout === "single" && <Row label="Transition">{LIVE_TRANSITIONS.map(([v, l]) => <button key={v} onClick={() => setCfg({ transition: v })} className={chip(cfg.transition === v)}>{l}</button>)}</Row>}
        <Row label="Durée par photo">{LIVE_SPEEDS.map((v) => <button key={v} onClick={() => setCfg({ speed: v })} className={chip(cfg.speed === v)}>{v} s</button>)}</Row>
        <Row label="Ordre">{LIVE_ORDERS.map(([v, l]) => <button key={v} onClick={() => setCfg({ order: v })} className={chip(cfg.order === v)}>{l}</button>)}</Row>
        <div className="space-y-2 pt-1">
          {[["newFirst", "Nouvelles photos en priorité (avec bandeau)"], ["captions", "Prénom et légende"], ["qr", "QR code pour participer"]].map(([k, l]) => (
            <label key={k} className="flex items-center gap-3">
              <input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ [k]: e.target.checked })} className="w-5 h-5 accent-[#ff5a5f]" />{l}
            </label>
          ))}
        </div>
      </section>

      {/* afficher une photo précise */}
      <section className="bg-white/5 rounded-3xl p-4 mb-5">
        <h2 className="font-bold mb-1">🖼️ Afficher une photo sur l'écran</h2>
        <p className="text-xs text-white/50 mb-3">Touchez une photo : elle passe tout de suite à l'écran.</p>
        {published.length ? (
          <div className="grid grid-cols-4 gap-1.5">
            {published.slice(0, 120).map((p) => (
              <button key={p.id} onClick={() => send({ cmd: { type: "show", photoId: p.id } }, "📺 Envoyée à l'écran")}
                className="aspect-square rounded-lg overflow-hidden bg-white/10 active:opacity-60">
                <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : <p className="text-white/40 text-sm text-center py-6">Aucune photo publiée pour l'instant.</p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <UploadsToggle code={code} token={token} open={info.admin.settings.uploadsOpen} reload={loadInfo} />
        <Link href={`/clic-clac/${code}/admin`} className="text-white/60 underline">Espace organisateur</Link>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-gray-900 font-bold px-5 py-2.5 rounded-full shadow-2xl z-40">{toast}</div>}
      {tv && <TvLink app="clicclac" code={code} onClose={() => setTv(false)} />}
    </Shell>
  );
}

function Row({ label, children }) {
  return <div><p className="text-sm text-white/60 mb-1.5">{label}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>;
}

function Shell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[#16110f] text-white px-4 py-5">
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}
