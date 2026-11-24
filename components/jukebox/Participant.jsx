"use client";
/*
 * Jukebox — page invité (ouverte via QR code ou code à 6 chiffres) : prénom,
 * recherche (ou lien YouTube collé), ajout à la file, suivi de la file en
 * direct et retrait de ses propres titres. Sur l'appareil de la régie (jeton
 * présent), les ajouts ne sont pas limités.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, User } from "lucide-react";
import { participantId, getName, setName, authHeaders, formatCode, getGuestMode, setGuestMode, hasRegieAccess, forgetParty, getAdminToken, artistHintVisible, artistHintSeen, artistHintDone } from "./storage";
import { useLive } from "./useLive";
import { useVeille, VeilleOverlay } from "./useVeille";
import RoleNav from "./RoleNav";
import { useBackClose } from "./useBackClose";
import { useJoinPass } from "./Access";
import { MAX_AUTHOR_LEN, MAX_DEDICATION_LEN, UNLIMITED_CAP, formatDuration, themeVars, parseVideoId } from "@/lib/jukebox";
import { MAX_ANSWER_LEN, MAX_ATTEMPTS, DECADES, decadeLabel } from "@/lib/jukeboxBlind";
import { FrFlag } from "./FrFlag";
import { Leaderboard } from "./Blind";
import { Palmares } from "./Palmares";
import { useWakeLock } from "./useWakeLock";
import { backdropClose } from "@/lib/backdrop";
import { NoClipTag, ProposeClip } from "./ProposeClip";
import SoutenirLink from "@/components/SoutenirLink";
import AppIcon from "@/components/AppIcon";

const ARTISTS_PAGE = 60; // vue « Artistes » du catalogue : affichés par blocs

/* onOrganiser : page invité affichée par-dessus la page Organiser qui joue la musique (retour sans la quitter). */
export default function Participant({ code, onOrganiser }) {
  const [data, setData] = useState(undefined); // undefined = chargement, null = introuvable
  const dataRef = useRef(undefined); // dernier état reçu (version `rev`)
  dataRef.current = data;
  const [closed, setClosed] = useState(false); // soirée fermée (durée d'utilisation passée)
  const [name, setNameState] = useState("");
  const [prevName, setPrevName] = useState(""); // prénom en cours de changement (bouton Annuler)
  const [nameDraft, setNameDraft] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [restricted, setRestricted] = useState(null); // titres hors catalogue non ajoutables : "off" (option) | "quota" (réserve)
  // catalogue des titres vérifiés (option de la soirée) : filtres en cours, page suivante disponible
  // null : recherche normale ; { decades: [], lang, sort, q, view: "songs" | "artists" }
  const [browse, setBrowse] = useState(null);
  const [browseMore, setBrowseMore] = useState(false);
  const [artists, setArtists] = useState(null); // vue « Artistes » : [{ name, count }]
  const [artistsShown, setArtistsShown] = useState(ARTISTS_PAGE);
  const searchCard = useRef(null);
  const lastBrowse = useRef(null);
  const catSeq = useRef(0);
  const searchSeq = useRef(0);
  // catalogue : mêmes filtres que la dernière fois, sur ce téléphone (au hasard : nouveau tirage)
  const openCatalog = () => {
    let f = lastBrowse.current;
    if (!f) try { f = JSON.parse(sessionStorage.getItem(`jukebox:browse:${code}`) || "null"); } catch (e) { /* stockage indisponible */ }
    setResults(null);
    setQ("");
    loadCatalog(f?.decades ? { ...f, q: "" } : { decades: [], lang: "", sort: "random", q: "", view: "songs" }); // filtres gardés, texte vidé
  };
  const typeFilter = (v) => {
    const f = { ...browse, q: v };
    if (f.view === "artists") { setBrowse(f); lastBrowse.current = f; return; } // liste déjà sur le téléphone : filtrée sur place
    if (v) setBrowse(f); // titres : relus à la validation (OK), pas pendant la frappe
    else loadCatalog(f); // ✕ : tout le catalogue
  };
  const loadCatalog = async (f, append = false) => {
    // aléatoire : un tirage par ouverture ou par changement de filtre (graine), stable pour « voir plus »
    if (f.sort === "random" && (!append || !f.seed)) f = { ...f, seed: String(Math.floor(Math.random() * 1e9)) };
    lastBrowse.current = f; // filtres repris à la prochaine ouverture du catalogue
    try { sessionStorage.setItem(`jukebox:browse:${code}`, JSON.stringify(f)); } catch (e) { /* stockage indisponible */ }
    setBrowse(f);
    setSearching(true);
    setError("");
    const seq = ++catSeq.current; // frappe dynamique : seule la dernière réponse compte
    try {
      const qs = new URLSearchParams({ decade: f.decades.join(","), lang: f.lang, sort: f.sort, seed: f.seed || "", q: f.view === "artists" ? "" : f.q, offset: append ? String(results?.length || 0) : "0" });
      if (f.view === "artists") qs.set("view", "artists");
      const res = await fetch(`/api/jukebox/${code}/catalog?${qs}`, { cache: "no-store" });
      const d = await res.json();
      if (seq !== catSeq.current) return;
      if (!res.ok) throw new Error(d.error || "Catalogue indisponible.");
      if (f.view === "artists") {
        setArtists(d.artists || []);
        setArtistsShown(ARTISTS_PAGE);
        setResults(null);
        setBrowseMore(false);
        return;
      }
      setArtists(null);
      setResults((cur) => (append ? [...(cur || []), ...d.results] : d.results));
      setBrowseMore(!!d.more);
    } catch (err) {
      setError(err.message);
    } finally { setSearching(false); }
  };
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [toastError, setToastError] = useState(""); // ajout refusé : bandeau en bas de l'écran
  const [dedication, setDedication] = useState("");
  const [picked, setPicked] = useState(null); // titre choisi, en attente de sa dédicace
  const [answer, setAnswer] = useState(""); // blind test
  const [verdict, setVerdict] = useState(null); // { ok, text }
  const [sending, setSending] = useState(false);
  const pid = useRef(null);
  useWakeLock(!!data?.blind?.on); // blind test : le téléphone reste allumé pour répondre

  // appareil de la régie : peut participer comme un invité (accès régie non envoyés)
  const [guestMode, setGuestModeState] = useState(false);
  const guestRef = useRef(false);
  useEffect(() => { guestRef.current = getGuestMode(code); setGuestModeState(guestRef.current); }, [code]);
  const access = () => (guestRef.current ? {} : authHeaders(code));
  const headers = () => ({ "Content-Type": "application/json", ...access() });

  const lastAct = useRef(0); // réponse partie avant une action : périmée
  const blindRef = useRef(null); // dernier état du blind test (fin de partie, cadence)
  const [final, setFinal] = useState(null); // classement final d'une partie qui vient de se terminer
  const refresh = useCallback(async () => {
    const started = Date.now();
    try {
      // version déjà reçue (SQL v45) : « rien de neuf » si la soirée n'a pas changé ; pas pendant
      // un blind test ni quand l'auteur du titre en cours doit être dévoilé au bout d'un délai
      const last = dataRef.current;
      const rev = last?.rev != null && !last.blind?.on && !last.now?.revealIn ? `&rev=${last.rev}` : "";
      const res = await fetch(`/api/jukebox/${code}?view=guest&pid=${pid.current}${rev}`, { cache: "no-store", headers: headers() });
      if (res.status === 404) { setClosed(!!(await res.json().catch(() => ({}))).closed); return setData(null); }
      if (res.ok) {
        let d = await res.json();
        if (d.same) {
          if (!dataRef.current || started <= lastAct.current) return;
          const prev = dataRef.current;
          d = { ...prev, serverTime: d.serverTime, playback: d.playback, session: { ...prev.session, ...(d.guestLimited !== undefined ? { guestLimited: d.guestLimited } : {}) } };
        }
        if (started > lastAct.current) {
          // fin de partie : on garde le classement final à afficher
          if (blindRef.current?.on && !d.blind?.on && blindRef.current.mode === "phone" && blindRef.current.top?.length) setFinal(blindRef.current);
          blindRef.current = d.blind || null;
          setData(d);
        }
      }
    } catch (e) { /* réseau : on retentera */ }
  }, [code]);
  // QR « Ajouter un téléphone » (régie / télécommande) vers Participer : #j=<passe> → accès régie
  const passError = useJoinPass(code, () => { setGuestMode(code, false); guestRef.current = false; setGuestModeState(false); refresh(); });

  useEffect(() => {
    pid.current = participantId();
    setNameState(getName());
    refresh();
  }, [code, refresh]);
  // temps réel : relecture à chaque changement de la file ; filet de sécurité 15 s (4,5 s sans
  // temps réel) ; toutes les 1,5 s pendant un blind test (compte à rebours, « trop tard »)
  const blindOn = !!data?.blind?.on;
  // pause après 1 h sans toucher la page (téléphone posé, onglet oublié) : plus aucune
  // relecture ; un toucher ou le retour sur la page relance. Blind test en cours : éveillé.
  // Soirée fermée ou introuvable (data null) : plus aucune relecture.
  const { mode: veille, activity } = useVeille({ stopAfter: 0, visibleWakes: true, enabled: data !== null });
  useEffect(() => { if (blindOn) activity(); }, [data, blindOn, activity]);
  useLive(code, refresh, { fast: blindOn ? 1500 : 4500, slow: blindOn ? 1500 : 15000, hiddenPause: true, enabled: data !== null, mode: veille });

  const saveName = (e) => {
    e.preventDefault();
    const n = nameDraft.replace(/\s+/g, " ").trim().slice(0, MAX_AUTHOR_LEN);
    if (!n) return;
    setName(n);
    setNameState(n);
    setPrevName("");
  };

  // recherche limitée au catalogue (soirée limitée, option invités coupée, réserve de quota) : le champ
  // cherche strictement dans le catalogue (même liste que 📚, filtres compris) ; un lien YouTube collé reste une recherche
  const isLimited = () => {
    const se = data?.session;
    if (!se) return false;
    return se.features?.search === false || (!data.admin && (!!se.guestLimited || !!restricted || !se.guestSearch));
  };
  const catalogSearch = (term) => {
    setResults(null);
    if (browse?.view === "artists") { const f = { ...browse, q: term }; setBrowse(f); lastBrowse.current = f; return; } // filtrés sur place
    const base = browse || lastBrowse.current || { decades: [], lang: "", sort: "random", view: "songs" };
    loadCatalog({ ...base, view: "songs", q: term.trim() });
  };
  const search = (e) => {
    e.preventDefault();
    if (isLimited() && !parseVideoId(q)) catalogSearch(q);
    else runSearch(q);
  };
  // pas de recherche pendant la frappe (limite de recherches par adresse : tout le wifi
  // d'une soirée la partage) ; champ vidé : plus de résultats
  const typeSearch = (v) => {
    setQ(v);
    if (!v.trim()) {
      searchSeq.current++; setResults(null); setSearching(false);
      if (browse && browse.q) catalogSearch(""); // recherche dans le catalogue vidée : tout le catalogue
    }
  };
  const runSearch = async (term) => {
    setBrowse(null); // recherche libre : on quitte le catalogue
    setArtists(null);
    if (term.trim().length < 2) return;
    const seq = ++searchSeq.current; // seule la dernière recherche lancée s'affiche
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/jukebox/${code}/search?q=${encodeURIComponent(term.trim())}`, { cache: "no-store", headers: access() });
      const d = await res.json();
      if (seq !== searchSeq.current) return;
      setResults(d.results || []);
      setRestricted(d.restricted || null);
      if (d.error) setError(d.error);
    } catch (err) {
      if (seq === searchSeq.current) setError("Recherche impossible.");
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  /* Toucher un interprète (résultats, catalogue, en ce moment, file) : fenêtre
   * « Autres titres de… » (ses titres vérifiés, sans les filtres du
   * catalogue) ; sans catalogue, une recherche à son nom. */
  const [artistPop, setArtistPop] = useState(null); // { name, list: null (chargement) | [...], error }
  // astuce « touchez un nom d'artiste » : décidée au chargement, comptée une fois par visite quand elle s'affiche
  const [artistHint, setArtistHint] = useState(false);
  const hintCounted = useRef(false);
  useEffect(() => { setArtistHint(artistHintVisible()); }, []);
  const openArtist = async (name) => {
    if (!name) return;
    if (artistHint) { artistHintDone(); setArtistHint(false); }
    if (!data?.session?.catalog) { searchArtist(name); return; }
    setArtistPop({ name, list: null });
    try {
      const res = await fetch(`/api/jukebox/${code}/catalog?${new URLSearchParams({ artist: name, sort: "plays" })}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Catalogue indisponible.");
      setArtistPop((cur) => (cur?.name === name ? { name, list: d.results || [] } : cur));
    } catch (err) {
      setArtistPop((cur) => (cur?.name === name ? { name, list: [], error: err.message } : cur));
    }
  };
  // bouton retour du téléphone : ferme la fenêtre au lieu de quitter la page
  // retour du téléphone : ferme la fenêtre ou le catalogue ouvert plutôt que de quitter la page
  useBackClose(!!artistPop, () => setArtistPop(null));
  useBackClose(!!browse, () => { setBrowse(null); setResults(null); setArtists(null); });
  useBackClose(!!picked, () => setPicked(null));
  const closeArtist = () => setArtistPop(null);
  const searchArtist = (name) => {
    if (artistPop) closeArtist();
    setQ(name);
    runSearch(name);
    searchCard.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const artistTap = !(blindOn && !data?.admin); // blind test : pas de recherche côté invité

  const add = async (v) => {
    setAdding(v.id);
    setError("");
    try {
      const res = await fetch(`/api/jukebox/${code}`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ participantId: pid.current, author: name, dedication, ...(v.deezerId ? { deezerId: v.deezerId } : { videoId: v.id }) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ajout impossible.");
      setFlash(`✓ « ${v.title} » ajouté${d.ahead > 0 ? ` · ${d.ahead} titre${d.ahead > 1 ? "s" : ""} avant le vôtre` : d.ahead === 0 ? " · c'est le prochain !" : " à la file !"}`);
      setTimeout(() => setFlash(""), 3500);
      if (artistPop) closeArtist();
      else if (!browse) { setResults(null); setArtists(null); } // catalogue : reste ouvert (la ligne passe à « Déjà dans la file »)
      setDedication("");
      setPicked(null);
      setQ("");
      refresh();
    } catch (err) {
      setToastError(err.message); // bien visible, même au fond d'une longue liste
      setTimeout(() => setToastError((m) => (m === err.message ? "" : m)), 6000);
    } finally {
      setAdding("");
    }
  };

  const sendAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/jukebox/${code}/answer`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ participantId: pid.current, author: name, answer }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Réponse non enregistrée.");
      const found = [d.newArtist && "l'artiste", d.newTitle && "le titre"].filter(Boolean);
      setVerdict(found.length
        ? { ok: true, text: `🎯 Bravo, vous avez trouvé ${found.join(" et ")} ! +${d.gained} pts` }
        : { ok: false, text: `Raté… ${d.attemptsLeft > 0 ? `encore ${d.attemptsLeft} essai${d.attemptsLeft > 1 ? "s" : ""}` : "plus d'essai pour ce titre"}` });
      setAnswer("");
      refresh();
    } catch (err) {
      setVerdict({ ok: false, text: err.message });
    } finally {
      setSending(false);
    }
  };

  // nouveau titre : on efface le verdict du précédent
  const nowId = data?.now?.id;
  useEffect(() => { setVerdict(null); setAnswer(""); }, [nowId]); // et la réponse en cours de frappe

  // soirée clip : lien du clip proposé pour un de ses titres (version paroles faute de clip validé)
  const [clipFor, setClipFor] = useState(null);
  useBackClose(!!clipFor, () => setClipFor(null)); // retour du téléphone : referme « Proposer le clip »
  const [clipNote, setClipNote] = useState("");
  const sendClip = async (link) => {
    const res = await fetch(`/api/jukebox/${code}`, {
      method: "PATCH", headers: headers(),
      body: JSON.stringify({ participantId: pid.current, id: clipFor.id, link }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Proposition impossible.";
    lastAct.current = Date.now();
    refresh();
    return null;
  };

  const withdraw = async (t) => {
    if (!confirm(`Retirer « ${t.title} » de la file ?`)) return;
    lastAct.current = Date.now();
    setData((d) => ({ ...d, queue: d.queue.filter((x) => x.id !== t.id), total: Math.max(0, d.total - 1), pending: Math.max(0, d.pending - 1) })); // retiré tout de suite
    await fetch(`/api/jukebox/${code}`, {
      method: "DELETE", headers: headers(),
      body: JSON.stringify({ participantId: pid.current, id: t.id }),
    }).catch(() => {});
    lastAct.current = Date.now();
    refresh();
  };

  // ❤️ « J'aime » sur le titre en cours (option de la régie) : affiché tout de suite, corrigé par la réponse
  const [voting, setVoting] = useState(false);
  const toggleLike = async (t) => {
    if (voting) return;
    const like = !t.liked;
    const patch = (v) => setData((d) => (d?.now?.id === t.id ? { ...d, now: { ...d.now, ...v } } : d));
    patch({ liked: like, likes: Math.max(0, (t.likes || 0) + (like ? 1 : -1)) });
    setVoting(true);
    lastAct.current = Date.now();
    try {
      const res = await fetch(`/api/jukebox/${code}/vote`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ participantId: pid.current, id: t.id, like }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Vote non enregistré.");
      patch({ liked: d.liked, likes: d.likes });
    } catch (err) {
      patch({ liked: t.liked, likes: t.likes });
      setError(err.message);
    } finally {
      setVoting(false);
    }
  };

  // « ⏭ Passer mon titre » : l'invité arrête SON titre en cours (2 appuis : demande puis confirmation)
  const [skipAsk, setSkipAsk] = useState(null); // id du titre dont on demande la confirmation
  const [skipping, setSkipping] = useState(false);
  useEffect(() => { setSkipAsk(null); }, [nowId]);
  const skipMine = async (t) => {
    if (skipping) return;
    setSkipping(true);
    try {
      const res = await fetch(`/api/jukebox/${code}/skip`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ participantId: pid.current, id: t.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Impossible de passer le titre.");
      setSkipAsk(null);
      lastAct.current = Date.now();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSkipping(false);
    }
  };

  if (data === undefined) return <Shell><p className="text-center text-white/80">Chargement…</p></Shell>;
  if (data === null) {
    return (
      <Shell>
        <div className="bg-white rounded-3xl p-8 text-center shadow-xl">
          <p className="text-4xl mb-3">🤔</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{closed ? "Soirée fermée" : "Soirée introuvable"}</h1>
          <p className="text-gray-500 mb-6">{closed ? "Cette soirée est terminée : on ne peut plus proposer de titres. Merci d'avoir participé !" : `Le code ${formatCode(code)} ne correspond à aucune soirée.`}</p>
          {closed && <Link href={`/jukebox/${code}/playlist`} className="block mb-3 bg-[var(--jb-accent)] text-white font-bold px-6 py-3 rounded-full">🎵 Revoir les titres de la soirée</Link>}
          <Link href="/jukebox" className={`inline-block font-bold px-6 py-3 rounded-full ${closed ? "text-gray-500 underline" : "bg-[var(--jb-accent)] text-white"}`}>Saisir un autre code</Link>
          {closed && <SoutenirLink className="mt-6" />}
        </div>
      </Shell>
    );
  }

  const { session, now, queue, total, pending, admin } = data;
  const open = session.status === "open";
  const limit = session.maxPerParticipant || UNLIMITED_CAP;
  const full = !admin && pending >= limit;
  const songKey = (t) => `${String(t.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()}|${String(t.channel || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()}`;
  const inQueue = new Set([now?.videoId, ...queue.map((t) => t.videoId), ...[now, ...queue].filter(Boolean).map(songKey)]);
  const isQueued = (v) => inQueue.has(v.id) || inQueue.has(songKey(v)); // résultats Deezer : même titre + artiste
  const blocked = !open && !admin; // ajouts bloqués : on peut chercher, pas ajouter
  /* Un titre proposé (résultats, catalogue, « Autres titres de… ») : bouton Ajouter. */
  const songRow = (v, linkArtist) => (
    <li className="flex items-center gap-3 py-2.5">
      {v.thumb && <img src={v.thumb} alt="" className="w-20 h-[45px] object-cover rounded-lg shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{v.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {linkArtist && v.deezerId && artistTap ? <ArtistLink name={v.channel} onOpen={openArtist} icon /> : v.channel} · {v.year ? `${v.year} · ` : ""}{formatDuration(v.duration)}
        </p>
        {/* repères sur leur propre ligne : jamais coupés par un nom d'artiste trop long */}
        {(v.known === 2 || (v.playedAt && !isQueued(v)) || (v.noClip && session.searchMode === "clip")) && (
          <p className="text-[11px] font-semibold flex flex-wrap gap-x-2">
            {admin && v.known === 2 ? <span className="text-gray-500" title="Titre validé : la bonne vidéo, passe tout de suite">⚡ validé</span>
              : v.known === 2 ? <span className="text-green-700" title="Titre validé : la bonne vidéo, passe tout de suite">✓ validé</span> : null}
            {v.noClip && session.searchMode === "clip" && <NoClipTag className="text-gray-500" />}
          {v.playedAt && !isQueued(v) ? <span className="text-amber-700">🔁 déjà passé à {new Date(v.playedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span> : null}
          </p>
        )}
      </div>
      {isQueued(v) ? (
        <span className="text-xs text-gray-400 shrink-0">Déjà dans la file</span>
      ) : (
        <button onClick={() => (session.dedications ? setPicked(v) : add(v))} disabled={!!adding || blocked || full}
          title={blocked ? "Ajouts bloqués pour le moment" : full ? "Attendez qu'un de vos titres passe" : undefined}
          className="shrink-0 bg-[var(--jb-accent2)] hover:brightness-110 disabled:opacity-40 text-white text-sm font-bold px-3.5 py-2 rounded-full">
          {adding === v.id ? "…" : "+ Ajouter"}
        </button>
      )}
    </li>
  );


  const theme = session.theme;
  // recherche limitée au catalogue (option « Recherche libre » coupée ou réserve de quota) : le catalogue passe au-dessus de la recherche
  const catOnly = session.features?.search === false; // limitée au catalogue par le super-admin : régie comprise, sans lien
  const limited = isLimited();
  const catalogBtn = session.catalog && !browse && (
    <button onClick={openCatalog}
      className={`${limited ? "mb-3" : "mt-3"} w-full text-left flex items-center gap-3 text-white bg-[var(--jb-accent)] hover:brightness-110 rounded-2xl px-4 py-3 shadow-sm`}>
      <span className="text-2xl">📚</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold">Choisir dans le catalogue</span>
        <span className="block text-xs text-white/85">{session.searchMode === "clip" ? "Clips validés" : session.searchMode === "karaoke" ? "Versions karaoké validées" : "Titres validés"}, par année, langue ou artiste</span>
      </span>
      <span className="text-xl">›</span>
    </button>
  );
  return (
    <Shell theme={theme}>
      <VeilleOverlay mode={veille} onWake={activity} title="en pause" stopTitle="En pause" stopText="Page en pause après 1 h sans activité. Touchez pour reprendre." />
      <div ref={searchCard} className="bg-white rounded-3xl p-6 shadow-xl scroll-mt-4">
        {theme?.logo && <img src={`/api/jukebox/${code}/logo?v=${theme.logo}`} alt="" className="max-h-24 max-w-[70%] object-contain mx-auto mb-4" />}
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><AppIcon app="jukebox" className="w-5 h-5" /> Jukebox · {formatCode(code)}</p>
          {name && !admin && (
            <button onClick={() => { setPrevName(name); setNameDraft(name); setNameState(""); }} title="Changer de prénom"
              className="flex items-center gap-1 text-sm font-bold text-[var(--jb-accent)] bg-[var(--jb-soft)] rounded-full pl-2.5 pr-2 py-1 max-w-[55%]">
              <span aria-hidden>👤</span><span className="truncate">{name}</span><span aria-hidden className="opacity-70">✎</span>
            </button>
          )}
        </div>
        <h1 className={`text-2xl font-extrabold text-gray-900 leading-tight ${theme?.message ? "mb-1" : "mb-5"}`}>{theme?.title || session.name}</h1>
        {theme?.message && <p className="text-gray-600 whitespace-pre-line mb-5">{theme.message}</p>}

        {hasRegieAccess(code) && ( /* appareil de l'organisateur : passer d'un de ses écrans à l'autre */
          <div className="mb-3 space-y-1">
            <RoleNav code={code} current="guest" dark={false} onNavigate={(k) => { if (k !== "organiser" || !onOrganiser) return false; setGuestMode(code, false); onOrganiser(); return true; }} />
            {guestMode && <p className="text-xs font-semibold text-gray-500 px-1">👤 Vue invité</p>}
          </div>
        )}
        {passError && <p className="mb-3 text-sm text-red-600">{passError}</p>}
        {final && !data.blind?.on && (
          <div className="mb-5 rounded-2xl bg-[var(--jb-soft)] p-4 text-center space-y-2">
            <p className="text-xl font-black text-gray-900">🏁 Partie terminée !</p>
            {final.me?.points > 0
              ? <p className="text-gray-700">{name || "Vous"} : <b>{final.me.points} pts</b>{final.me.rank ? ` · ${final.me.rank}${final.me.rank === 1 ? "er" : "e"}` : ""} {final.me.rank === 1 ? "🏆" : ""}</p>
              : <p className="text-gray-600 text-sm">Merci d'avoir joué !</p>}
            <div className="text-left bg-white rounded-xl p-3"><Leaderboard top={final.top} light /></div>
            <button onClick={() => setFinal(null)} className="text-sm text-gray-500 underline">Fermer</button>
          </div>
        )}
        {!name && !admin ? (
          <form onSubmit={saveName} className="space-y-3">
            <p className="text-gray-600">Votre prénom, pour que l'on sache qui a mis ce titre :</p>
            <input autoFocus maxLength={MAX_AUTHOR_LEN} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Prénom" autoComplete="given-name" enterKeyHint="done"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-4 py-3 focus:border-[var(--jb-accent)] outline-none" />
            <button disabled={!nameDraft.trim()}
              className="w-full bg-[var(--jb-accent)] hover:brightness-110 disabled:opacity-40 text-white font-bold py-3 rounded-full">
              {prevName ? "Enregistrer" : "C'est parti"}
            </button>
            {prevName && (
              <button type="button" onClick={() => { setNameState(prevName); setPrevName(""); }} className="w-full text-sm text-gray-500 underline">Annuler</button>
            )}
          </form>
        ) : data.blind?.on && !admin ? (
          <BlindGuest blind={data.blind} now={now} name={name} answer={answer} setAnswer={setAnswer}
            onSubmit={sendAnswer} sending={sending} verdict={verdict} />
        ) : (
          <>
            {blocked && <p className="text-center bg-gray-100 text-gray-600 rounded-2xl py-3 px-3 font-medium mb-3">🔒 Les ajouts de titres sont bloqués pour le moment. Vous pouvez déjà chercher votre prochain titre.</p>}
            {!blocked && full && (
              <p className="text-center bg-amber-50 text-amber-800 rounded-2xl py-3 px-3 font-medium mb-3">
                ⏳ Vous avez {pending} titre{pending > 1 ? "s" : ""} en attente. Vous pourrez en proposer un autre dès qu'il{pending > 1 ? "s" : ""} passe{pending > 1 ? "nt" : ""}.
              </p>
            )}
            {session.searchMode === "clip" && (
              <p className="text-sm font-semibold text-[var(--jb-accent)] bg-[var(--jb-soft)] rounded-xl px-3 py-2 mb-3">
                🎬 Soirée clips : les titres passent avec leur clip officiel.
              </p>
            )}
            {session.searchMode === "karaoke" && (
              <p className="text-sm font-semibold text-[var(--jb-accent)] bg-[var(--jb-soft)] rounded-xl px-3 py-2 mb-3">
                🎤 Soirée karaoké : la recherche propose en priorité les versions karaoké.
              </p>
            )}
            {limited && catalogBtn}
            <form onSubmit={search} className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input value={q} onChange={(e) => typeSearch(e.target.value)} maxLength={300} enterKeyHint="search"
                  placeholder={catOnly ? "Chercher dans le catalogue…" : limited ? "Chercher dans le catalogue… ou lien YouTube" : "Artiste, titre… ou lien YouTube"} autoComplete="off"
                  className="w-full text-lg border-2 border-gray-200 rounded-2xl pl-4 pr-10 py-3 focus:border-[var(--jb-accent)] outline-none" />
                {q && <ClearBtn onClick={() => typeSearch("")} />}
              </div>
              <button disabled={searching || (q.trim().length < 2 && !(limited && browse?.q))}
                className="shrink-0 bg-[var(--jb-accent)] hover:brightness-110 disabled:opacity-40 text-white font-bold px-5 rounded-2xl">
                {searching ? "…" : "🔍"}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2 px-1">
              {admin ? "Organisateur : ajouts illimités." : `${session.maxPerParticipant ? `${limit - pending} titre${limit - pending > 1 ? "s" : ""} possible${limit - pending > 1 ? "s" : ""}` : "titres illimités"}`}
            </p>
            {!limited && catalogBtn}
            {browse && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">📚 Catalogue · titres validés</p>
                  <button onClick={() => { setBrowse(null); setResults(null); setArtists(null); }} className="text-sm text-gray-500 underline">Fermer</button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 font-semibold text-gray-500">Voir</span>
                  <Segmented value={browse.view} onChange={(v) => loadCatalog({ ...browse, view: v, q: "" })}
                    options={[["songs", "🎵 Titres"], ["artists", "👤 Artistes"]]} />
                </div>
                {/* filtres : toutes les options visibles, l'option active en couleur */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 pt-2 font-semibold text-gray-500">Années</span>
                    <div className="flex flex-wrap gap-1">
                      {/* plusieurs décennies possibles ; « Toutes » remet à zéro */}
                      {["", ...DECADES.map(String)].map((d) => {
                        const on = d ? browse.decades.includes(d) : !browse.decades.length;
                        const next = !d ? [] : on ? browse.decades.filter((x) => x !== d) : [...browse.decades, d];
                        return (
                          <button key={d || "all"} onClick={() => loadCatalog({ ...browse, decades: next })} aria-pressed={on}
                            className={`text-[13px] font-bold px-3 py-1.5 rounded-full ${on ? "bg-[var(--jb-accent)] text-white" : "bg-gray-100 text-gray-600"}`}>
                            {d ? `${on ? "✓ " : ""}${decadeLabel(Number(d))}` : "Toutes"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 font-semibold text-gray-500">Langue</span>
                    <Segmented value={browse.lang} onChange={(l) => loadCatalog({ ...browse, lang: l })}
                      options={[["", "Toutes"], ["fr", <><FrFlag /> Français</>], ["intl", "🌍 Étranger"]]} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 font-semibold text-gray-500">Ordre</span>
                    <Segmented value={browse.sort} onChange={(o) => loadCatalog({ ...browse, sort: o })}
                      onAgain={(o) => o === "random" && loadCatalog({ ...browse })} // re-toucher « Au hasard » : nouveau tirage
                      options={[["random", browse.sort === "random" ? "🎲 Remélanger" : "🎲 Au hasard"], ["plays", "🔥 Populaires"], ["alpha", "A → Z"]]} />
                  </div>
                </div>
                {!limited && <form onSubmit={(e) => { e.preventDefault(); if (browse.view !== "artists") loadCatalog({ ...browse }); e.currentTarget.elements.cq?.blur(); }} className="relative flex gap-1.5">
                  <div className="relative flex-1 min-w-0">
                  {/* interprètes filtrés pendant la frappe (sur place) ; titres relus à la validation */}
                  <input name="cq" value={browse.q} onChange={(e) => typeFilter(e.target.value)} placeholder={browse.view === "artists" ? "Filtrer : nom d'artiste…" : "Filtrer : artiste, titre…"} autoComplete="off" enterKeyHint="search"
                    className="w-full text-base border-2 border-gray-200 rounded-xl pl-3 pr-9 py-2 focus:border-[var(--jb-accent)] outline-none" />
                  {browse.q && <ClearBtn small onClick={() => typeFilter("")} />}
                  </div>
                  {browse.view !== "artists" && <button className="shrink-0 font-bold bg-[var(--jb-accent)] text-white px-4 rounded-xl">🔍</button>}
                </form>}
              </div>
            )}
            {browse?.view === "artists" && artists && (() => {
              // filtre du nom (côté téléphone : la liste est déjà là)
              const f = browse.q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const list = f ? artists.filter((a) => a.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(f)) : artists;
              return (
                <div className="mt-4">
                  {list.length === 0 ? (
                    <p className="py-4 text-center text-gray-500 text-sm">{searching ? "Chargement…" : "Aucun artiste avec ces filtres."}</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {list.slice(0, artistsShown).map((a) => (
                        <li key={a.name}>
                          <button onClick={() => openArtist(a.name)}
                            className="w-full flex items-center gap-3 py-2.5 text-left">
                            <span className="flex-1 min-w-0 font-semibold text-gray-900 text-sm truncate">{a.name}</span>
                            <span className="shrink-0 text-xs text-gray-500">{a.count} titre{a.count > 1 ? "s" : ""} ›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {list.length > artistsShown && (
                    <button onClick={() => setArtistsShown((n) => n + ARTISTS_PAGE)}
                      className="mt-2 w-full text-sm font-bold text-gray-600 bg-gray-100 rounded-2xl py-2.5">Voir plus ({list.length - artistsShown})</button>
                  )}
                </div>
              );
            })()}
            {artistHint && artistTap && results?.some((v) => v.deezerId) && (
              <p ref={() => { if (!hintCounted.current) { hintCounted.current = true; artistHintSeen(); } }}
                className="mt-3 text-xs text-gray-500 bg-[var(--jb-soft)] rounded-xl px-3 py-2">💡 Touchez un nom d'artiste pour voir ses autres titres.</p>
            )}
            {results && (
              <ul className={`mt-4 divide-y divide-gray-100 transition-opacity ${searching && browse ? "opacity-40" : ""}`}>
                {results.length === 0 && !error && (
                  browse ? (
                    <li className="py-4 text-center text-gray-500 text-sm">{searching ? "Chargement…" : browse.decades.length || browse.lang || browse.q ? `Aucun titre validé avec ces filtres : essayez une autre année ou langue${limited ? "" : ", ou la recherche ci-dessus"}${limited && !catOnly ? ", ou collez un lien YouTube" : ""}.` : `Aucun titre validé${session.searchMode === "karaoke" ? " en version karaoké" : ""} pour l'instant${limited ? "" : " : utilisez la recherche ci-dessus"}.`}</li>
                  ) : (
                  <li className="py-4 text-center text-gray-500 text-sm space-y-1">
                    <p className="font-semibold text-gray-700">{restricted && (catOnly || !admin) ? "Pas dans le catalogue de la soirée." : "Aucun résultat."}</p>
                    <p>Essayez seulement l'artiste ou seulement le titre, vérifiez l'orthographe{session.catalog && restricted && (catOnly || !admin) ? <>, <button onClick={openCatalog} className="font-bold text-[var(--jb-accent)] underline">📚 parcourez le catalogue</button></> : ""}{catOnly ? "." : ", ou collez un lien YouTube."}</p>
                  </li>
                  )
                )}
                {results.map((v, k) => (
                  <Fragment key={v.id}>
                  {/* titres vérifiés (en tête) : intitulé, puis séparation avec les autres */}
                  {!admin && k === 0 && v.known === 2 && results.some((x) => x.known !== 2) && (
                    <li className="pt-1 pb-1.5 text-xs font-semibold text-green-700">✓ Titres validés</li>
                  )}
                  {!admin && k > 0 && v.known !== 2 && results[k - 1].known === 2 && (
                    <li className="pt-3 pb-1.5 text-xs font-semibold text-gray-500 border-t-2 border-gray-200">Autres résultats</li>
                  )}
                  {songRow(v, true)}
                  </Fragment>
                ))}
              </ul>
            )}
            {/* fin du catalogue : le dire, surtout quand il est petit (soirée karaoké : seules les versions karaoké vérifiées) */}
            {browse && !browseMore && !searching && results?.length > 0 && (
              <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                {results.length} titre{results.length > 1 ? "s" : ""} validé{results.length > 1 ? "s" : ""}{session.searchMode === "karaoke" ? " en version karaoké" : session.searchMode === "clip" ? " avec un clip" : ""}{browse.decades.length || browse.lang || browse.q ? " avec ces filtres" : ""} pour l'instant.
                {catOnly ? "" : limited ? " Pas trouvé votre bonheur ? Collez le lien YouTube du titre dans la recherche." : <>{" "}Pas trouvé votre bonheur ? Utilisez la recherche ci-dessus{session.searchMode === "karaoke" ? " : elle trouve aussi les autres versions karaoké" : ""}.</>}
              </p>
            )}
            {browse && browseMore && results?.length > 0 && (
              <button onClick={() => loadCatalog(browse, true)} disabled={searching}
                className="mt-2 w-full text-sm font-bold text-gray-600 bg-gray-100 rounded-2xl py-2.5 disabled:opacity-50">{searching ? "…" : "Voir plus"}</button>
            )}
          </>
        )}

        {error && <p className="mt-4 text-center text-red-600 text-sm">{error}</p>}
      </div>
      {/* confirmation / refus d'ajout : en bas de l'écran, visible où qu'on soit dans la liste */}
      {(flash || toastError) && (
        <div className="fixed inset-x-4 bottom-4 z-[60] flex justify-center pointer-events-none">
          <p role="status" onClick={() => setToastError("")}
            className={`pointer-events-auto max-w-md w-full text-center text-sm font-semibold rounded-2xl px-4 py-3 shadow-2xl ${toastError ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
            {toastError || flash}
          </p>
        </div>
      )}

      <div className="mt-5 bg-white/95 rounded-3xl p-6 shadow-xl">
        {clipNote && <p className="mb-3 text-sm text-center text-green-700 font-semibold bg-green-50 rounded-xl px-3 py-2">{clipNote}</p>}
        {now?.hidden ? (
          <p className="text-sm text-gray-500 mb-4">🤫 Titre mystère en cours…</p>
        ) : now ? (
          <>
          <div className="flex items-center gap-3 mb-4">
            {now.thumb && <img src={now.thumb} alt="" className="w-24 h-[54px] object-cover rounded-lg shrink-0" />}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--jb-accent)] uppercase tracking-wider"><Play size={12} fill="currentColor" strokeWidth={0} />En ce moment</p>
              <p className="font-bold text-gray-900 leading-snug line-clamp-2">{now.title}</p>
              {now.channel && <p className="text-sm text-gray-600 truncate">{artistTap ? <ArtistLink name={now.channel} onOpen={openArtist} /> : now.channel}</p>}
              {now.mine || now.author ? (
                <p className="text-xs text-gray-500">proposé par {now.mine ? "vous" : now.author}</p>
              ) : now.revealIn ? (
                <p className="text-xs text-gray-500">🤫 Qui l'a choisi ? Réponse dans quelques instants…</p>
              ) : null}
              {now.dedication && <p className="text-sm text-[var(--jb-accent)] italic mt-0.5">💌 « {now.dedication} »</p>}
              {session.votes && !data.blind?.on && (now.mine ? (
                now.likes > 0 && <p className="mt-1 text-xs font-semibold text-rose-600">❤️ {now.likes} invité{now.likes > 1 ? "s aiment" : " aime"} votre titre !</p>
              ) : (
                <button onClick={() => toggleLike(now)} disabled={voting} aria-pressed={!!now.liked}
                  className={`mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold rounded-full px-3.5 py-1.5 border-2 transition ${now.liked ? "bg-rose-500 border-rose-500 text-white" : "border-rose-300 text-rose-600 hover:bg-rose-50"}`}>
                  {now.liked ? "❤️" : "🤍"} J'aime{now.likes > 0 ? <span className="tabular-nums font-semibold opacity-80">· {now.likes}</span> : null}
                </button>
              ))}
            </div>
          </div>
            {now.mine && !data.blind?.on && (skipAsk === now.id ? (
              <div className="-mt-2 mb-4 flex flex-wrap items-center justify-center gap-2 bg-gray-900 text-white rounded-2xl px-3 py-2 text-sm shadow">
                <span className="font-semibold">Arrêter votre titre maintenant ?</span>
                <button onClick={() => skipMine(now)} disabled={skipping}
                  className="font-bold bg-[var(--jb-accent)] hover:brightness-110 rounded-full px-3 py-1 disabled:opacity-50">{skipping ? "…" : "Oui, au suivant"}</button>
                <button onClick={() => setSkipAsk(null)} className="font-semibold bg-white/15 hover:bg-white/25 rounded-full px-3 py-1">Non</button>
              </div>
            ) : (
              <button onClick={() => setSkipAsk(now.id)}
                className="-mt-2 mb-4 w-full text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-full px-4 py-2 shadow">⏭ Couper mon titre et passer au suivant</button>
            ))}
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-4">La musique n'a pas encore commencé.</p>
        )}
        {!session.guestQueue && !admin ? (
          <>
            <h2 className="font-bold text-gray-900 mb-1">Vos titres</h2>
            <p className="text-xs text-gray-400 mb-2">{total} titre{total > 1 ? "s" : ""} dans la file</p>
            {queue.length === 0 ? (
              <p className="text-sm text-gray-500">Vous n'avez aucun titre en attente.</p>
            ) : (
              <ul className="space-y-2">
                {queue.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 bg-[var(--jb-soft)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                      {t.channel && <p className="text-xs text-gray-500 truncate">{artistTap ? <ArtistLink name={t.channel} onOpen={openArtist} /> : t.channel}</p>}
                      {t.noClip && <ClipLine t={t} onPropose={catOnly ? null : setClipFor} />}
                      <p className="text-xs font-semibold text-[var(--jb-accent)]">
                        {t.ahead === 0 ? "🔜 C'est le prochain !" : `${t.ahead} titre${t.ahead > 1 ? "s" : ""} avant le vôtre`}
                      </p>
                    </div>
                    <button onClick={() => withdraw(t)} className="shrink-0 -my-2 -mr-2 p-2.5 text-lg leading-none text-gray-500 hover:text-red-500" aria-label="Retirer">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (<>
        <h2 className="font-bold text-gray-900 mb-2">À suivre {queue.length > 0 && <span className="text-gray-400 font-normal">({queue.length})</span>}</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-500">{data.blind?.on ? "Surprise… 🤫" : "La file est vide : proposez un titre !"}</p>
        ) : (
          <ol className="space-y-2">
            {queue.map((t, i) => (
              <li key={t.id} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${t.mine ? "bg-[var(--jb-soft)]" : ""}`}>
                <span className="w-5 text-right text-sm font-bold text-gray-400 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.channel && (artistTap ? <ArtistLink name={t.channel} onOpen={openArtist} /> : t.channel)}
                    {t.channel && (t.mine || t.author) ? " · " : ""}{(t.mine || t.author) && `par ${t.mine ? "vous" : t.author}`}
                  </p>
                  {t.dedication && <p className="text-xs text-[var(--jb-accent)] italic truncate">💌 « {t.dedication} »</p>}
                  {t.noClip && <ClipLine t={t} onPropose={t.mine && !catOnly ? setClipFor : null} />}
                </div>
                {t.mine && <button onClick={() => withdraw(t)} className="shrink-0 -my-2 -mr-2 p-2.5 text-lg leading-none text-gray-500 hover:text-red-500" aria-label="Retirer">✕</button>}
              </li>
            ))}
          </ol>
        )}
        </>)}
      </div>
      {/* appareil de l'organisateur : passer en invité, revenir en régie, se déconnecter (sous la file, hors du chemin des invités) */}
      {hasRegieAccess(code) && (
        <div className="mt-5 bg-white/95 rounded-3xl p-4 shadow-xl text-center">
            {admin && hasRegieAccess(code) && (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1.5">
                <p>📱 Ce téléphone est connecté comme <b>organisateur</b> : pas de prénom ni de limite d'ajouts.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setGuestMode(code, true); guestRef.current = true; setGuestModeState(true); refresh(); }}
                    className="font-bold text-white bg-[var(--jb-accent)] px-3 py-1.5 rounded-full">Participer comme invité</button>
                  {getAdminToken(code) && <button onClick={() => {
                    if (!confirm("Déconnecter ce téléphone ?\n\nPour retrouver les commandes, il faudra le code organisateur. Les autres appareils ne sont pas touchés.")) return;
                    forgetParty(code); setGuestMode(code, false); guestRef.current = false; setGuestModeState(false); refresh();
                  }} className="font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full">Se déconnecter</button>}
                </div>
              </div>
            )}
            {!admin && guestMode && hasRegieAccess(code) && (
              <button onClick={() => { setGuestMode(code, false); guestRef.current = false; setGuestModeState(false); refresh(); }}
                className="text-xs text-gray-500 underline">↩ Revenir en mode organisateur sur ce téléphone</button>
            )}

        </div>
      )}
      {clipFor && (
        <ProposeClip track={clipFor} send={sendClip} onClose={(done) => {
          if (done) { setClipNote(`🎬 Merci ! Le clip de « ${clipFor.title} » passera à la place de la version paroles.`); setTimeout(() => setClipNote(""), 4000); }
          setClipFor(null);
        }} />
      )}
      {artistPop && (
        /* « Autres titres de… » : par-dessus la page, qui reste telle quelle */
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3" {...backdropClose(() => !adding && closeArtist())}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-2xl">
            <div className="flex items-center gap-2 px-5 pt-5 pb-2">
              <p className="flex-1 min-w-0 font-bold text-gray-900 leading-snug">👤 Autres titres de <span className="text-[var(--jb-accent)]">{artistPop.name}</span></p>
              <button onClick={closeArtist} className="shrink-0 text-gray-400 hover:text-gray-700 text-xl leading-none px-1" aria-label="Fermer">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5">
              {!artistPop.list ? (
                <p className="py-6 text-center text-gray-500 text-sm">Chargement…</p>
              ) : artistPop.list.length === 0 ? (
                <p className="py-4 text-center text-gray-500 text-sm">{artistPop.error || `Aucun titre validé de ${artistPop.name}${session.searchMode === "karaoke" ? " en version karaoké" : ""} pour l'instant.`}</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">{artistPop.list.length} titre{artistPop.list.length > 1 ? "s" : ""} validé{artistPop.list.length > 1 ? "s" : ""}{session.searchMode === "karaoke" ? " en version karaoké" : ""}</p>
                  <ul className="divide-y divide-gray-100">
                    {artistPop.list.map((v) => <Fragment key={v.id}>{songRow(v, false)}</Fragment>)}
                  </ul>
                </>
              )}
              {error && artistPop.list && <p className="pb-2 text-center text-red-600 text-sm">{error}</p>}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => searchArtist(artistPop.name)}
                className="w-full text-sm font-bold text-[var(--jb-accent)] bg-[var(--jb-soft)] rounded-2xl py-2.5">
                🔍 Chercher d'autres titres de {artistPop.name}
              </button>
            </div>
          </div>
        </div>
      )}
      {picked && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3" {...backdropClose(() => !adding && setPicked(null))}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); add(picked); }}
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              {picked.thumb && <img src={picked.thumb} alt="" className="w-20 h-[45px] object-cover rounded-lg shrink-0" />}
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{picked.title}</p>
                <p className="text-xs text-gray-500 truncate">{picked.channel} · {formatDuration(picked.duration)}</p>
              </div>
            </div>
            <div>
              <textarea rows={2} value={dedication} onChange={(e) => setDedication(e.target.value)} maxLength={MAX_DEDICATION_LEN}
                placeholder="💌 Une dédicace ? (facultatif)"
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 focus:border-[var(--jb-accent)] outline-none resize-none" />
              <p className="text-xs text-gray-400 text-right">{dedication.length}/{MAX_DEDICATION_LEN}</p>
            </div>
            {toastError && <p className="text-center text-red-600 text-sm">{toastError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPicked(null)} disabled={!!adding}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-full">Annuler</button>
              <button disabled={!!adding} className="flex-[2] bg-[var(--jb-accent2)] hover:brightness-110 disabled:opacity-40 text-white font-bold py-3 rounded-full">
                {adding ? "Ajout…" : "Ajouter à la file"}
              </button>
            </div>
          </form>
        </div>
      )}
      {session.votes && data.palmares && !data.blind?.on && (
        <div className="mt-5 bg-white/95 rounded-3xl p-6 shadow-xl">
          <h2 className="font-bold text-gray-900 mb-3">🏆 Palmarès de la soirée</h2>
          <Palmares p={data.palmares} />
        </div>
      )}
      {!data.blind?.on && (
        <p className="mt-5 text-center"><Link href={`/jukebox/${code}/playlist`} className="text-sm font-semibold text-white/80 hover:text-white underline">🎵 Les titres déjà passés</Link></p>
      )}
    </Shell>
  );
}

/* Blind test, côté invité : saisie de la réponse (mode téléphone), points,
 * classement. */
function BlindGuest({ blind, now, name, answer, setAnswer, onSubmit, sending, verdict }) {
  const phone = blind.mode === "phone";
  const round = blind.me?.round;
  const done = round?.artist && round?.title;
  return (
    <div className="space-y-4">
      <p className="text-center font-bold text-[var(--jb-accent)] bg-[var(--jb-soft)] rounded-2xl py-3">🕵️ Blind test en cours !</p>
      {!now ? (
        <p className="text-center text-gray-500">Le prochain titre arrive…</p>
      ) : now.hidden ? (
        <>
        {blind.revealIn != null && <p className="text-center text-sm font-semibold text-gray-600">⏱️ Réponse dans <b className="tabular-nums text-gray-900">{blind.revealIn} s</b>{blind.playing === false ? " (en pause)" : ""}</p>}
        {phone ? (
          done ? (
            <p className="text-center text-green-600 font-semibold">🎯 Artiste et titre trouvés ! Attendez la réponse…</p>
          ) : (round?.attempts || 0) >= MAX_ATTEMPTS ? (
            <p className="text-center text-gray-500">Plus d'essai pour ce titre… Réponse bientôt sur l'écran !</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-2">
              <p className="text-gray-600 text-sm">
                Artiste, titre… ou les deux ! {round?.artist ? "✓ Artiste trouvé, il reste le titre." : round?.title ? "✓ Titre trouvé, il reste l'artiste." : ""}
              </p>
              <div className="flex gap-2">
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={MAX_ANSWER_LEN} autoComplete="off" enterKeyHint="send"
                  placeholder="Votre réponse" className="flex-1 min-w-0 text-lg border-2 border-gray-200 rounded-2xl px-4 py-3 focus:border-[var(--jb-accent)] outline-none" />
                <button disabled={sending || !answer.trim()} className="shrink-0 bg-[var(--jb-accent)] hover:brightness-110 disabled:opacity-40 text-white font-bold px-5 rounded-2xl">
                  {sending ? "…" : "OK"}
                </button>
              </div>
            </form>
          )
        ) : (
          <p className="text-center text-gray-600">À vous de deviner ! La réponse arrive sur l'écran.</p>
        )}
        </>
      ) : (
        <p className="text-center text-gray-600">
          C'était <b>{now.title}</b>{now.channel ? <> — {now.channel}</> : null}
          {phone && round && (round.artist || round.title) ? <span className="block text-green-600 font-semibold mt-1">+{round.points} pts pour vous !</span> : null}
        </p>
      )}
      {verdict && <p className={`text-center text-sm font-semibold ${verdict.ok ? "text-green-600" : "text-gray-500"}`}>{verdict.text}</p>}
      {phone && (
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-sm text-gray-600 mb-2">
            {name} : <b className="text-gray-900">{blind.me?.points || 0} pts</b>{blind.me?.rank ? ` · ${blind.me.rank}${blind.me.rank === 1 ? "er" : "e"}` : ""}
          </p>
          <Leaderboard top={blind.top} light />
        </div>
      )}
    </div>
  );
}

function Shell({ theme, children }) {
  return (
    <div className="min-h-screen px-4 py-8" style={{ ...themeVars(theme), background: "var(--jb-guest-bg)" }}>
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}

/* Soirée clip : titre de la file qui passe sa version paroles (pas de clip
 * validé) ; onPropose : « 🎬 Proposer le clip » (ses propres titres). */
function ClipLine({ t, onPropose }) {
  return (
    <p className="text-[11px] font-semibold text-gray-500 flex flex-wrap items-center gap-x-2">
      <NoClipTag />
      {onPropose && <button onClick={() => onPropose(t)} className="text-[var(--jb-accent)] underline">🎬 Proposer le clip</button>}
    </p>
  );
}

/* Nom d'interprète à toucher : ses autres titres (catalogue ou recherche). */
function ArtistLink({ name, onOpen, icon }) {
  return (
    <button type="button" onClick={() => onOpen(name)} title={`Autres titres de ${name}`}
      className="underline decoration-dotted decoration-gray-300 underline-offset-2 hover:text-[var(--jb-accent)]">
      {icon && <User aria-hidden size={12} strokeWidth={2.5} className="inline-block align-[-1px] mr-1 text-[var(--jb-accent)]" />}{name}
    </button>
  );
}

/* Choix exclusif en boutons côte à côte (filtres du catalogue invités). */
/* ✕ dans un champ de recherche : le vide. */
function ClearBtn({ onClick, small }) {
  return (
    <button type="button" onClick={onClick} aria-label="Effacer"
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold ${small ? "w-6 h-6 text-xs" : "w-7 h-7 text-sm"}`}>✕</button>
  );
}

function Segmented({ value, onChange, options, onAgain }) {
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-0.5">
      {options.map(([v, label]) => (
        <button key={v || "all"} onClick={() => (v !== value ? onChange(v) : onAgain?.(v))}
          className={`text-[13px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap ${v === value ? "bg-[var(--jb-accent)] text-white shadow-sm" : "text-gray-600"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
