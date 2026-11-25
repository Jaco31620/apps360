"use client";
/*
 * Nuage de mots — écran organisateur (à projeter). Relit le nuage toutes les
 * 2 s (seulement s'il a changé), 10 s envois fermés ; veille / arrêt si inactif. Organisateur (jeton de l'appareil, obtenu par le code : #p=…, le QR : #j=…, ou
 * le compte propriétaire), pour
 * ouvrir la session sur un autre appareil) : ouvrir/fermer les envois, masquer
 * un mot d'un clic, choisir le style (palette + fond), modifier la question,
 * réinitialiser, supprimer.
 */
import { sentText } from "@/lib/mail";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import WordCloud from "./WordCloud";
import { exportCloudImage, renderCloudBlob, blobToBase64 } from "./exportImage";
import { getAdminToken, setAdminToken, rememberCloud, forgetCloud, formatCode } from "./storage";
import { MAX_QUESTION_LEN, MAX_WORD_LEN, MAX_CHOICES, maxLabel } from "@/lib/nuage";
import { PALETTES, BACKGROUNDS, WEIGHTS, ARRANGEMENTS, EFFECTS, IMAGE_SIZES, normalizeStyle, resolveTheme } from "@/lib/nuageThemes";
import { appToken } from "@/components/admin/session";
import { backdropClose } from "@/lib/backdrop";
import { useAuth } from "@/components/AuthProvider";
import { bearer } from "./account";
import { fmtPresenterCode, guestLink, presenterLink } from "@/lib/nuageMessages";
import TvLink from "@/components/jukebox/TvLink";
import { useWakeLock } from "@/components/jukebox/useWakeLock";
import SoutenirLink from "@/components/SoutenirLink";

export default function Presenter({ code }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [styleOverride, setStyleOverride] = useState(null); // choix local en attente / non enregistré
  const [stylePanel, setStylePanel] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [bigQr, setBigQr] = useState(false);
  const [settings, setSettings] = useState(false);
  const [origin, setOrigin] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [fromTv, setFromTv] = useState(false); // ouvert depuis apps360.fr/tv : retour au QR code
  const [tvLink, setTvLink] = useState(false);
  const [superMode, setSuperMode] = useState(false); // ?super : piloté par le super-admin
  const [qrBoxH, setQrBoxH] = useState(0); // hauteur du cadre QR → hauteur de l'image de titre
  const qrBoxRef = useRef(null);
  const titleRef = useRef(null);
  const mainRef = useRef(null);
  const [obstacles, setObstacles] = useState([]);

  // Le nuage occupe tout l'écran : l'en-tête (image/question à gauche, cadre QR
  // à droite) est transmis comme zones interdites, en coordonnées du nuage.
  useEffect(() => {
    const measure = () => {
      const area = mainRef.current?.firstElementChild;
      if (!area) return;
      const o = area.getBoundingClientRect();
      const M = 14; // marge autour des obstacles
      const rects = [titleRef.current, qrBoxRef.current]
        .filter((el) => el && el.offsetWidth > 0 && el.offsetHeight > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left - o.left - M), y: Math.round(r.top - o.top - M), w: Math.round(r.width + 2 * M), h: Math.round(r.height + 2 * M) };
        });
      setObstacles((prev) => (JSON.stringify(prev) === JSON.stringify(rects) ? prev : rects));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [titleRef.current, qrBoxRef.current, mainRef.current].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  });

  useEffect(() => {
    const el = qrBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setQrBoxH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const token = useRef(null);
  const { user } = useAuth();
  const [askCode, setAskCode] = useState(false); // saisie du code organisateur
  const [joinErr, setJoinErr] = useState("");
  const triedAccount = useRef(false);

  // Accès organisateur de cet appareil : code, QR, ou compte propriétaire ({}).
  const join = useCallback(async (body) => {
    try {
      const res = await fetch(`/api/nuage/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(body.pin || body.pass ? {} : await bearer()) },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error || "Connexion impossible.";
      token.current = d.token;
      setAdminToken(code, d.token);
      revRef.current = null;
      kick.current();
      return null;
    } catch (e) { return "Connexion impossible, réessayez."; }
  }, [code]);

  useEffect(() => {
    // ?affichage : écran de diffusion seul (TV, 2e écran…) — aucun réglage,
    // même sur un appareil où l'on est organisateur.
    if (new URLSearchParams(window.location.search).has("affichage")) {
      setViewOnly(true);
      setFromTv(new URLSearchParams(window.location.search).has("tv"));
      setOrigin(window.location.origin);
      return;
    }
    // ?super : ouvert depuis le super-admin (son jeton remplace celui du
    // organisateur ; rien n'est gardé dans « Mes nuages » ni en style local).
    const superTok = new URLSearchParams(window.location.search).has("super") && appToken("nuage");
    if (superTok) {
      token.current = superTok;
      setSuperMode(true);
      superRef.current = true;
      setOrigin(window.location.origin);
      return;
    }
    const m = window.location.hash.match(/^#([pj])=([\w-]+)/);
    if (m) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      join(m[1] === "p" ? { pin: m[2] } : { pass: m[2] }).then((e) => { if (e) { setJoinErr(e); setAskCode(true); } });
    }
    token.current = getAdminToken(code);
    setOrigin(window.location.origin);
    try {
      const saved = localStorage.getItem(`nuage_style_${code}`);
      if (saved) setStyleOverride(normalizeStyle(JSON.parse(saved)));
    } catch (e) { /* ignoré */ }
  }, [code, join]);

  // relecture : seulement si le nuage a changé (version « rev », SQL v3)
  const revRef = useRef(null);
  const superRef = useRef(false);
  const refresh = useCallback(async () => {
    const tok = token.current;
    try {
      const q = new URLSearchParams();
      if (tok) q.set("adm", "1"); // jamais servi par le cache partagé
      if (revRef.current != null) q.set("rev", revRef.current);
      const qs = q.toString();
      const res = await fetch(`/api/nuage/${code}${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
        headers: tok ? { "x-nuage-admin": tok } : {},
      });
      if (res.status === 404) return setMissing(true);
      if (res.ok) {
        const d = await res.json();
        if (d.same || tok !== token.current) return false; // accès changé entre-temps : relu juste après
        if (d.token) { token.current = d.token; setAdminToken(code, d.token); } // accès prolongé
        const changed = revRef.current != null && d.rev !== revRef.current;
        revRef.current = d.rev ?? null;
        setData(d);
        if (d.admin && !superRef.current) rememberCloud(code, d.session.question);
        return changed;
      }
    } catch (e) { /* réseau : on retentera */ }
    return false;
  }, [code]);

  // Veille : sans nouveau mot ni action pendant 2 h, relecture toutes les 15 s
  // seulement (un nouveau mot relance) ; après 24 h de veille, arrêt complet
  // (plus aucune lecture : un clic ou une touche relance). Envois fermés : 10 s.
  // ?veille=test : veille après 30 s, arrêt 1 min plus tard.
  const [mode, setMode] = useState("on"); // on | sleep | stopped
  const modeRef = useRef("on");
  useWakeLock(mode === "on"); // l'écran ne s'éteint pas pendant le nuage (sauf en veille)
  const lastAct = useRef(Date.now());
  const kick = useRef(() => {});
  const statusRef = useRef("open");
  statusRef.current = data?.session?.status || "open";
  const activity = useCallback(() => {
    lastAct.current = Date.now();
    if (modeRef.current !== "on") { modeRef.current = "on"; setMode("on"); kick.current(); }
  }, []);

  useEffect(() => {
    let timer = null, alive = true;
    const loop = async () => {
      clearTimeout(timer);
      if (!alive || modeRef.current === "stopped") return;
      if (!document.hidden && await refresh()) activity();
      if (!alive || modeRef.current === "stopped") return;
      const delay = modeRef.current === "sleep" ? 15000 : statusRef.current === "open" ? 2000 : 10000;
      clearTimeout(timer); // une seule boucle, même relancée pendant une relecture
      timer = setTimeout(loop, delay);
    };
    kick.current = loop;
    loop();
    const test = new URLSearchParams(window.location.search).get("veille") === "test";
    const sleepAfter = test ? 30000 : 2 * 3600 * 1000, stopAfter = test ? 60000 : 24 * 3600 * 1000;
    let sleptAt = 0;
    const watch = setInterval(() => {
      const now = Date.now();
      if (modeRef.current === "on" && now - lastAct.current > sleepAfter) { sleptAt = now; modeRef.current = "sleep"; setMode("sleep"); }
      else if (modeRef.current === "sleep" && now - sleptAt > stopAfter) { modeRef.current = "stopped"; setMode("stopped"); }
    }, test ? 5000 : 30000);
    const onInput = () => activity();
    const onVisible = () => { if (!document.hidden) { const asleep = modeRef.current !== "on"; activity(); if (!asleep) loop(); } };
    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false; clearTimeout(timer); clearInterval(watch);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, activity]);

  const act = async (action, extra = {}, silent = false) => {
    const res = await fetch(`/api/nuage/${code}/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-nuage-admin": token.current || "", ...(/claim/.test(action) ? await bearer() : {}) },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { if (!silent) alert(d.error || "Action impossible."); return false; }
    if (d.token) { token.current = d.token; setAdminToken(code, d.token); }
    activity();
    revRef.current = null; // relecture complète (code, compte : hors version)
    await refresh();
    return d;
  };

  // pas (ou plus) d'accès sur cet appareil : essai avec le compte connecté
  useEffect(() => {
    if (!data || data.admin || !user || viewOnly || superMode || triedAccount.current) return;
    triedAccount.current = true;
    join({});
  }, [data, user, viewOnly, superMode, join]);

  const leave = () => { forgetCloud(code); token.current = null; router.push("/nuage"); };

  // Appliqué tout de suite à l'écran, gardé en local, et enregistré sur le nuage
  // (pour la vue « nuage en direct » des participants et les autres appareils).
  const changeStyle = (patch) => {
    const next = normalizeStyle({ ...style, ...patch });
    setStyleOverride(next);
    if (!superMode) try { localStorage.setItem(`nuage_style_${code}`, JSON.stringify(next)); } catch (e) { /* ignoré */ }
    act("style", { style: next }, true);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  const hideWord = (w) => {
    if (confirm(`Masquer « ${w.text} » du nuage ?`)) act("hide", { key: w.k });
  };

  if (missing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <p className="text-xl">Ce nuage n'existe pas (ou a été supprimé).</p>
        <Link href="/nuage" className="bg-white text-slate-900 font-bold px-6 py-3 rounded-full">Retour</Link>
      </div>
    );
  }

  const s = data?.session;
  const style = normalizeStyle(styleOverride || s?.style);
  // l'image de titre vient toujours du serveur (jamais du choix de style local)
  const t = { ...resolveTheme(style), image: normalizeStyle(s?.style).image };
  const isAdmin = !!data?.admin;
  const joinUrl = `${origin}/nuage/${code}`;
  const host = origin.replace(/^https?:\/\//, "");
  const btn = "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors";

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: t.bg, color: t.fg }}>
      <div className="relative flex-1 min-h-0">
      {/* En-tête (par-dessus le nuage) : question/image + comment rejoindre */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-start gap-6 px-6 sm:px-10 pt-6 pointer-events-none">
        <div ref={titleRef} className="min-w-0 pointer-events-auto">
          {t.image
            ? <img src={t.image} alt={s?.question || ""} className="block max-w-full object-contain object-left"
                style={(() => {
                  // taille choisie (Style) : multiple du cadre QR, plafonné en hauteur et largeur
                  const z = IMAGE_SIZES.find((x) => x.value === t.imageSize) || IMAGE_SIZES[1];
                  return qrBoxH
                    ? { height: Math.round(qrBoxH * z.factor), maxHeight: z.maxH, maxWidth: z.maxW }
                    : { maxHeight: z.maxH };
                })()} />
            : <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">{s?.question || "…"}</h1>}
          {s && s.status !== "open" && <p className="mt-2 text-sm font-semibold" style={{ color: t.sub }}>🔒 Envois fermés</p>}
        </div>
        <div className="flex-1" />
        <button ref={qrBoxRef} onClick={() => setBigQr(true)} className="pointer-events-auto hidden sm:flex items-center gap-4 rounded-2xl p-3 shrink-0 text-left" style={{ background: t.panel }}>
          <div className="text-sm leading-snug">
            <div style={{ color: t.sub }}>Rendez-vous sur</div>
            <div className="font-bold">{host}/nuage</div>
            <div className="mt-1" style={{ color: t.sub }}>avec le code</div>
            <div className="text-2xl font-black tracking-wider">{formatCode(code)}</div>
          </div>
          {origin && <div className="bg-white p-1.5 rounded-lg"><QRCodeSVG value={joinUrl} size={96} fgColor="#0f172a" /></div>}
        </button>
      </header>

      {/* Nuage : tout l'écran, en contournant l'en-tête */}
      <main ref={mainRef} className="absolute inset-0 px-4 sm:px-8 py-4">
        {data && data.words.length > 0 ? (
          <WordCloud words={data.words} colors={t.colors} weight={t.weight} arrangement={t.arrangement} effect={t.effect}
            obstacles={obstacles} onWordClick={isAdmin ? hideWord : undefined} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3" style={{ color: t.sub }}>
            <p className="text-xl">En attente des premiers mots…</p>
            <p className="text-sm sm:hidden">Code : <b>{formatCode(code)}</b></p>
          </div>
        )}
      </main>
      </div>

      {/* Barre du bas */}
      <footer className="flex flex-wrap items-center gap-2 px-6 sm:px-10 pb-5 text-sm">
        <span style={{ color: t.sub }}>
          {data ? `${data.participants} participant${data.participants > 1 ? "s" : ""} · ${data.total} mot${data.total > 1 ? "s" : ""}` : ""}
          {mode === "sleep" && <span className="ml-3 opacity-70" title="Plus de nouveau mot depuis longtemps : le nuage est relu moins souvent. Un nouveau mot ou un clic le relance.">⏸ en veille</span>}
        </span>
        <div className="flex-1" />
        {superMode && data && !isAdmin && ( // ouvert dans un nouvel onglet (écran projeté) : pas de bouton de retour
          <Link href="/nuage/super" className={btn} style={{ background: t.panel }}>🛡️ Session expirée</Link>
        )}
        {data && !isAdmin && !viewOnly && !superMode && (
          <button onClick={() => setAskCode(true)} className={btn} style={{ background: t.panel }}>🔑 Organisateur</button>
        )}
        {isAdmin && s && (
          <button onClick={() => act(s.status === "open" ? "close" : "open")} className={btn} style={{ background: t.panel }}>
            {s.status === "open" ? "⏸ Fermer les envois" : "▶ Ouvrir les envois"}
          </button>
        )}
        {!viewOnly && data?.words.length > 0 && (
          <button onClick={() => exportCloudImage({ words: data.words, theme: t, question: s?.question, filename: `nuage-${code}.png` })}
            className={btn} style={{ background: t.panel }} title="Enregistrer le nuage en image (sans QR code ni boutons)">
            ⬇ Image
          </button>
        )}
        {isAdmin && data?.words.length > 0 && (
          <button onClick={() => setMailOpen(true)} className={btn} style={{ background: t.panel }} title="Envoyer l'image du nuage par e-mail">
            ✉️ Envoyer
          </button>
        )}
        {!viewOnly && <button onClick={() => setBigQr(true)} className={btn} style={{ background: t.panel }}>QR code</button>}
        {isAdmin && <button onClick={() => setStylePanel(true)} className={btn} style={{ background: t.panel }}>🎨 Style</button>}
        {fromTv && <a href="/tv" className={`${btn} opacity-40 hover:opacity-100 focus:opacity-100 focus:ring-4 outline-none`} style={{ background: t.panel }}>📺 Changer d'affichage</a>}
        <button onClick={toggleFullscreen} className={`${btn} ${viewOnly ? "opacity-40 hover:opacity-100" : ""}`} style={{ background: t.panel }} title="Plein écran">⛶</button>
        {isAdmin && <button onClick={() => setSettings(true)} className={btn} style={{ background: t.panel }}>⚙️</button>}
        {/* soutien : organisateur seulement, une fois le nuage fermé (jamais sur l'écran d'affichage) */}
        {isAdmin && !viewOnly && s?.status === "closed" && <SoutenirLink dark={t.dark} className="w-full mt-1" />}
      </footer>

      {mode === "stopped" && (
        <div onClick={activity} className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 text-white cursor-pointer p-6 text-center">
          <div className="bg-black/70 rounded-3xl px-10 py-8 shadow-2xl">
            <p className="text-3xl sm:text-4xl font-black">⏸ Nuage en pause</p>
            <p className="text-lg sm:text-2xl text-white/75 mt-3">Cliquez pour relancer l'affichage en direct</p>
          </div>
        </div>
      )}

      {bigQr && (
        <div onClick={() => setBigQr(false)} className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/85 text-white cursor-pointer p-6 text-center">
          <div className="bg-white p-5 rounded-3xl"><QRCodeSVG value={joinUrl} size={320} /></div>
          <p className="text-2xl">Rendez-vous sur <b>{host}/nuage</b></p>
          <p className="text-6xl font-black tracking-widest">{formatCode(code)}</p>
        </div>
      )}

      {askCode && !isAdmin && (
        <CodeDialog error={joinErr} onClose={() => { setAskCode(false); setJoinErr(""); }}
          onSubmit={async (pin) => { const e = await join({ pin }); setJoinErr(e || ""); if (!e) setAskCode(false); }} />
      )}

      {mailOpen && isAdmin && s && (
        <MailDialog code={code} token={token.current} words={data.words} theme={t} question={s.question} onClose={() => setMailOpen(false)} />
      )}

      {stylePanel && isAdmin && (
        <StylePanel style={style} onChange={changeStyle} onClose={() => setStylePanel(false)}
          image={t.image} code={code} token={token.current} onImageChange={refresh} />
      )}

      {tvLink && <TvLink app="nuage" code={code} onClose={() => setTvLink(false)} />}

      {settings && isAdmin && s && (
        <Settings
          session={s} words={data.words} hidden={data.hidden || []} code={code} origin={origin}
          presenterCode={data.presenterCode} owned={data.owned} user={user} onLeave={leave}
          onClose={() => setSettings(false)} act={act} onTv={() => { setSettings(false); setTvLink(true); }}
          superMode={superMode}
          onDeleted={() => { forgetCloud(code); router.push(superMode ? "/nuage/super" : "/nuage"); }}
        />
      )}
    </div>
  );
}

/* Envoi de l'image du nuage par e-mail (jusqu'à 10 destinataires). */
function MailDialog({ code, token, words, theme, question, onClose }) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    try { setReplyTo(localStorage.getItem("nuage_reply_to") || ""); } catch (e) { /* ignoré */ }
    let url;
    renderCloudBlob({ words, theme, question }).then((b) => {
      blobRef.current = b;
      url = URL.createObjectURL(b);
      setPreview(url);
    });
    return () => url && URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recipients = to.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

  const send = async (e) => {
    e.preventDefault();
    if (!recipients.length || !blobRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      try { localStorage.setItem("nuage_reply_to", replyTo.trim()); } catch (err) { /* ignoré */ }
      const res = await fetch(`/api/nuage/${code}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-nuage-admin": token || "", ...(await bearer()) },
        body: JSON.stringify({ to: recipients, message, replyTo, image: await blobToBase64(blobRef.current) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(d.error || "Envoi impossible."), { login: d.login });
      setStatus({ ok: !d.failed?.length, text: sentText(d) });
      setTo((d.failed || []).join(", "));
    } catch (err) {
      setStatus({ ok: false, text: err.message, login: err.login });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" {...backdropClose(onClose)}>
      <form onSubmit={send} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white text-gray-900 rounded-3xl p-6 space-y-4 shadow-2xl max-h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Envoyer le nuage par e-mail</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
          {preview ? <img src={preview} alt="Aperçu du nuage" className="w-full" /> : <span className="text-sm text-gray-400">Préparation de l'image…</span>}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-600">Destinataires</span>
          <textarea rows={2} value={to} onChange={(e) => setTo(e.target.value)} placeholder="adresse@exemple.fr, autre@exemple.fr"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none resize-none" />
          <span className="text-xs text-gray-400">Séparez les adresses par une virgule ou un retour à la ligne (10 maximum).</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-600">Message <span className="font-normal text-gray-400">(facultatif)</span></span>
          <textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Merci à tous pour votre participation !"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none resize-none" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-600">Votre e-mail pour les réponses <span className="font-normal text-gray-400">(facultatif)</span></span>
          <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="vous@exemple.fr"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none" />
        </label>
        {status && <p className={`text-sm font-semibold ${status.ok ? "text-green-600" : "text-red-600"}`}>{status.text}
          {status.login && <> <Link href={`/connexion?next=/nuage/${code}/presenter`} className="underline">Se connecter</Link></>}</p>}
        <button disabled={busy || !recipients.length || !preview}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-full transition-colors">
          {busy ? "Envoi…" : `Envoyer${recipients.length ? ` à ${recipients.length} destinataire${recipients.length > 1 ? "s" : ""}` : ""}`}
        </button>
      </form>
    </div>
  );
}

/* Mini-schéma : gros mots (barres épaisses) au centre ou répartis. */
function ArrangementIcon({ kind }) {
  const bars = kind === "center"
    ? [[22, 16, 20, 7], [14, 9, 10, 3], [36, 10, 10, 3], [12, 27, 12, 3], [34, 27, 14, 3]]
    : [[6, 6, 16, 6], [36, 24, 16, 6], [26, 8, 10, 3], [8, 24, 12, 3], [24, 30, 10, 3], [40, 12, 10, 3]];
  return (
    <svg width="60" height="38" viewBox="0 0 60 38" className="text-gray-500">
      {bars.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="1.5" fill="currentColor" />)}
    </svg>
  );
}

/* Image affichée à la place de la question (logo, visuel…). */
function TitleImage({ image, code, token, onChange, size, onSize }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/nuage/${code}/image`, { method: "POST", headers: { "x-nuage-admin": token || "" }, body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Envoi impossible.");
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/nuage/${code}/image`, { method: "DELETE", headers: { "x-nuage-admin": token || "" } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Suppression impossible.");
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">Image à la place de la question</h3>
      <p className="text-xs text-gray-400">Logo ou visuel affiché en haut à gauche de l'écran (PNG, JPEG, WebP ou GIF, 3 Mo max). Les participants voient toujours la question.</p>
      {image && (
        <div className="rounded-xl border border-gray-200 bg-gray-100 p-2 flex items-center justify-center">
          <img src={image} alt="" className="max-h-24 max-w-full object-contain" />
        </div>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => upload(e.target.files?.[0])} />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex-1 border-2 border-gray-200 rounded-full py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">
          {busy ? "Envoi…" : image ? "Changer l'image" : "Choisir une image"}
        </button>
        {image && (
          <button type="button" disabled={busy} onClick={remove}
            className="border-2 border-red-200 text-red-600 rounded-full px-4 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-40">
            Retirer
          </button>
        )}
      </div>
      {image && (
        <div className="pt-1">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Taille</span>
          </div>
          <input type="range" min={0} max={IMAGE_SIZES.length - 1} step={1}
            value={Math.max(0, IMAGE_SIZES.findIndex((z) => z.value === size))}
            onChange={(e) => onSize(IMAGE_SIZES[Number(e.target.value)].value)}
            className="w-full accent-violet-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-gray-500 -mt-1">
            {IMAGE_SIZES.map((z) => (
              <span key={z.value} className={size === z.value ? "font-bold text-violet-700" : ""}>{z.label}</span>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

function StylePanel({ style, onChange, onClose, image, code, token, onImageChange }) {
  const isPreset = BACKGROUNDS.some((b) => b.value === style.bg);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" {...backdropClose(onClose)}>
      <div className="w-full max-w-sm h-full bg-white text-gray-900 overflow-y-auto p-6 space-y-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Style</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <p className="text-xs text-gray-400 -mt-4">Les changements s'appliquent en direct. Les couleurs des mots s'adaptent au fond pour rester lisibles.</p>

        <TitleImage image={image} code={code} token={token} onChange={onImageChange}
          size={style.imageSize} onSize={(v) => onChange({ imageSize: v })} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Fond</h3>
          <div className="grid grid-cols-7 gap-2">
            {BACKGROUNDS.map((b) => (
              <button key={b.value} title={b.label} onClick={() => onChange({ bg: b.value })}
                className={`aspect-square rounded-xl border-2 ${style.bg === b.value ? "border-violet-600 ring-2 ring-violet-300" : "border-gray-200"}`}
                style={{ background: b.value }} />
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-600 pt-1">
            <input type="color" value={style.bg} onChange={(e) => onChange({ bg: e.target.value })}
              className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer" />
            <span>Couleur personnalisée{!isPreset && <b className="ml-1 font-mono">{style.bg}</b>}</span>
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Disposition</h3>
          <div className="grid grid-cols-2 gap-2">
            {ARRANGEMENTS.map((a) => (
              <button key={a.value} onClick={() => onChange({ arrangement: a.value })}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold flex flex-col items-center gap-1 ${style.arrangement === a.value ? "border-violet-600 bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
                <ArrangementIcon kind={a.value} />
                {a.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Effet nuage</h3>
          <input type="range" min={0} max={EFFECTS.length - 1} step={1}
            value={Math.max(0, EFFECTS.findIndex((e) => e.value === style.effect))}
            onChange={(e) => onChange({ effect: EFFECTS[Number(e.target.value)].value })}
            className="w-full accent-violet-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-gray-500 -mt-1">
            {EFFECTS.map((e) => (
              <span key={e.value} className={style.effect === e.value ? "font-bold text-violet-700" : ""}>{e.label}</span>
            ))}
          </div>
          <p className="text-xs text-gray-400">{EFFECTS.find((e) => e.value === style.effect)?.hint}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Épaisseur de la police</h3>
          <div className="grid grid-cols-5 gap-2">
            {WEIGHTS.map((w) => (
              <button key={w.value} onClick={() => onChange({ weight: w.value })} title={w.label}
                className={`rounded-xl border-2 py-1.5 flex flex-col items-center ${style.weight === w.value ? "border-violet-600 bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
                <span className="text-xl leading-none" style={{ fontWeight: w.value }}>Aa</span>
                <span className="text-[10px] text-gray-500 mt-1">{w.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Couleurs des mots</h3>
          {Object.entries(PALETTES).map(([key, p]) => {
            const preview = resolveTheme({ palette: key, bg: style.bg });
            const active = style.palette === key;
            return (
              <button key={key} onClick={() => onChange({ palette: key })}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border-2 text-left ${active ? "border-violet-600" : "border-transparent hover:border-gray-200"}`}
                style={{ background: preview.bg }}>
                <span className="flex-1 font-extrabold truncate" style={{ color: preview.fg }}>{p.label}</span>
                <span className="flex gap-1">
                  {preview.colors.map((c, i) => <span key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />)}
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

/* Liste des mots publiés : corriger (orthographe), masquer, supprimer. */
function WordList({ words, hidden, act }) {
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null); // clé du mot en cours de correction
  const [draft, setDraft] = useState("");
  const [countEdit, setCountEdit] = useState(null); // clé du mot dont on modifie le nombre
  const [countDraft, setCountDraft] = useState("");
  const [sort, setSort] = useState("count"); // "count" | "alpha"

  useEffect(() => {
    try { if (localStorage.getItem("nuage_word_sort") === "alpha") setSort("alpha"); } catch (e) { /* ignoré */ }
  }, []);
  const changeSort = (v) => {
    setSort(v);
    try { localStorage.setItem("nuage_word_sort", v); } catch (e) { /* ignoré */ }
  };

  const alpha = (a, b) => a.w.localeCompare(b.w, "fr", { sensitivity: "base" });
  const all = [...words.map((w) => ({ ...w, hidden: false })), ...hidden.map((w) => ({ ...w, hidden: true }))]
    .sort(sort === "alpha" ? alpha : (a, b) => b.n - a.n || alpha(a, b));
  const f = filter.trim().toLowerCase();
  const list = f ? all.filter((w) => w.w.toLowerCase().includes(f)) : all;

  const saveCount = async (w) => {
    const n = parseInt(countDraft, 10);
    if (Number.isFinite(n) && n !== w.n) {
      if (n === 0 && !confirm(`Mettre « ${w.w} » à 0 le supprime du nuage. Continuer ?`)) return;
      await act("count", { key: w.k, n: Math.max(0, Math.min(999, n)) });
    }
    setCountEdit(null);
  };

  const save = async (w) => {
    const next = draft.trim();
    if (next && next !== w.w) await act("rename", { key: w.k, word: next });
    setEditing(null);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-600">Mots publiés ({all.length})</h3>
        <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Classement">
          {[["count", "Nb d'envois"], ["alpha", "A → Z"]].map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => changeSort(v)}
              className={`px-3 py-1 rounded-full transition-colors ${sort === v ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400">Corrigez une faute (✏️) : si le mot corrigé existe déjà, les deux sont fusionnés. Cliquez sur « ×n » pour modifier le nombre d'occurrences. Astuce : un clic sur un mot du nuage le masque.</p>
      {all.length > 8 && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher…"
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500 outline-none" />
      )}
      {list.length === 0 && <p className="text-sm text-gray-400">Aucun mot.</p>}
      <ul className="space-y-1.5">
        {list.map((w) => (
          <li key={w.k} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${w.hidden ? "bg-gray-100 text-gray-400" : "bg-gray-50"}`}>
            {editing === w.k ? (
              <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); save(w); }}>
                <input autoFocus value={draft} maxLength={MAX_WORD_LEN} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                  className="flex-1 min-w-0 border-2 border-violet-400 rounded-lg px-2 py-1 outline-none" />
                <button className="text-violet-600 font-bold">OK</button>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-400">✕</button>
              </form>
            ) : (
              <>
                <span className={`flex-1 min-w-0 truncate ${w.hidden ? "line-through" : ""}`}>{w.w}</span>
                {countEdit === w.k ? (
                  <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); saveCount(w); }}>
                    <span className="text-gray-400">×</span>
                    <input autoFocus type="number" min={0} max={999} value={countDraft} onChange={(e) => setCountDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setCountEdit(null)}
                      className="w-16 border-2 border-violet-400 rounded-lg px-1.5 py-0.5 outline-none text-right" />
                    <button className="text-violet-600 font-bold text-xs">OK</button>
                  </form>
                ) : (
                  <button title="Modifier le nombre d'occurrences" onClick={() => { setCountEdit(w.k); setCountDraft(String(w.n)); }}
                    className="text-gray-500 hover:text-violet-700 font-semibold tabular-nums underline decoration-dotted underline-offset-2">
                    ×{w.n}
                  </button>
                )}
                <button title="Corriger" onClick={() => { setEditing(w.k); setDraft(w.w); }} className="hover:scale-110">✏️</button>
                <button title={w.hidden ? "Réafficher" : "Masquer"} onClick={() => act(w.hidden ? "unhide" : "hide", { key: w.k })}
                  className="text-xs font-semibold text-sky-600 w-16 text-right">{w.hidden ? "Réafficher" : "Masquer"}</button>
                <button title="Supprimer" onClick={() => confirm(`Supprimer définitivement « ${w.w} » (${w.n} envoi${w.n > 1 ? "s" : ""}) ?`) && act("remove", { key: w.k })}
                  className="hover:scale-110">🗑️</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Saisie du code organisateur. */
function CodeDialog({ error, onClose, onSubmit }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); await onSubmit(pin); setBusy(false); };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" {...backdropClose(onClose)}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white text-gray-900 rounded-3xl p-6 space-y-4 shadow-2xl">
        <h2 className="text-xl font-bold">Code organisateur</h2>
        {/* masqué : l'écran est souvent projeté */}
        <input autoFocus type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.toUpperCase().slice(0, 12))} aria-label="Code organisateur"
          className="w-full text-center text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border-2 border-gray-200 rounded-full py-2 font-semibold">Annuler</button>
          <button disabled={busy || pin.replace(/[^A-Z0-9]/g, "").length !== 8} className="flex-1 bg-violet-600 disabled:opacity-40 text-white font-bold rounded-full py-2">Valider</button>
        </div>
      </form>
    </div>
  );
}

/* Accès organisateur : code (caché au départ, écran souvent projeté), QR vers
 * le téléphone, compte, nouveau code. */
function Access({ code, presenterCode, origin, owned, user, act, copy, copied, superMode, onLeave }) {
  const [show, setShow] = useState(false);
  const [qr, setQr] = useState(null);
  const line = "w-full border-2 border-gray-200 rounded-full py-2 text-sm font-semibold hover:bg-gray-50";
  const makeQr = async () => {
    const r = await act("pass");
    if (r?.pass) setQr(`${origin}/nuage/${code}/presenter#j=${r.pass}`);
  };
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">Accès organisateur</h3>
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
        <span className="font-mono font-bold tracking-widest">{show ? fmtPresenterCode(presenterCode) : "•••• ••••"}</span>
        <button onClick={() => setShow(!show)} className="text-xs underline text-gray-500">{show ? "Masquer" : "Afficher le code"}</button>
      </div>
      <button onClick={() => copy(presenterLink(origin, { code, presenterCode }), "admin")} className={line}>
        {copied === "admin" ? "✓ Lien copié" : "Copier le lien organisateur"}
      </button>
      <p className="text-xs text-gray-400">Le code et le lien donnent le contrôle du nuage : ne les partagez pas avec le public.</p>
      {!superMode && <>
        <button onClick={makeQr} className={line}>📱 Continuer sur mon téléphone</button>
        {qr && <div className="text-center space-y-1"><div className="inline-block bg-white p-2 border rounded-xl"><QRCodeSVG value={qr} size={160} /></div>
          <p className="text-xs text-gray-400">Utilisable une fois, pendant 10 minutes. <button onClick={() => setQr(null)} className="underline">Masquer</button></p></div>}
      </>}
      <button onClick={async () => {
        if (!confirm("Créer un nouveau code organisateur ?\nL'ancien code, l'ancien lien et les autres appareils organisateurs n'auront plus accès.")) return;
        setQr(null); await act("newcode");
      }} className={line}>Nouveau code organisateur</button>
      {!superMode && <button onClick={() => confirm("Quitter le mode organisateur sur cet appareil ?\nIl faudra le code organisateur (ou votre compte) pour y revenir.") && onLeave()} className={line}>Quitter sur cet appareil</button>}
      {!superMode && (
        <div className="pt-2 text-sm text-gray-600">
          {owned ? (
            <p>✓ Rattaché à un compte apps360.
              {user && <button onClick={() => confirm("Retirer ce nuage de votre compte ?\nGardez le code organisateur pour le retrouver.") && act("unclaim")} className="block text-xs underline text-gray-400">Retirer de mon compte</button>}
            </p>
          ) : user ? (
            <button onClick={() => act("claim")} className={line}>Enregistrer dans mon compte</button>
          ) : (
            <Link href={`/connexion?next=/nuage/${code}/presenter`} className="block text-center underline text-violet-600">Se connecter pour enregistrer ce nuage (facultatif)</Link>
          )}
          <Link href="/nuage/confidentialite" target="_blank" className="block text-xs text-gray-400 underline mt-1">Vos données</Link>
        </div>
      )}
    </section>
  );
}

function Settings({ session, words, hidden, code, origin, onClose, act, onDeleted, superMode, presenterCode, owned, user, onLeave, onTv }) {
  const [question, setQuestion] = useState(session.question);
  const [copied, setCopied] = useState(false);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* ignoré */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" {...backdropClose(onClose)}>
      <div className="w-full max-w-sm h-full bg-white text-gray-900 overflow-y-auto p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Réglages</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-600">Question</label>
          <textarea rows={3} maxLength={MAX_QUESTION_LEN} value={question} onChange={(e) => setQuestion(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none resize-none" />
          <button disabled={!question.trim() || question === session.question} onClick={() => act("question", { question })}
            className="bg-violet-600 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 rounded-full">Enregistrer</button>
        </section>

        <section className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-600">Mots par participant</label>
          <select value={session.maxPerParticipant} onChange={(e) => act("max", { max: e.target.value })}
            className="border-2 border-gray-200 rounded-xl px-3 py-1.5 font-semibold">
            {MAX_CHOICES.map((n) => <option key={n} value={n}>{maxLabel(n)}</option>)}
          </select>
        </section>

        <WordList words={words} hidden={hidden} act={act} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">Inviter les participants</h3>
          <button onClick={() => copy(guestLink(origin, code), "guest")}
            className="w-full border-2 border-gray-200 rounded-full py-2 text-sm font-semibold hover:bg-gray-50">
            {copied === "guest" ? "✓ Lien copié" : "Copier le lien participants"}
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">📺 Écran d'affichage</h3>
          <button onClick={onTv} className="w-full bg-violet-600 text-white rounded-full py-2 text-sm font-bold">📺 Connecter une télé</button>
          <button onClick={() => copy(`${origin}/nuage/${code}/presenter?affichage`, "view")}
            className="w-full border-2 border-gray-200 rounded-full py-2 text-sm font-semibold hover:bg-gray-50">
            {copied === "view" ? "✓ Lien copié" : "Copier le lien de l'écran d'affichage"}
          </button>
          <p className="text-xs text-gray-400">Nuage en direct avec la question et le QR code, sans aucun bouton de réglage : idéal pour une TV ou un 2e écran. Peut être partagé sans risque.</p>
        </section>

        <Access code={code} presenterCode={presenterCode} origin={origin} owned={owned} user={user}
          act={act} copy={copy} copied={copied} superMode={superMode} onLeave={onLeave} />

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <button onClick={() => confirm("Effacer tous les mots envoyés ?") && act("reset")}
            className="w-full border-2 border-orange-200 text-orange-600 rounded-full py-2 text-sm font-semibold hover:bg-orange-50">
            Réinitialiser le nuage
          </button>
          <button onClick={async () => confirm("Supprimer définitivement ce nuage ?") && (await act("delete")) && onDeleted()}
            className="w-full border-2 border-red-200 text-red-600 rounded-full py-2 text-sm font-semibold hover:bg-red-50">
            Supprimer le nuage
          </button>
        </section>
      </div>
    </div>
  );
}
