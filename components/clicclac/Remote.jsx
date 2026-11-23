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
import { photoAt } from "@/lib/clicclac/liveSeq";
import { LIVE_DEFAULTS, LIVE_SPEEDS, LIVE_ORDERS, LIVE_LAYOUTS, LIVE_TRANSITIONS, LIVE_QR_SIZES, liveSpeedLabel } from "@/lib/clicclac/settings";

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
  const [sent, setSent] = useState(null); // { rev, at } : dernier envoi, pour l'accusé de réception
  const [menu, setMenu] = useState(null); // photo dont on ouvre les actions
  const clock = useRef({ off: 0, rtt: Infinity }); // écart avec l'horloge du serveur (même calcul que les écrans)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
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
      photosRef.current = await syncPhotos(code, photosRef.current, { token, rev: d.album?.photosRev });
      setPhotos(photosRef.current);
    } catch (e) { if (e.status === 404) setInfo(null); }
  }, [code, token]);
  const loadLive = useCallback(async () => {
    try {
      const t0 = Date.now();
      const st = await api(`/${code}/live?screens=1`);
      const t1 = Date.now(), c = clock.current, rtt = t1 - t0;
      if (st.now && (rtt <= c.rtt * 1.5 || rtt < 400)) { c.off = st.now - (t0 + t1) / 2; c.rtt = Math.min(c.rtt, rtt); }
      setLive(st);
      setNow(Date.now());
    } catch (e) { /* réseau */ }
  }, [code]);

  useEffect(() => {
    if (!token) return undefined;
    loadInfo(); loadLive();
    const a = setInterval(() => { if (!document.hidden) loadInfo(); }, 10000);
    const b = setInterval(() => { if (!document.hidden) loadLive(); }, 2000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [token, loadInfo, loadLive]);

  const flash = (t) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? "" : x)), 2500); };
  const send = async (body, msg) => {
    try {
      const st = await api(`/${code}/live`, { method: "POST", token, body });
      setLive((l) => ({ ...st, screens: l?.screens }));
      if (st.now) clock.current.off = st.now - Date.now();
      setSent({ rev: st.rev, at: Date.now(), msg });
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
  const setCfg = (patch) => { setLive((l) => ({ ...l, cfg: { ...cfg, ...patch } })); send({ cfg: patch }, "Réglage appliqué"); };
  const published = photos.filter((p) => p.status === "published");
  const pending = photos.filter((p) => p.status === "pending");
  const screens = live.screens || [];
  const tvs = screens.filter((x) => x.tv).length;
  // accusé de réception du dernier envoi : écrans qui ont appliqué cette version
  let ackLine = null;
  if (sent) {
    const got = screens.filter((x) => x.ack >= sent.rev).length, wait = now - sent.at;
    if (!screens.length) ackLine = { tone: "warn", text: "⚠ Aucun écran ouvert pour recevoir la commande." };
    else if (got === screens.length) ackLine = wait < 8000 ? { tone: "ok", text: `✓ ${sent.msg ? `${sent.msg} · ` : ""}reçu par ${got > 1 ? `les ${got} écrans` : "l'écran"}` } : null;
    else if (wait < 6000) ackLine = { tone: "wait", text: "⏳ Envoi à l'écran…" };
    else ackLine = { tone: "warn", text: `⚠ ${screens.length - got} écran${screens.length - got > 1 ? "s n'ont" : " n'a"} pas répondu : rechargez la page sur ${screens.length - got > 1 ? "ces écrans" : "cet écran"}.` };
  }

  // photo à l'écran en ce moment : même calcul que les écrans (programme commun)
  const onScreen = live ? (photoAt(live, published, now + clock.current.off).photo || null) : null;
  const onScreenPhoto = onScreen ? published.find((p) => p.id === onScreen.id) || onScreen : null;
  // 🙈 retirer (repasse « en attente », récupérable) ou 🗑 supprimer
  const moderate = async (p, how) => {
    try {
      if (how === "hide") await api(`/${code}/photos/${p.id}`, { method: "PATCH", token, body: { status: "pending" } });
      else {
        if (!confirm("Supprimer définitivement cette photo ?")) return;
        await api(`/${code}/photos/${p.id}`, { method: "DELETE", token });
      }
      photosRef.current = how === "hide"
        ? photosRef.current.map((x) => (x.id === p.id ? { ...x, status: "pending" } : x))
        : photosRef.current.filter((x) => x.id !== p.id);
      setPhotos(photosRef.current);
      setMenu(null);
      flash(how === "hide" ? "🙈 Retirée (dans « À valider »)" : "Photo supprimée");
      loadLive();
    } catch (e) { flash(`⚠ ${e.message}`); }
  };

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
          <p className={`text-sm ${screens.length ? "text-green-300" : "text-white/50"}`}>
            {screens.length ? `● ${screens.length} écran${screens.length > 1 ? "s" : ""} connecté${screens.length > 1 ? "s" : ""}${tvs ? ` (dont ${tvs > 1 ? `${tvs} télés` : "1 télé"})` : ""}` : "○ Aucun écran ouvert"}
          </p>
          {!tvs && <p className="text-xs text-white/40">Sur la télé : ouvrez apps360.fr/tv puis « Connecter une télé » · ou <a href={`/clic-clac/${code}/live`} target="_blank" className="underline">ouvrir l'écran sur cet appareil</a></p>}
        </div>
        <button onClick={() => setTv(true)} className="shrink-0 bg-white text-gray-900 font-bold px-4 py-2 rounded-full text-sm">📺 Connecter une télé</button>
      </header>

      {/* lecture */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <button onClick={() => send({ cmd: { type: "prev" } }, "Photo précédente")} className="bg-white/10 active:bg-white/20 rounded-2xl py-5 text-3xl" aria-label="Photo précédente">⏮</button>
        <button onClick={() => send({ paused: !live.paused }, live.paused ? "▶ Lecture" : "⏸ En pause")}
          className={`rounded-2xl py-5 text-3xl ${live.paused ? "bg-[#ff5a5f]" : "bg-white/10 active:bg-white/20"}`} aria-label="Pause / lecture">{live.paused ? "▶" : "⏸"}</button>
        <button onClick={() => send({ cmd: { type: "next" } }, "Photo suivante")} className="bg-white/10 active:bg-white/20 rounded-2xl py-5 text-3xl" aria-label="Photo suivante">⏭</button>
      </div>

      {ackLine && (
        <p className={`-mt-3 mb-4 text-sm text-center rounded-xl px-3 py-2 ${ackLine.tone === "ok" ? "bg-green-500/15 text-green-300" : ackLine.tone === "wait" ? "bg-white/10 text-white/70" : "bg-amber-400/15 text-amber-200"}`}>{ackLine.text}</p>
      )}

      {/* photo à l'écran en ce moment */}
      {onScreenPhoto && screens.length > 0 && (
        <section className="flex items-center gap-3 bg-white/5 rounded-3xl p-3 mb-5">
          <img src={onScreenPhoto.thumb} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50">À l'écran maintenant</p>
            <p className="font-semibold truncate">{onScreenPhoto.caption || (onScreenPhoto.name ? `📸 ${onScreenPhoto.name}` : "Photo")}</p>
          </div>
          <button onClick={() => moderate(onScreenPhoto, "hide")} className="shrink-0 bg-amber-400/20 text-amber-200 font-bold px-3 py-2 rounded-full text-sm">🙈 Retirer celle-ci</button>
        </section>
      )}

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
        <Row label={liveSpeedLabel(cfg.layout)}>{LIVE_SPEEDS.map((v) => <button key={v} onClick={() => setCfg({ speed: v })} className={chip(cfg.speed === v)}>{v} s</button>)}</Row>
        <Row label="Ordre">{LIVE_ORDERS.map(([v, l]) => <button key={v} onClick={() => setCfg({ order: v })} className={chip(cfg.order === v)}>{l}</button>)}</Row>
        {cfg.qr && <Row label="Taille du QR code">{LIVE_QR_SIZES.map(([v, l]) => <button key={v} onClick={() => setCfg({ qrSize: v })} className={chip(cfg.qrSize === v)}>{l}</button>)}</Row>}
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
        <h2 className="font-bold mb-1">🖼️ Photos de l'album</h2>
        <p className="text-xs text-white/50 mb-3">Touchez une photo pour l'afficher à l'écran, la retirer ou la supprimer.</p>
        {published.length ? (
          <div className="grid grid-cols-4 gap-1.5">
            {published.slice(0, 120).map((p) => (
              <button key={p.id} onClick={() => setMenu(p)}
                className={`aspect-square rounded-lg overflow-hidden bg-white/10 active:opacity-60 ${onScreen?.id === p.id ? "ring-2 ring-[#ff5a5f]" : ""}`}>
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
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-3" onClick={() => setMenu(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#221a17] rounded-3xl p-4 space-y-3">
            <img src={menu.full || menu.thumb} alt="" className="w-full max-h-[45vh] object-contain rounded-2xl bg-black" />
            {(menu.caption || menu.name) && <p className="text-sm text-white/70 text-center">{menu.caption}{menu.caption && menu.name ? " — " : ""}{menu.name && `📸 ${menu.name}`}</p>}
            <button onClick={() => { send({ cmd: { type: "show", photoId: menu.id } }, "Photo affichée"); setMenu(null); }}
              className="w-full bg-[#ff5a5f] font-bold py-3 rounded-full">📺 Afficher à l'écran</button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => moderate(menu, "hide")} className="bg-amber-400/20 text-amber-200 font-bold py-3 rounded-full">🙈 Retirer</button>
              <button onClick={() => moderate(menu, "delete")} className="bg-red-500/20 text-red-300 font-bold py-3 rounded-full">🗑 Supprimer</button>
            </div>
            <p className="text-xs text-white/40 text-center">« Retirer » cache la photo (écrans et album) sans la supprimer : elle revient dans « À valider ».</p>
            <button onClick={() => setMenu(null)} className="w-full text-white/60 py-2">Annuler</button>
          </div>
        </div>
      )}
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
