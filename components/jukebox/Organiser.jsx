"use client";
/*
 * Jukebox — page « Organiser » (/jukebox/<code>/organiser), une seule pour le
 * téléphone et l'ordinateur (remplace la régie et la télécommande, dont les
 * adresses y renvoient). Mêmes onglets partout : 🎵 File · ⚙️ Réglages ·
 * (🕵️ Blind) · 📣 Inviter — en bas de l'écran sur téléphone, à droite de la
 * vidéo sur ordinateur.
 * Lecteur : l'appareil peut jouer la musique lui-même (moteur partagé avec
 * l'écran en mode son, usePlayerEngine) — toujours sur ordinateur, sur
 * téléphone seulement si le super-admin l'a permis (fonction « phonePlayer »).
 * Sinon, ou quand un autre appareil joue (télé, autre ordinateur), la page
 * pilote ce lecteur à distance : lecture/pause et volume par `command`, état
 * lu dans `playback`. Un seul lecteur par soirée.
 * Accès : jeton régie (localStorage, #t=… dans l'URL) ou passe #j= du QR.
 */
import { ClosingBanner, ClosedMessage, missingFrom } from "./ClosingNotice";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Play } from "lucide-react";
import { usePlayerEngine } from "./usePlayerEngine";
import { setAdminToken, authHeaders, rememberParty, forgetParty, formatCode, setScreen } from "./storage";
import { useLive } from "./useLive";
import { useVeille, partyStamp, VeilleOverlay } from "./useVeille";
import { useAdminActions } from "./optimistic";
import { useWakeLock } from "./useWakeLock";
import { Settings, QueueList, GuestsSwitch, AddTrack, PlayPauseButton, SkipButton, VolumeSlider, FixVideoButton, VideoPicker, ReportDialog } from "./Controls";
import { formatDuration, playSpan, HANDOFF_MS, PLAYER_ALIVE_MS } from "@/lib/jukebox";
import History from "./History";
import TvLink, { tvBeat } from "./TvLink";
import GuestShare from "./GuestShare";
import { JoinForm, AccessPanel, useJoinPass } from "./Access";
import RoleNav from "./RoleNav";
import { useBackClose } from "./useBackClose";
import { BlindPanel } from "./Blind";
import Participant from "./Participant";
import { PHOTO_LAYOUT_LABELS } from "@/lib/jukeboxPhotos";

/* Mise en page (« wide » : ordinateur, deux colonnes) et nature de l'appareil
 * (« phone » : écran tactile étroit). */
function useDevice() {
  const [d, setD] = useState({ wide: true, phone: false, known: false });
  useEffect(() => {
    const wideQ = window.matchMedia("(min-width: 1024px)");
    const touchQ = window.matchMedia("(pointer: coarse)");
    const upd = () => setD({ wide: wideQ.matches, phone: touchQ.matches && !wideQ.matches, known: true });
    upd();
    wideQ.addEventListener?.("change", upd);
    return () => wideQ.removeEventListener?.("change", upd);
  }, []);
  return d;
}

export default function Organiser({ code }) {
  const router = useRouter();
  const device = useDevice();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [origin, setOrigin] = useState("");
  const [bigQr, setBigQr] = useState(false);
  const [fixing, setFixing] = useState(null); // titre dont on corrige la vidéo
  const [reporting, setReporting] = useState(null); // titre signalé (🚩)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false); // « Connecter une télé »
  const [pcHelp, setPcHelp] = useState(false);
  // « 🎤 Participer » quand cet appareil joue la musique : la page invité s'affiche ici même, par-dessus,
  // sans quitter la page (le lecteur reste chargé : la musique continue)
  const [guestView, setGuestView] = useState(false);
  useBackClose(guestView, () => setGuestView(false));
  const [tab, setTab] = useState("queue"); // onglet (retenu par appareil)
  useEffect(() => { try { const t = localStorage.getItem("jukebox:orgTab"); if (t) setTab(t); } catch (e) { /* ignoré */ } }, []);
  const chooseTab = (t) => { setTab(t); if (!device.wide) window.scrollTo(0, 0); try { localStorage.setItem("jukebox:orgTab", t); } catch (e) { /* ignoré */ } };
  // retour du téléphone : ferme la fenêtre ouverte, ou revient à l'onglet File
  useBackClose(bigQr, () => setBigQr(false));
  useBackClose(historyOpen, () => setHistoryOpen(false));
  useBackClose(tvOpen, () => setTvOpen(false));
  useBackClose(!!reporting, () => setReporting(null));
  useBackClose(!!fixing, () => setFixing(null));
  useBackClose(!device.wide && tab !== "queue", () => setTab("queue"));
  const [pending, setPending] = useState(null); // ordre envoyé à distance, pas encore appliqué : "play" | "pause"
  const [remoteVolume, setRemoteVolume] = useState(null);
  const remoteTimer = useRef(null);
  const mismatchSince = useRef(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const m = window.location.hash.match(/t=([a-f0-9]+)/);
    if (m) {
      setAdminToken(code, m[1]);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setOrigin(window.location.origin);
    const t = setInterval(() => tick((n) => n + 1), 1000); // barre de progression
    return () => clearInterval(t);
  }, [code]);

  const { act, fresh, refreshRef } = useAdminActions(code, setData);
  // veille : 1 h sans activité (aucun titre joué ou ajouté, aucune action) → relecture lente ;
  // 24 h plus tard, arrêt complet (page oubliée ouverte sur un ordinateur, une tablette…)
  const { mode: veille, activity } = useVeille({ enabled: !missing });
  useWakeLock(veille === "on"); // pas de mise en veille de l'écran pendant la soirée (sauf page en veille)
  const refresh = useCallback(async () => {
    const started = Date.now();
    try {
      const res = await fetch(`/api/jukebox/${code}`, { cache: "no-store", headers: authHeaders(code) });
      if (res.status === 404) return setMissing(await missingFrom(res));
      if (res.ok) {
        const d = await res.json();
        if (!fresh(started)) return; // une action a eu lieu entre-temps : réponse périmée
        d.fetchedAt = Date.now();
        setData(d);
        if (d.admin) rememberParty(code, d.session.name); // retrouvée ensuite dans « Mes soirées » de l'accueil
      }
    } catch (e) { /* réseau : on retentera */ }
  }, [code, fresh]);

  // cet appareil peut-il jouer la musique ? ordinateur : oui ; téléphone : si le super-admin l'a permis
  const canPlay = device.known && (!device.phone || !!data?.session?.features?.phonePlayer);
  setScreen(device.phone ? "telecommande" : "regie"); // journal de la soirée : d'où viennent les actions
  useEffect(() => { refresh(); }, [refresh]);
  // temps réel : relecture à chaque changement ; filet de sécurité 6 s (1,5 s sans temps réel ou pendant un blind test)
  // soirée fermée ou introuvable : plus aucune relecture
  useLive(code, refresh, { ctl: true, fast: 1500, slow: data?.blind?.on ? 1500 : 6000, hiddenPause: !canPlay, enabled: !missing, mode: veille });
  refreshRef.current = refresh;
  const passError = useJoinPass(code, refresh); // QR « Ajouter un appareil »

  const engine = usePlayerEngine({ code, data, act, enabled: !!data?.admin && canPlay, kind: "pc", resumeOnShow: device.phone, quiet: veille === "stopped" }); // un téléphone lecteur compte comme un ordinateur
  // activité : l'état de la soirée change (titre, file, lecture / pause…), ou la musique joue
  const stamp = partyStamp(data);
  useEffect(() => { if (stamp) activity(); }, [stamp, activity]);
  useEffect(() => { if (engine.playing || data?.playback?.playing) activity(); }, [data, engine.playing, activity]);
  const { playerEls, activeIdx, ready, started, start, otherOwner, yielded } = engine;
  // « Mettre le son sur la télé » depuis le lecteur de cet appareil
  const [handoffAt, setHandoffAt] = useState(null);
  useEffect(() => { if (!started) setHandoffAt(null); }, [started]);
  useEffect(() => {
    if (!handoffAt || handoffAt < 0) return;
    const t = setTimeout(() => setHandoffAt((h) => (h === handoffAt ? -1 : h)), 25000);
    return () => clearTimeout(t);
  }, [handoffAt]);

  // ordre à distance considéré comme appliqué dès que le lecteur confirme l'état voulu
  useEffect(() => {
    const pb = data?.playback;
    if (pending && pb && data.now && pb.id === data.now.id && pb.playing === (pending === "play")) setPending(null);
  }, [data, pending]);

  const toGuest = (k) => { if (k !== "guest" || !started) return false; setGuestView(true); return true; };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  if (missing) return <Center><ClosedMessage code={code} missing={missing} /></Center>;
  if (!data) return <Center>Chargement…</Center>;
  if (!data.admin) return <Center><JoinForm code={code} name={data.session.name} onJoined={refresh} error={passError} /></Center>;

  const { session, now, queue, playback: pb } = data;
  const open = session.status === "open";
  const joinUrl = `${origin}/jukebox/${code}`;

  // lecteur à distance (télé, autre ordinateur) : état envoyé à chaque changement, signe de vie toutes les 15 à 30 s
  const live = pb && now && pb.id === now.id;
  const age = pb ? data.serverTime - pb.at + (Date.now() - data.fetchedAt) : Infinity;
  if (live || !now) mismatchSince.current = null;
  else if (mismatchSince.current == null) mismatchSince.current = Date.now();
  const lagging = mismatchSince.current != null && Date.now() - mismatchSince.current > 20000;
  const remoteOk = !!pb && age < PLAYER_ALIVE_MS && !lagging;
  const playerSeen = !!pb && age < 2 * PLAYER_ALIVE_MS; // un lecteur a donné signe de vie récemment
  const local = started; // cet appareil joue le son
  const remotePlaying = pending ? pending === "play" : !!(live && pb.playing);
  const remoteVol = remoteVolume ?? pb?.volume ?? 100;
  const span = now ? playSpan(now) : null;
  const pos = live ? Math.max(0, Math.min(span.length || Infinity, pb.pos + (pb.playing ? age / 1000 : 0) - span.start)) : 0;
  const ownerName = (otherOwner?.kind || pb?.player?.kind) === "tv" ? "la télé" : "un autre appareil";

  const remoteToggle = () => {
    const next = remotePlaying ? "pause" : "play";
    setPending(next);
    setTimeout(() => setPending(null), 6000);
    act("command", { type: next }, true);
  };
  const remoteChangeVolume = (v) => {
    setRemoteVolume(v);
    clearTimeout(remoteTimer.current);
    remoteTimer.current = setTimeout(() => { act("command", { type: "volume", value: v }, true); setTimeout(() => setRemoteVolume(null), 4000); }, 300);
  };
  const skip = () => (local ? engine.advance(true) : now && act("next", { from: now.id, skip: true }));
  const playNow = (t) => {
    if (now && !confirm(`Lancer « ${t.title} » maintenant ?\nLe titre en cours sera interrompu.`)) return;
    act("playnow", { id: t.id });
  };
  const takeSound = () => (!playerSeen || confirm(`Faire jouer la musique sur cet appareil ?\n${ownerName === "la télé" ? "La télé" : "L'autre appareil"} s'arrêtera de la jouer.`)) && start();
  const sendToTv = () => { setHandoffAt(Date.now()); act("handoff", { to: "tv" }, true); };
  const controls = local
    ? <><PlayPauseButton playing={engine.playing} onClick={engine.togglePlay} disabled={!now} /><SkipButton onClick={skip} disabled={!now} /></>
    : <><PlayPauseButton playing={remotePlaying} onClick={remoteToggle} disabled={!now} /><SkipButton onClick={skip} disabled={!now} /></>;

  const tabs = [
    { id: "queue", icon: "🎵", label: `File${queue.length ? ` · ${queue.length}` : ""}` },
    { id: "settings", icon: "⚙️", label: "Réglages" },
    ...(session.blindSettings ? [{ id: "blind", icon: "🕵️", label: "Blind", dot: session.blindSettings.on }] : []),
    { id: "invite", icon: "📣", label: "Inviter" },
  ];
  const shown = tabs.some((t) => t.id === tab) ? tab : "queue"; // onglet retiré (blind test coupé)

  /* ---------- Lecteur : vidéo de cet appareil, ou pilotage à distance ---------- */
  const nowInfo = now ? (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-400 uppercase tracking-wider"><Play size={12} fill="currentColor" strokeWidth={0} />En ce moment{now.author ? ` · proposé par ${now.author}` : ""}</p>
      <p className={`${device.wide ? "text-xl" : "text-base"} font-bold leading-snug line-clamp-2`}>{now.title}</p>
      <p className="text-sm text-white/60 truncate">{now.channel} <span className="ml-2"><FixVideoButton onClick={() => setReporting(now)} /></span></p>
      {now.dedication && (
        <p className="text-sm text-fuchsia-300 italic mt-1">
          💌 « {now.dedication} »
          <button onClick={() => confirm("Effacer cette dédicace ?") && act("clearDedication", { id: now.id })}
            className="not-italic -m-2 p-2 text-white/50 hover:text-red-400" aria-label="Effacer la dédicace">✕</button>
        </p>
      )}
    </div>
  ) : <p className="text-white/50">Aucun titre en cours.</p>;

  const player = (
    <section className="space-y-3">
      {canPlay && (
        /* vidéo de cet appareil : toujours montée (les lecteurs YouTube y vivent), voilée tant qu'il ne joue pas */
        <div className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden mx-auto ${!local && !device.wide ? "hidden" : ""}`}
          style={device.wide ? { maxWidth: "max(420px, calc((100vh - 290px) * 16 / 9))" } : undefined}>
          {[0, 1].map((i) => (
            <div key={i} ref={playerEls[i]} className={`absolute inset-0 transition-opacity duration-1000 ${i === activeIdx ? "opacity-100 z-10" : "opacity-0 pointer-events-none"}`} />
          ))}
          {!local && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 text-center px-6">
              {now?.thumb && <img src={now.thumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 -z-10" />}
              {playerSeen ? (
                <>
                  <p className="text-2xl font-bold">🔊 Le son est joué par {ownerName}</p>
                  <p className="text-white/70 text-sm max-w-md">Cette page pilote la soirée à distance.{yielded && " (Le son a été pris par un autre appareil.)"}</p>
                  <button onClick={takeSound} disabled={!ready} className="bg-white/10 hover:bg-white/20 disabled:opacity-40 font-bold px-6 py-3 rounded-full">🔊 Jouer la musique ici</button>
                </>
              ) : (
                <>
                  <p className="text-white/70">{now || queue.length ? `${queue.length + (now ? 1 : 0)} titre${queue.length + (now ? 1 : 0) > 1 ? "s" : ""} dans la file` : "La file est vide pour l'instant : la musique démarrera au premier titre proposé."}</p>
                  <button onClick={start} disabled={!ready} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 text-xl font-bold px-8 py-4 rounded-full">
                    {ready ? <span className="inline-flex items-center gap-2"><Play size={22} fill="currentColor" strokeWidth={0} />{now ? "Reprendre la musique ici" : "Lancer la musique ici"}</span> : "Chargement du lecteur…"}
                  </button>
                  <button onClick={() => setTvOpen(true)} className="text-sm text-white/70 underline">ou 📺 la faire jouer par une télé</button>
                  <p className="text-xs text-white/50 max-w-sm">💡 Gardez cet onglet au premier plan et l'appareil sur secteur : en arrière-plan, le navigateur ralentit la page.</p>
                </>
              )}
            </div>
          )}
          {local && !now && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black text-white/60 text-center px-6 pointer-events-none">En attente du prochain titre… Scannez le QR code pour en proposer un !</div>
          )}
        </div>
      )}

      {/* titre en cours (sur téléphone sans vidéo : avec sa miniature) */}
      <div className="flex gap-3 items-start">
        {!device.wide && !local && now?.thumb && <img src={now.thumb} alt="" className="w-[38%] shrink-0 aspect-video object-cover rounded-2xl shadow-xl" />}
        <div className="flex-1 min-w-0">{nowInfo}</div>
      </div>
      {!local && now && live && (
        <div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-fuchsia-500" style={{ width: `${span.length ? Math.min(100, (pos / span.length) * 100) : 0}%` }} /></div>
          <div className="flex justify-between text-xs text-white/40 mt-1"><span>{formatDuration(Math.floor(pos))}</span><span>{span.trimmed && "✂️ "}{formatDuration(Math.round(span.length))}</span></div>
        </div>
      )}

      {/* aucun lecteur (sur téléphone qui ne joue pas) : comment faire jouer la musique */}
      {!local && !playerSeen && !(canPlay && device.wide) && (
        <div className="bg-fuchsia-500/10 border border-fuchsia-400/30 rounded-2xl p-4 space-y-3">
          <p className="font-bold">🔊 Aucun lecteur pour l'instant</p>
          <p className="text-sm text-white/60">La musique est jouée par une télé ou un ordinateur ; cette page les pilote.</p>
          <button onClick={() => setTvOpen(true)} className="w-full font-bold bg-fuchsia-600 hover:bg-fuchsia-700 rounded-full py-3">📺 Connecter une télé</button>
          {canPlay && <button onClick={start} disabled={!ready} className="w-full font-bold bg-white/10 disabled:opacity-40 rounded-full py-2.5 text-sm">🔊 Jouer la musique sur {device.phone ? "ce téléphone" : "cet appareil"}</button>}
          <button onClick={() => setPcHelp((v) => !v)} className="w-full font-bold bg-white/10 rounded-full py-2 text-sm">💻 Utiliser un ordinateur</button>
          {pcHelp && <p className="text-sm text-white/70">Sur l'ordinateur branché à la sono, ouvrez <b className="text-white break-all">{`${joinUrl}/organiser`.replace(/^https?:\/\//, "")}</b> puis tapez le code organisateur (onglet 📣 Inviter).</p>}
        </div>
      )}
      {!local && playerSeen && now && !remoteOk && (
        <p className="text-sm text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2">⚠️ Le lecteur ne répond pas : vérifiez que l'appareil qui joue la musique (ordinateur ou télé) a toujours la page ouverte.</p>
      )}
      {!local && playerSeen && canPlay && !device.wide && (
        <button onClick={takeSound} disabled={!ready} className="w-full text-sm font-semibold bg-white/10 disabled:opacity-40 rounded-full py-2">🔊 Jouer la musique sur {device.phone ? "ce téléphone" : "cet appareil"}</button>
      )}

      {(local || playerSeen) && (
        <div className="flex items-center gap-3">
          {controls}
          {local
            ? <VolumeSlider value={engine.volume} onChange={engine.changeVolume} className="flex-1 min-w-0 max-w-[12rem] ml-1" />
            : <><VolumeSlider value={remoteVol} onChange={remoteChangeVolume} className="flex-1 min-w-0 max-w-[12rem] ml-1" /><span className="w-7 text-right text-xs text-white/50 tabular-nums">{remoteVol}</span></>}
        </div>
      )}
      {local && device.phone && (
        <p className="text-xs text-white/50">💡 Restez sur le Jukebox (Organiser ou Participer) : si vous passez à une autre application, le téléphone met la musique en pause ; elle repart à votre retour.</p>
      )}
      {/* son sur cet appareil ou sur l'ordinateur : le passer à la télé (jumelée en « Affichage + son ») */}
      {now && (local || (playerSeen && pb?.player?.kind === "pc")) && (
        (local ? handoffAt > 0 : pb?.handoff && data.serverTime - pb.handoff.at < HANDOFF_MS)
          ? <p className="text-xs text-white/50">📺 Envoi du son à la télé…</p>
          : <button onClick={local ? sendToTv : () => act("handoff", { to: "tv" }, true)} className="text-sm font-semibold bg-white/10 hover:bg-white/20 rounded-full px-4 py-2">📺 Mettre le son sur la télé</button>
      )}
      {local && handoffAt === -1 && (
        <p className="text-xs text-amber-300" onClick={() => setHandoffAt(null)}>Aucune télé n'a repris le son. Elle doit ouvrir l'écran d'affichage et avoir été jumelée en « 🔊 Affichage + son » (📺 Connecter une télé). ✕</p>
      )}
    </section>
  );

  /* ---------- Onglets ---------- */
  const queueTab = (
    <div className="space-y-4">
      <AddTrack code={code} queue={queue} now={now} onAdded={refresh} catalogOnly={session.features?.search === false} />
      <QueueList code={code} queue={queue} act={act} playNow={playNow} onFixVideo={setReporting} catalogOnly={session.features?.search === false} />
      {session.features.history && (
        <button onClick={() => setHistoryOpen(true)} className="w-full font-bold bg-white/10 hover:bg-white/20 rounded-full py-2.5 text-sm">🕘 Historique de la soirée</button>
      )}
      {/* BETA écran commun avec Clic-Clac : page de commande dans un nouvel onglet (cette page, qui peut jouer la musique, reste ouverte) */}
      <a href={`/jukebox/${code}/photos`} target="_blank" rel="noopener"
        className="block w-full text-center font-bold bg-white/10 hover:bg-white/20 rounded-full py-2.5 text-sm">
        📸 Photos sur l'écran (beta){session.photos ? ` · ${PHOTO_LAYOUT_LABELS[session.photos.layout] || ""}` : ""}
      </a>
    </div>
  );
  const settingsTab = <section className="bg-white/5 rounded-2xl p-4 space-y-3 text-sm"><Settings session={session} act={act} /></section>;
  const blindTab = session.blindSettings && <BlindPanel settings={session.blindSettings} blind={data.blind} now={now} act={act} controls={controls} />;
  const inviteTab = (
    <div className="space-y-4 text-sm">
      <GuestShare code={code} name={session.name} endsAt={session.endsAt} onQr={() => setBigQr(true)} onTv={() => setTvOpen(true)} />
      <AccessPanel code={code} name={session.name} />
      <button onClick={() => confirm("Vider la file et arrêter le titre en cours ?") && act("reset")} className="w-full font-bold bg-white/10 hover:bg-white/20 rounded-full py-2">🧹 Vider la file</button>
      <div className="pt-3 border-t border-red-500/30">
        <button onClick={async () => {
          if (!confirm("Supprimer définitivement cette soirée ?\n\nLa file, l'historique et les réglages seront perdus.")) return;
          if (await act("delete")) { forgetParty(code); router.push("/jukebox"); }
        }} className="w-full font-bold text-red-300 border border-red-500/40 hover:bg-red-500/15 rounded-full py-2">🗑️ Supprimer la soirée</button>
      </div>
    </div>
  );
  const tabContent = { queue: queueTab, settings: settingsTab, blind: blindTab, invite: inviteTab }[shown];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <VeilleOverlay mode={veille} onWake={activity} title="page en veille" sleepText="Aucune activité depuis 1 h. Touchez l'écran pour relancer (un titre ajouté la relance aussi)." />
      <ClosingBanner endsAt={session.endsAt} />
      <header className={`${device.wide ? "" : "sticky top-0 z-30 bg-gray-950/95 backdrop-blur"} border-b border-white/10 px-4 ${device.wide ? "sm:px-6 py-3" : "py-2.5"}`}>
        <div className={`flex items-center gap-3 ${device.wide ? "" : "max-w-md mx-auto"}`}>
          {device.wide && <Link href="/jukebox" className="text-white/60 hover:text-white text-sm">← Jukebox</Link>}
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-lg truncate leading-tight">{session.name}</h1>
            <p className="text-[11px] text-white/40">
              🎛️ Organiser · code <span className="font-mono">{formatCode(code)}</span>
              {!local && playerSeen && pb.player && <> · <span className="text-white/70">🔊 son sur {pb.player.kind === "tv" ? "la télé" : "un autre appareil"}</span></>}
              {local && <> · <span className="text-white/70">🔊 son sur cet appareil</span></>}
            </p>
          </div>
          {device.wide && <RoleNav code={code} current="organiser" className="w-72" onNavigate={toGuest} />}
          <GuestsSwitch open={open} act={act} />
          {device.wide && <button onClick={toggleFullscreen} className="text-sm text-white/70 hover:text-white">⛶ Plein écran</button>}
        </div>
        {!device.wide && <RoleNav code={code} current="organiser" className="max-w-md mx-auto mt-2" onNavigate={toGuest} />}
      </header>

      {device.wide ? (
        <div className={guestView ? "h-0 overflow-hidden" : "grid gap-6 p-4 sm:p-6 grid-cols-[1fr_400px]"}>
          <main className="min-w-0">{player}</main>
          <aside className={`space-y-4 min-w-0 ${guestView ? "hidden" : ""}`}>
            <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
              {origin && (
                <button onClick={() => setBigQr(true)} className="bg-white p-1 rounded-lg shrink-0" aria-label="Agrandir le QR code"><QRCodeSVG value={joinUrl} size={64} fgColor="#0f172a" /></button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/60">Proposez vos titres :</p>
                <p className="font-bold text-sm break-all">{joinUrl.replace(/^https?:\/\//, "")}</p>
                <p className="text-xs text-white/60">code <span className="font-mono font-bold text-white text-base">{formatCode(code)}</span></p>
              </div>
            </div>
            <div className="flex bg-white/5 rounded-full p-1 text-sm">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => chooseTab(t.id)}
                  className={`relative flex-1 px-2 py-1.5 rounded-full font-bold whitespace-nowrap ${shown === t.id ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}>
                  {t.icon} {t.label}
                  {t.dot && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-green-400" />}
                </button>
              ))}
            </div>
            {tabContent}
          </aside>
        </div>
      ) : (
        <main className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-5">
          {/* le lecteur reste monté sur tous les onglets (la musique continue) ; visible dans l'onglet File */}
          <div className={shown === "queue" && !guestView ? "" : local ? "h-0 overflow-hidden" : "hidden"}>{player}</div>
          {guestView ? null : tabContent}
        </main>
      )}
      {guestView && <div className="fixed inset-0 z-40 overflow-y-auto"><Participant code={code} onOrganiser={() => setGuestView(false)} /></div>}

      {!device.wide && !guestView && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto flex">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => chooseTab(t.id)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${shown === t.id ? "text-fuchsia-300" : "text-white/50"}`}>
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
                {t.dot && <span className="absolute top-2 right-[30%] w-2 h-2 rounded-full bg-green-400" />}
                {shown === t.id && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-fuchsia-400" />}
              </button>
            ))}
          </div>
        </nav>
      )}

      {fixing && <VideoPicker code={code} track={fixing} onClose={() => setFixing(null)} onDone={refresh} mute={local} />}
      {reporting && <ReportDialog code={code} track={reporting} onClose={() => setReporting(null)} catalogOnly={session.features?.search === false}
        onFix={session.features?.search === false ? null : (t) => { setReporting(null); setFixing(t); }} />}
      {tvOpen && <TvLink code={code} defaultSound={local ? false : undefined} beat={tvBeat(data?.playback)} onClose={() => setTvOpen(false)} />}
      {historyOpen && <History code={code} name={session.name} onClose={() => setHistoryOpen(false)} onChanged={refresh} />}
      {bigQr && (
        <div onClick={() => setBigQr(false)} className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 p-6 cursor-pointer text-center">
          <div className="bg-white p-5 rounded-3xl"><QRCodeSVG value={joinUrl} size={device.wide ? 360 : 260} /></div>
          <p className="text-2xl font-bold break-all">{joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="text-white/60">code <span className="font-mono font-bold text-white text-3xl">{formatCode(code)}</span></p>
        </div>
      )}
    </div>
  );
}

function Center({ children }) {
  return <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center text-center px-6">{children}</div>;
}
