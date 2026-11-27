"use client";
/*
 * BETA (27/11/2026) — copie de Ecran.jsx pour une soirée avec un album Clic-Clac
 * (réglage « photos », page /jukebox/<code>/photos) : Jukebox réduit à un bandeau
 * en bas (vidéo en vignette ou son seul, titre, QR unique), l'écran live Clic-Clac
 * intégré tel quel au-dessus (son fonctionnement et son pilotage habituels). Le lecteur reste TOUJOURS monté au même
 * endroit de l'arbre : seules ses classes / son style changent (sinon la musique
 * se couperait). Sans album lié : retour à l'écran habituel (/ecran). Aucune
 * photo pendant un blind test. Une fois validée, à fusionner dans Ecran.jsx.
 *
 * Jukebox — écran d'affichage (TV, vidéoprojecteur), sans aucun réglage :
 * vidéo en cours, QR code pour proposer des titres et, si la régie l'a
 * choisi, la file à suivre. Toujours vu « comme le public » (?view=ecran,
 * sans jeton régie).
 * La vidéo est jouée en MUET (le son vient de la régie) et suit la position
 * envoyée par la régie : `playback` est horodaté par le serveur, converti en
 * heure locale grâce à `serverTime` (pas besoin d'horloges synchronisées).
 * Mode son (`sound`, télé sans PC, jeton régie sur l'appareil) : l'écran
 * joue lui-même la musique avec le moteur de la régie (usePlayerEngine) ; la
 * régie se pilote alors depuis la télécommande (téléphone).
 */
import { missingFrom } from "./ClosingNotice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Palmares } from "./Palmares";
import { formatCode, authHeaders, getAdminToken, setScreen } from "./storage";
import { useLive } from "./useLive";
import { useVeille, partyStamp, VeilleOverlay } from "./useVeille";
import { useAdminActions } from "./optimistic";
import { useWakeLock } from "./useWakeLock";
import { usePlayerEngine } from "./usePlayerEngine";
import { themeVars, HANDOFF_MS, TV_PAIRED_KEY } from "@/lib/jukebox";
import { Leaderboard } from "./Blind";
import { loadYouTubeApi, createPlayer } from "./youtube";
import AppIcon from "@/components/AppIcon";

const MAX_SHOWN = 6;

export default function EcranBeta({ code, sound: wantSound, claim = false }) {
  const [data, setData] = useState(null);
  const [sound, setSound] = useState(null); // mode son (jeton régie présent) ; null : pas encore lu
  useEffect(() => { setSound(!!wantSound && !!getAdminToken(code)); }, [wantSound, code]);
  const [canSound, setCanSound] = useState(false); // accès régie : « Prendre le son ici » possible
  const [pairedTv, setPairedTv] = useState(false); // télé jumelée (apps360.fr/tv), pas un onglet de la régie
  useEffect(() => {
    setCanSound(!!getAdminToken(code));
    try { setPairedTv(localStorage.getItem(TV_PAIRED_KEY(code)) === "1"); } catch (e) { /* stockage indisponible */ }
  }, [code]);
  const displayOnly = () => window.location.replace(`/jukebox/${code}/ecran-beta`); // un autre appareil joue le son
  const takeSound = () => { window.location.href = `/jukebox/${code}/ecran-beta?son=1&claim=1`; };
  const [missing, setMissing] = useState(false);
  const [origin, setOrigin] = useState("");
  // fin d'une partie de blind test : podium affiché 45 s
  const lastBlind = useRef(null);
  const [podium, setPodium] = useState(null);
  useEffect(() => {
    const b = data?.blind;
    const was = lastBlind.current;
    if (was?.on && !b?.on && was.mode === "phone" && was.top?.length) {
      setPodium(was.top);
      setTimeout(() => setPodium(null), 45000);
    }
    lastBlind.current = b || null;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [fullscreen, setFullscreen] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [, tick] = useState(0); // compte à rebours avant de révéler le nom
  const player = useRef(null);
  const playerEl = useRef(null);
  const loaded = useRef(null); // id du titre chargé dans le lecteur
  const nowRef = useRef(null);
  const lastData = useRef(null); // dernier état reçu (version `rev`)
  const sync = useRef(null); // { id, pos, playing, at, localAt }
  const clock = useRef(null); // { offset: heure serveur − heure locale, rtt }
  const progress = useRef(null); // { cur, t } : la vidéo avance-t-elle vraiment ?

  const { act, fresh, refreshRef } = useAdminActions(code, setData);
  // veille : 1 h sans activité (aucun titre joué ou ajouté, aucune action) → relecture lente ;
  // 24 h plus tard, arrêt complet (télé ou ordinateur oublié allumé sur l'écran)
  const { mode: veille, activity } = useVeille({ enabled: !missing });
  useWakeLock(veille === "on");
  // album Clic-Clac lié ; sans album : retour à l'écran habituel (même adresse, mêmes paramètres)
  const linked = data?.session?.photos || null;
  // bandeau : vignette vidéo calée sur la hauteur du cadre QR. Le lecteur garde sa taille
  // minimale (≈ 360 × 202 px, sinon YouTube s'arrête) et n'est que réduit à l'affichage (scale).
  const [qrEl, setQrEl] = useState(null);
  const [band, setBand] = useState(null); // { h: hauteur du cadre QR, w: largeur affichée de la vignette, k: échelle }
  useEffect(() => {
    if (!qrEl) return;
    const measure = () => {
      const vw = Math.max(window.innerWidth * 0.18, 360), vh = (vw * 9) / 16;
      const h = qrEl.offsetHeight || vh, k = Math.min(1, h / vh);
      setBand({ h, w: vw * k, k });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(qrEl);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [qrEl]);
  useEffect(() => {
    if (data && !data.session?.photos) window.location.replace(`/jukebox/${code}/ecran${window.location.search}`);
  }, [data, code]);
  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now();
      // écran sans le son : version déjà reçue (SQL v45) → « rien de neuf » si la soirée n'a pas
      // changé (position de lecture seule renvoyée) ; pas pendant un blind test ni quand l'auteur
      // du titre en cours doit être dévoilé au bout d'un délai
      const last = lastData.current;
      const rev = !sound && last?.rev != null && !last.blind?.on && !last.now?.revealIn ? `&rev=${last.rev}` : "";
      const res = await fetch(`/api/jukebox/${code}?view=ecran${sound ? "&engine=1" : ""}${rev}`, { cache: "no-store", headers: sound ? authHeaders(code) : {} });
      if (res.status === 404) return setMissing(await missingFrom(res));
      if (!res.ok) return;
      let d = await res.json();
      if (d.same) {
        if (!lastData.current) return;
        d = { ...lastData.current, serverTime: d.serverTime, playback: d.playback };
      }
      const t1 = Date.now();
      // Écart d'horloge estimé au milieu de l'aller-retour ; on garde la mesure
      // la plus fiable (aller-retour le plus court), renouvelée de temps en temps.
      const rtt = t1 - t0;
      const c = clock.current;
      if (!c || rtt <= c.rtt * 1.2 || t1 - c.t > 60000) clock.current = { offset: d.serverTime - (t0 + t1) / 2, rtt, t: t1 };
      const pb = d.playback;
      if (!pb) sync.current = null;
      else if (sync.current?.at !== pb.at || !c) // nouvelle position envoyée par la régie
        sync.current = { id: pb.id, pos: pb.pos, playing: pb.playing, at: pb.at, localAt: pb.at - clock.current.offset };
      nowRef.current = d.now;
      d.fetchedAt = Date.now();
      if (sound && !fresh(t0)) return; // action envoyée entre-temps : réponse périmée
      lastData.current = d;
      setData(d);
    } catch (e) { /* réseau : on retentera */ }
  }, [code, sound, fresh]);
  refreshRef.current = refresh;

  // mode son : le moteur voit le titre en cours et la file complets
  const engineData = useMemo(() => (sound && data?.engine
    ? { ...data, now: data.engine.now, queue: data.engine.queue, command: data.engine.command, admin: true } : null), [sound, data]);
  const engine = usePlayerEngine({ code, data: engineData, act, enabled: !!sound && !!data, autoResume: true, single: true, kind: "tv", quiet: veille === "stopped" }); // télé : un seul décodeur vidéo
  // activité : l'état de la soirée change (titre, file, lecture / pause…), ou la musique joue
  const stamp = partyStamp(data);
  useEffect(() => { if (stamp) activity(); }, [stamp, activity]);
  useEffect(() => { if (engine.playing || data?.playback?.playing) activity(); }, [data, engine.playing, activity]);

  // Mode son : lancement automatique ; si le navigateur de la télé bloque le
  // son sans geste (vidéo qui ne démarre pas), on affiche le bouton « Lancer ».
  const [blocked, setBlocked] = useState(false);
  const tapped = useRef(false); // un appui a eu lieu : le son est autorisé pour la page
  // Si un autre appareil (ordinateur) joue déjà le son, la télé passe en
  // affichage seul, sauf si on vient de lui demander de prendre le son (claim).
  useEffect(() => {
    if (!sound || !engine.ready || engine.started) return;
    if (engine.otherOwner && !claim) return displayOnly();
    engine.start();
    if (claim) history.replaceState(null, "", `/jukebox/${code}/ecran-beta?son=1`); // rechargement : reprise normale
  }, [sound, engine.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (engine.yielded) displayOnly(); }, [engine.yielded]); // eslint-disable-line react-hooks/exhaustive-deps
  // affichage seul : la régie ou la télécommande renvoie le son sur la télé
  // (seulement une vraie télé jumelée : pas un onglet « écran » ouvert depuis la régie)
  const handoff = data?.playback?.handoff;
  useEffect(() => {
    if (sound || !canSound || !pairedTv || !handoff || handoff.to !== "tv" || !data?.serverTime) return;
    if (data.serverTime - handoff.at < HANDOFF_MS) takeSound();
  }, [handoff?.at, canSound, pairedTv, sound]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sound || !engine.started) return;
    let since = null;
    const id = setInterval(() => {
      const st = engine.playerState();
      const stuck = !tapped.current && engineData?.now && (st === -1 || st === 5); // jamais démarrée (≠ pause)
      since = stuck ? since ?? Date.now() : null;
      setBlocked(!!since && Date.now() - since > 4000);
    }, 1000);
    return () => clearInterval(id);
  }, [sound, engine.started, !!engineData?.now]); // eslint-disable-line react-hooks/exhaustive-deps
  const unlock = () => { tapped.current = true; setBlocked(false); engine.start(); };

  // Lecteur muet, sans commandes (un calque transparent bloque les clics).
  const hasData = !!data;
  useEffect(() => {
    let cancelled = false;
    if (sound !== false) return; // mode son : lecteurs du moteur
    loadYouTubeApi().then(() => {
      if (cancelled || player.current || !playerEl.current) return;
      player.current = createPlayer(playerEl.current, {
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: { onReady: (e) => { e.target.mute(); setReady(true); } },
      });
    });
    return () => { cancelled = true; };
  }, [hasData, sound]); // le conteneur n'existe qu'une fois les données chargées

  // Recalage sur la position de la régie, en douceur : petit écart → vitesse
  // légèrement modifiée (vidéo muette, invisible) ; saut seulement au-delà de
  // 3 s (chaque saut peut déclencher une pub). Si la vidéo n'avance pas alors
  // qu'elle devrait (pub, mise en mémoire), on ne force rien.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const p = player.current;
      const now = nowRef.current;
      if (!now || now.hidden) { // rien en cours, ou blind test pas encore dévoilé
        if (loaded.current) { p.stopVideo(); loaded.current = null; }
        return;
      }
      const s = sync.current;
      const known = s && s.id === now.id; // la régie a commencé ce titre
      const target = known ? s.pos + (s.playing ? (Date.now() - s.localAt) / 1000 : 0) : 0;
      const shouldPlay = known && s.playing;
      if (loaded.current !== `${now.id}:${now.videoId}`) { // nouveau titre, ou vidéo corrigée
        loaded.current = `${now.id}:${now.videoId}`;
        p.loadVideoById({ videoId: now.videoId, startSeconds: target });
        return;
      }
      const state = p.getPlayerState();
      if (state === 3) return; // chargement en cours
      const cur = p.getCurrentTime();
      const t = Date.now();
      const prev = progress.current;
      progress.current = { cur, t };
      if (!shouldPlay) {
        if (state === 1) p.pauseVideo();
        if (Math.abs(cur - target) > 0.5) p.seekTo(target, true);
        return;
      }
      if (state !== 1) { p.playVideo(); return; }
      const stalled = prev && t - prev.t < 2000 && cur - prev.cur < 0.1;
      if (stalled) return;
      const drift = cur - target; // > 0 : l'écran est en avance
      if (Math.abs(drift) > 3) { p.setPlaybackRate(1); p.seekTo(target, true); }
      else if (Math.abs(drift) > 0.25) p.setPlaybackRate(drift < 0 ? 1.25 : 0.75);
      else if (p.getPlaybackRate() !== 1) p.setPlaybackRate(1);
    }, 500);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (sound === null) return;
    refresh();
  }, [refresh]);
  setScreen("ecran"); // journal de la soirée : actions faites depuis la télé
  // temps réel : relecture à chaque changement ; filet de sécurité 6 s, sinon (canal indisponible,
  // blind test) l'ancienne cadence : 1,5 s en mode son (enchaînements suivis de près), 3 s sinon
  // soirée fermée ou introuvable : plus aucune relecture
  useLive(code, refresh, { ctl: true, enabled: sound !== null && !missing, fast: sound ? 1500 : 3000, slow: data?.blind?.on ? (sound ? 1500 : 3000) : 6000, mode: veille });

  // Bouton bien visible hors plein écran ; en plein écran, il n'apparaît que
  // quelques secondes quand on bouge la souris (pour pouvoir en sortir).
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    let timer;
    const onMove = () => {
      setMouseActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setMouseActive(false), 3000);
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onMove); // télécommande de la télé (flèches, OK)
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onMove);
      clearTimeout(timer);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  if (missing) return <Center>{missing.closed ? `🔒 La soirée ${formatCode(code)} est fermée. Merci et à bientôt !` : `La soirée ${formatCode(code)} n'existe pas (ou plus).`}</Center>;
  if (!data || sound === null) return <Center>Chargement…</Center>;

  const { session, now, queue, total, blind } = data;
  const theme = session.theme;
  const hidden = !!now?.hidden;
  // mode son, blind test : le lecteur enchaîne le titre suivant avant que le
  // serveur ne le déclare masqué → cache dès que le lecteur change de titre
  const covered = hidden || (sound && !!blind?.on && !!engine.currentId && !!now && engine.currentId !== now.id);
  const since = (Date.now() - data.fetchedAt) / 1000;
  const joinUrl = `${origin}/jukebox/${code}`;
  // QR unique : page d'accueil de la soirée (titres ou photos) ; blind test : directement le jeu
  const hubUrl = `${origin}/jukebox/${code}/soiree`;
  const qrUrl = blind?.on ? joinUrl : hubUrl;
  const showQueue = session.screenQueue;
  const bigQr = !showQueue || queue.length === 0; // file vide : QR en grand, pour attirer les premiers titres
  // blind test animé par la régie : rien à faire sur téléphone (ajouts bloqués) → pas de QR, colonne retirée
  const animBlind = !!blind?.on && blind.mode !== "phone";
  const cover = now && !hidden ? `https://i.ytimg.com/vi/${now.videoId}/hqdefault.jpg` : null;
  // mode son : la vidéo reste à sa taille pendant le blind test (un lecteur
  // trop petit s'arrête), masquée par un cache
  const boxShown = sound ? !!now : now && !hidden;
  // disposition (aucune photo pendant un blind test) ; « photos » ou photo en grand : vidéo en vignette
  // Jukebox réduit au bandeau du bas, l'app intégrée (Clic-Clac) au-dessus ; blind test, podium,
  // palmarès : écran Jukebox habituel (aucune photo)
  const layout = blind?.on || podium || session.palmaresShow ? "video" : "photos";
  // « Photos » en son seul : le lecteur garde sa taille (trop petit, YouTube s'arrête), caché sous les photos
  const soundOnly = layout === "photos" && linked?.video === false;
  const mini = boxShown && !covered && layout === "photos";
  const hiddenText = (
    <>
      <p className="text-[9vw] leading-none">🕵️</p>
      <h1 className="mt-[3vh] text-[4.5vw] font-black leading-tight">Quel est ce titre ?</h1>
      <p className="mt-[1.5vh] text-[2vw] text-white/80">
        {blind?.mode === "phone" ? "Répondez sur votre téléphone : artiste, titre… ou les deux !" : "À vous de deviner !"}
      </p>
      {blind?.revealIn != null && (
        <p className="mt-[3vh] text-[5vw] font-black tabular-nums text-[var(--jb-light)]">{Math.max(0, Math.ceil(blind.revealIn - (blind.playing ? since : 0)))}</p>
      )}
    </>
  );

  return (
    <div className="relative h-screen overflow-hidden bg-gray-950 text-white select-none" style={themeVars(theme)}>
      <VeilleOverlay mode={veille} onWake={activity} title="écran en veille" sleepText="Aucune activité depuis 1 h. Touchez l'écran (ou une touche de la télécommande) pour relancer ; un titre ajouté le relance aussi." stopText="Touchez l'écran (ou une touche de la télécommande) pour relancer." />
      {podium && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/90 backdrop-blur">
          <div className="text-center w-[min(60vw,90vh)]">
            <p className="text-[5vw] font-black leading-none">🏁 Partie terminée !</p>
            <div className="mt-[4vh] text-left bg-white/10 rounded-[2vw] p-[3vw]"><Leaderboard top={podium} big /></div>
          </div>
        </div>
      )}
      {session.palmaresShow && data.palmares && !podium && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/90 backdrop-blur">
          <div className="text-center w-[min(80vw,140vh)]">
            <p className="text-[4.5vw] font-black leading-none">🏆 Palmarès de la soirée</p>
            <div className="mt-[4vh] bg-white/10 rounded-[2vw] p-[3vw]"><Palmares p={data.palmares} big /></div>
          </div>
        </div>
      )}
      {cover && (
        <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-40" />
      )}
      <div className="absolute inset-0" style={{ background: "var(--jb-screen-bg)" }} />

      {/* colonnes alignées en haut (nom de la soirée à hauteur du haut de la vidéo), ensemble centré verticalement */}
      <div className="relative h-full flex flex-col justify-center p-[3vw]">
      <div className="flex flex-col lg:flex-row lg:items-start gap-[3vw] min-h-0 max-h-full">
        <main className="flex-1 min-w-0 flex flex-col">
          {/* nom de la soirée : dans la colonne de droite, sauf blind test animé (colonne retirée) */}
          {animBlind && (
          <div className="flex items-center gap-[1.2vw] mb-[1.5vh]">
            {theme?.logo && <img src={`/api/jukebox/${code}/logo?v=${theme.logo}`} alt="" className="h-[7vh] max-w-[14vw] object-contain shrink-0" />}
            <div className="min-w-0">
              <p className="text-[1.4vw] font-bold tracking-[0.2em] uppercase text-white/70 truncate">{theme?.title || session.name}</p>
              {theme?.message && <p className="text-[1.2vw] text-white/70 line-clamp-2">{theme.message}</p>}
            </div>
          </div>
          )}
          {/* toujours monté (sinon le lecteur serait détruit), invisible sans titre */}
          <div className={mini ? `fixed ${soundOnly ? "z-0" : "z-[45]"} aspect-video bg-black rounded-[1vw] overflow-hidden shadow-2xl ring-2 ring-white/20 transition-all duration-700`
            : boxShown ? "relative aspect-video bg-black rounded-[1.5vw] overflow-hidden shadow-2xl transition-all duration-700" : "absolute w-px h-px opacity-0 pointer-events-none overflow-hidden"}
            style={mini ? { left: "1.5vw", bottom: "1.5vh", width: VIG_W, transform: `scale(${band?.k ?? 1})`, transformOrigin: "left bottom" } : boxShown ? { width: "min(100%, calc(74vh * 16 / 9))" } : undefined}>
            {sound ? [0, 1].map((i) => (
              <div key={i} ref={engine.playerEls[i]}
                className={`absolute inset-0 transition-opacity duration-1000 ${i === engine.activeIdx ? "opacity-100 z-10" : "opacity-0"}`} />
            )) : <div ref={playerEl} className="absolute inset-0" />}
            <div className="absolute inset-0 z-20" />
            {sound && covered && (
              <div className="absolute inset-0 z-30 bg-gray-950 flex flex-col items-center justify-center text-center">{hiddenText}</div>
            )}
          </div>
          {layout === "photos" ? null : hidden && !sound ? (
            <div className="text-center py-[4vh]">{hiddenText}</div>
          ) : hidden ? null : now ? (
            <div className="mt-[2vh] space-y-[0.6vh]" style={{ width: "min(100%, calc(74vh * 16 / 9))" }}>
              {/* titre + compteur ❤️ (votes) sur la même ligne, puis interprète · proposé par */}
              <div className="flex items-center gap-[1.5vw]">
                <h1 className="flex-1 min-w-0 text-[2.6vw] font-black leading-tight line-clamp-2">
                  {now.title}{now.year && <span className="ml-[0.8vw] align-middle text-[1.5vw] font-bold text-white/60 bg-white/10 rounded-full px-[0.8vw] py-[0.2vh]">{now.year}</span>}
                </h1>
                {session.votes && !blind?.on && (
                  <div className="shrink-0 flex items-center gap-[0.5vw] bg-white/10 backdrop-blur rounded-full px-[1vw] py-[0.6vh]">
                    <style>{`@keyframes jbPop { 0% { transform: scale(1) } 35% { transform: scale(1.4) } 100% { transform: scale(1) } }`}</style>
                    <span key={now.likes || 0} className="text-[1.7vw] leading-none" style={{ animation: now.likes ? "jbPop .6s ease-out" : undefined }}>{now.likes ? "❤️" : "🤍"}</span>
                    <span className={`font-black leading-none ${now.likes ? "text-[1.7vw] tabular-nums" : "text-[1.1vw] text-white/80"}`}>{now.likes || "Votez !"}</span>
                  </div>
                )}
              </div>
              <p className="text-[1.6vw] text-white/70 truncate">
                {now.channel && <span className="font-semibold text-white/90">{now.channel}</span>}
                {now.author ? (
                  <>{now.channel ? " · " : ""}proposé par <span className="font-bold text-white">{now.author}</span></>
                ) : now.revealIn ? (
                  <>{now.channel ? " · " : ""}🤫 qui l'a choisi ? <span className="font-bold text-white tabular-nums">
                    {Math.max(0, Math.ceil(now.revealIn - (Date.now() - data.fetchedAt) / 1000))} s</span></>
                ) : null}
              </p>
              {now.videoTitle && <p className="text-[1vw] text-white/45 truncate">▶ {now.videoTitle}</p>}
              {now.dedication && <p className="text-[1.6vw] italic text-[var(--jb-light)] line-clamp-2">💌 « {now.dedication} »</p>}
              {blind?.on && blind.mode === "phone" && (
                <p className="text-[1.5vw] text-white/80 line-clamp-2">
                  {blind.found?.length
                    ? <>🎯 Trouvé par {blind.found.map((f) => `${f.name}${f.artist && f.title ? "" : f.artist ? " (artiste)" : " (titre)"}`).join(", ")}</>
                    : "😮 Personne n'a trouvé !"}
                </p>
              )}
            </div>
          ) : (
            <>
              <AppIcon app="jukebox" className="w-[8vw] h-[8vw] shadow-2xl" />
              <h1 className="mt-[2vh] text-[4vw] font-black leading-tight">Le jukebox attend vos titres !</h1>
              <p className="mt-[1vh] text-[1.8vw] text-white/70">Scannez le QR code pour proposer une chanson.</p>
            </>
          )}
        </main>

        {!animBlind && layout === "video" && (
        <aside className={`shrink-0 flex flex-col gap-[3vh] min-h-0 lg:max-h-[94vh] ${showQueue ? "lg:w-[25vw]" : "lg:w-[22vw]"}`}>
          <div className="flex flex-col items-center text-center gap-[1vh]">
            {theme?.logo && <img src={`/api/jukebox/${code}/logo?v=${theme.logo}`} alt="" className="h-[9vh] max-w-full object-contain" />}
            <p className="text-[1.5vw] font-bold tracking-[0.15em] uppercase text-white/80 leading-snug line-clamp-2">{theme?.title || session.name}</p>
            {theme?.message && <p className="text-[1.1vw] text-white/70 line-clamp-3">{theme.message}</p>}
          </div>
          <div className="bg-white/10 backdrop-blur rounded-[1.5vw] p-[1.5vw] flex flex-col items-center text-center">
            {origin && (
              <div className={`bg-white p-[0.8vw] rounded-[1vw] ${bigQr ? "w-[min(19vw,38vh)]" : "w-[min(13vw,24vh)]"}`}>
                <QRCodeSVG value={qrUrl} size={512} style={{ width: "100%", height: "auto" }} fgColor="#0f172a" />
              </div>
            )}
            <p className="mt-[1.5vh] text-[1.4vw] font-bold">{blind?.on && blind.mode === "phone" ? "Jouez au blind test" : "Participez ! Titres et photos"}</p>
            <p className="text-[1.1vw] text-white/70 break-all">{qrUrl.replace(/^https?:\/\//, "")}</p>
            <p className="text-[1.1vw] text-white/70">code <span className="font-mono font-black text-white text-[2vw]">{formatCode(code)}</span></p>
          </div>

          {blind?.on && blind.mode === "phone" ? (
            <div className="flex-1 min-h-0 bg-white/10 backdrop-blur rounded-[1.5vw] p-[1.5vw] overflow-hidden">
              {blind.top?.length ? <Leaderboard top={blind.top} big /> : <p className="text-[1.4vw] text-white/70">🏆 Le classement s'affichera dès les premières bonnes réponses.</p>}
            </div>
          ) : blind?.on ? null : showQueue ? (
            <div className="flex-1 min-h-0 bg-white/10 backdrop-blur rounded-[1.5vw] p-[1.5vw] overflow-hidden">
              <h2 className="text-[1.5vw] font-bold mb-[1.5vh]">À suivre {total > 0 && <span className="text-white/50 font-normal">({total})</span>}</h2>
              {queue.length === 0 ? (
                <p className="text-[1.2vw] text-white/60">La file est vide.</p>
              ) : (
                <ol className="space-y-[1.2vh]">
                  {queue.slice(0, MAX_SHOWN).map((t, i) => (
                    <li key={t.id} className="flex items-center gap-[1vw]">
                      <span className="w-[2vw] text-right text-[1.4vw] font-black text-[var(--jb-light)] shrink-0">{i + 1}</span>
                      {t.thumb && <img src={t.thumb} alt="" className="w-[5vw] aspect-video object-cover rounded-[0.4vw] shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-[1.15vw] font-semibold truncate">{t.title}</p>
                        <p className="text-[0.95vw] text-white/60 truncate">{[t.channel, t.author && `proposé par ${t.author}`].filter(Boolean).join(" · ")}</p>
                        {t.dedication && <p className="text-[0.95vw] text-[var(--jb-light)] italic truncate">💌 « {t.dedication} »</p>}
                      </div>
                    </li>
                  ))}
                  {total > MAX_SHOWN && <li className="text-[1vw] text-white/50 pl-[3vw]">… et {total - MAX_SHOWN} autre{total - MAX_SHOWN > 1 ? "s" : ""}</li>}
                </ol>
              )}
            </div>
          ) : total > 0 && (
            <p className="text-center text-[1.4vw] text-white/70">{total} titre{total > 1 ? "s" : ""} à suivre</p>
          )}
        </aside>
        )}
      </div>
      </div>

      {layout === "photos" && (
        <div className="absolute inset-0 z-[5] bg-gray-950">
          <div className="absolute left-0 right-0 top-0" style={{ bottom: band ? `calc(3vh + ${band.h}px)` : `calc(3vh + ${VIG_H})` }}>
            <LiveFrame album={linked?.album} />
          </div>
          <div className="absolute left-0 right-0 bottom-0 px-[1.5vw] py-[1.5vh] flex items-center gap-[2vw]" style={{ height: band ? `calc(3vh + ${band.h}px)` : `calc(3vh + ${VIG_H})` }}>
            {boxShown && !soundOnly && <div className="shrink-0" style={{ width: band ? band.w : VIG_W }} />}
            <div className="flex-1 min-w-0 pb-[1vh]">
              {now && !hidden ? (
                <>
                  <p className="text-[2.4vw] font-black leading-tight truncate">♪ {now.title}{now.year && <span className="ml-[0.8vw] text-[1.3vw] font-bold text-white/60">{now.year}</span>}</p>
                  <p className="text-[1.4vw] text-white/70 truncate">{[now.channel, now.author && `proposé par ${now.author}`].filter(Boolean).join(" · ")}{queue[0] ? ` · À suivre : ${queue[0].title}` : ""}</p>
                </>
              ) : (
                <>
                  <p className="text-[2vw] font-black leading-tight truncate">{theme?.title || session.name}</p>
                  <p className="text-[1.4vw] text-white/70 truncate">{hidden ? "🕵️ Quel est ce titre ?" : "🎵 Le jukebox attend vos titres ! Scannez le QR code pour proposer une chanson."}</p>
                </>
              )}
            </div>
            <OneQr url={qrUrl} origin={origin} boxRef={setQrEl} />
          </div>
        </div>
      )}

      {sound && (!engine.started || blocked) && (
        <div className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center gap-[3vh] text-center px-6">
          <p className="text-[2vw] text-white/80">🔊 Cette télé joue la musique de la soirée.</p>
          <button autoFocus onClick={unlock} disabled={!engine.ready}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 focus:ring-8 focus:ring-white outline-none disabled:opacity-40 text-white text-[2.5vw] font-bold px-[4vw] py-[2vh] rounded-full">
            {engine.ready ? "▶ Lancer la musique" : "Chargement du lecteur…"}
          </button>
          <p className="text-[1.3vw] text-white/60">Appuyez sur OK avec la télécommande de la télé. Ensuite, tout se pilote depuis la page Organiser du téléphone.</p>
        </div>
      )}

      {!sound && canSound && (
        <button onClick={takeSound}
          className={`absolute z-[60] ${layout === "photos" ? "top-4" : "bottom-4"} left-4 bg-black/50 hover:bg-black/70 focus:bg-fuchsia-600 focus:opacity-100 focus:ring-4 focus:ring-white outline-none backdrop-blur text-white font-bold px-5 py-2.5 rounded-full border border-white/20 transition-opacity duration-500 ${
            !fullscreen || mouseActive ? "opacity-100" : "opacity-0"}`}>
          🔊 {data.playback?.player?.kind === "pc" ? "Le son est sur l'ordinateur · " : ""}Prendre le son ici
        </button>
      )}

      {/* télé jumelée : boutons masqués, réapparaissent quelques secondes à la souris ou à la télécommande */}
      <div className={`absolute z-[60] ${layout === "photos" ? "top-4" : "bottom-4"} right-4 flex gap-2 transition-opacity duration-500 ${
        mouseActive || (!fullscreen && !pairedTv) ? "opacity-100" : "opacity-0 pointer-events-none focus-within:opacity-100"}`}>
      {pairedTv && (
        <a href="/tv" className="bg-black/50 hover:bg-black/70 focus:bg-fuchsia-600 focus:ring-4 focus:ring-white outline-none backdrop-blur text-white font-bold px-5 py-2.5 rounded-full border border-white/20">
          📺 Changer d'affichage
        </a>
      )}
      <button onClick={toggleFullscreen}
        className="bg-black/50 hover:bg-black/70 focus:bg-fuchsia-600 focus:ring-4 focus:ring-white outline-none backdrop-blur text-white font-bold px-5 py-2.5 rounded-full border border-white/20">
        {fullscreen ? "✕ Quitter le plein écran" : "⛶ Plein écran"}
      </button>
      </div>
    </div>
  );
}

function Center({ children }) {
  return <div className="min-h-screen bg-gray-950 text-white/80 flex items-center justify-center text-center px-6">{children}</div>;
}


/* Écran live Clic-Clac intégré tel quel (?embed=1 : sans son QR ni ses commandes) dans
 * l'espace donné : il garde ses dispositions, réglages et évolutions (pilotage depuis la
 * télécommande Clic-Clac). */
/* vignette vidéo du bandeau : la plus petite que YouTube accepte sans s'arrêter (≈ 200 px de haut) */
const VIG_W = "max(18vw, 360px)", VIG_H = "max(10.125vw, 202.5px)";
function LiveFrame({ album }) {
  if (!album) return null;
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <iframe src={`/clic-clac/${album}/live?embed=1`} title="Photos de la soirée" className="absolute inset-0 w-full h-full border-0" allow="autoplay; fullscreen; screen-wake-lock" />
    </div>
  );
}

/* QR unique de la soirée (page d'accueil : proposer un titre ou envoyer une photo),
 * dans un cadre blanc comme sur l'écran live Clic-Clac. */
function OneQr({ url, origin, boxRef }) {
  if (!origin) return null;
  return (
    <div ref={boxRef} className="shrink-0 bg-white text-gray-900 rounded-[1.2vw] shadow-2xl flex items-center gap-[1vw] p-[0.9vw]">
      <div className="w-[max(6.5vw,96px)]"><QRCodeSVG value={url} size={256} style={{ width: "100%", height: "auto" }} fgColor="#0f172a" /></div>
      <div className="text-left pr-[0.5vw]">
        <p className="text-[1.6vw] font-black leading-tight">Participez !</p>
        <p className="mt-[0.6vh] text-[1.3vw] font-semibold text-gray-700 leading-snug">🎵 Titres</p>
        <p className="text-[1.3vw] font-semibold text-gray-700 leading-snug">📸 Photos</p>
      </div>
    </div>
  );
}
