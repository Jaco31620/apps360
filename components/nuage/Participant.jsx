"use client";
/*
 * Nuage de mots — page participant (ouverte via QR code ou code à 6 chiffres).
 * Envoi de mots jusqu'à la limite fixée par le présentateur ; possibilité de
 * suivre le nuage en direct une fois ses mots envoyés.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import WordCloud from "./WordCloud";
import { participantId, formatCode } from "./storage";
import { MAX_WORD_LEN } from "@/lib/nuage";
import { resolveTheme } from "@/lib/nuageThemes";
import SoutenirLink from "@/components/SoutenirLink";
import AppIcon from "@/components/AppIcon";

export default function Participant({ code }) {
  const [session, setSession] = useState(undefined); // undefined = chargement, null = introuvable
  const [sent, setSent] = useState(0);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [showCloud, setShowCloud] = useState(false);
  const [words, setWords] = useState([]);
  const pid = useRef(null);
  const input = useRef(null);

  // Relectures : la session seule (« lite », la même pour tous → cache partagé),
  // ou le nuage s'il est affiché (seulement s'il a changé : version « rev »).
  // Les envois du participant ne sont recomptés que si des mots ont été supprimés
  // (delRev) ; avant le SQL v3 (delRev absent), à chaque relecture comme avant.
  const revRef = useRef(null);
  const delRev = useRef(undefined);
  const apply = (data, withPid) => {
    setSession(data.session);
    if (typeof data.sent === "number") setSent(data.sent);
    const dr = data.session?.delRev ?? null;
    const recount = !withPid && (dr == null || (delRev.current !== undefined && dr !== delRev.current));
    delRev.current = dr;
    return recount;
  };
  const refresh = useCallback(async (full, withPid = false) => {
    try {
      const q = new URLSearchParams();
      if (!full) q.set("lite", "1");
      else if (revRef.current != null) q.set("rev", revRef.current);
      if (withPid) q.set("pid", pid.current);
      const res = await fetch(`/api/nuage/${code}?${q.toString()}`, { cache: "no-store" });
      if (res.status === 404) return setSession(null);
      const data = await res.json();
      if (!res.ok || data.same) return;
      if (full) { revRef.current = data.rev ?? null; setWords(data.words || []); }
      if (apply(data, withPid)) refresh(false, true);
    } catch (e) { /* réseau : on retentera */ }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pid.current = participantId();
    refresh(false, true);
  }, [refresh]);

  // Rythme : 5 s (nuage affiché : 2,5 s) ; 15 s si les envois sont fermés ou la
  // limite atteinte (nuage affiché : 10 s si fermé). Pause après 1 h sans action
  // sur la page (un toucher relance).
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const lastAct = useRef(Date.now());
  const pace = useRef({});
  const kick = useRef(() => {});
  const activity = useCallback(() => {
    lastAct.current = Date.now();
    if (pausedRef.current) { pausedRef.current = false; setPaused(false); kick.current(); }
  }, []);
  useEffect(() => {
    if (session === null) return;
    let timer = null, alive = true;
    const loop = async (first) => {
      clearTimeout(timer);
      if (!alive || pausedRef.current) return;
      if (!first && !document.hidden) await refresh(showCloud);
      if (!alive) return;
      if (Date.now() - lastAct.current > 3600 * 1000) { pausedRef.current = true; setPaused(true); return; }
      const { open, done } = pace.current;
      timer = setTimeout(() => loop(false), showCloud ? (open ? 2500 : 10000) : (open && !done ? 5000 : 15000));
    };
    kick.current = () => loop(false);
    if (showCloud) refresh(true);
    loop(true);
    const onVisible = () => { if (!document.hidden) activity(); };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false; clearTimeout(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, activity, showCloud, session === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!word.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/nuage/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: pid.current, word }),
      });
      const data = await res.json();
      if (typeof data.sent === "number") setSent(data.sent);
      if (!res.ok) throw new Error(data.error || "Envoi impossible.");
      setFlash(word.trim());
      setWord("");
      setTimeout(() => setFlash(""), 2200);
      input.current?.focus();
      if (showCloud) refresh(true);
    } catch (err) {
      setError(err.message);
      refresh(false, true);
    } finally {
      setBusy(false);
    }
  };

  if (session === undefined) {
    return <Shell><p className="text-center text-white/80">Chargement…</p></Shell>;
  }
  if (session === null) {
    return (
      <Shell>
        <div className="bg-white rounded-3xl p-8 text-center shadow-xl">
          <p className="text-4xl mb-3">🤔</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nuage introuvable</h1>
          <p className="text-gray-500 mb-6">Le code {formatCode(code)} ne correspond à aucun nuage.</p>
          <Link href="/nuage" className="inline-block bg-sky-500 text-white font-bold px-6 py-3 rounded-full">Saisir un autre code</Link>
        </div>
      </Shell>
    );
  }

  const unlimited = session.maxPerParticipant === 0;
  const remaining = unlimited ? Infinity : Math.max(0, session.maxPerParticipant - sent);
  const open = session.status === "open";
  const theme = resolveTheme(session.style);
  pace.current = { open, done: remaining === 0 };

  return (
    <Shell>
      <div className="bg-white rounded-3xl p-7 shadow-xl">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><AppIcon app="nuage" className="w-5 h-5" /> Nuage de mots · {formatCode(code)}</p>
        <h1 className="text-2xl font-extrabold text-gray-900 leading-tight mb-6">{session.question}</h1>

        {!open ? (
          <>
            <p className="text-center bg-gray-100 text-gray-600 rounded-2xl py-4 font-medium">🔒 Les envois sont fermés.</p>
            <SoutenirLink className="mt-4" />
          </>
        ) : remaining === 0 ? (
          <div className="text-center bg-green-50 text-green-700 rounded-2xl py-5">
            <p className="text-3xl mb-1">🎉</p>
            <p className="font-bold">Merci ! Vos mots sont dans le nuage.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              ref={input} autoFocus maxLength={MAX_WORD_LEN} value={word} placeholder="Votre mot…"
              onChange={(e) => setWord(e.target.value)} enterKeyHint="send" autoComplete="off"
              className="w-full text-xl border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:border-sky-500 outline-none"
            />
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>
                {unlimited
                  ? `Autant de mots que vous voulez${sent ? ` · ${sent} envoyé${sent > 1 ? "s" : ""}` : ""}`
                  : `${remaining} mot${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`}
              </span>
              <span>{word.length}/{MAX_WORD_LEN}</span>
            </div>
            <button disabled={busy || !word.trim()}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-lg font-bold py-3.5 rounded-full transition-colors">
              {busy ? "Envoi…" : "Envoyer"}
            </button>
          </form>
        )}

        {flash && <p className="mt-4 text-center text-green-600 font-semibold">✓ « {flash} » envoyé !</p>}
        {error && <p className="mt-4 text-center text-red-600 text-sm">{error}</p>}
        {paused && (
          <button onClick={activity} className="mt-4 w-full text-center text-xs text-gray-400">
            ⏸ Actualisation en pause — touchez pour reprendre
          </button>
        )}

        {sent > 0 && (
          <button onClick={() => setShowCloud((v) => !v)} className="mt-6 w-full text-sm font-semibold text-sky-600 hover:underline">
            {showCloud ? "Masquer le nuage" : "Voir le nuage en direct"}
          </button>
        )}
      </div>

      {showCloud && (
        <div className="mt-5 rounded-3xl p-3 shadow-xl h-[60vh]" style={{ background: theme.bg }}>
          {words.length
            ? <WordCloud words={words} colors={theme.colors} weight={theme.weight} arrangement={theme.arrangement} effect={theme.effect} />
            : <p className="text-center pt-10" style={{ color: theme.sub }}>Aucun mot pour l'instant.</p>}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-sky-500 to-violet-600 px-4 py-10">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}
