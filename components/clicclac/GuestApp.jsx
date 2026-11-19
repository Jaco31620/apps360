"use client";
/*
 * Clic-Clac — application invité (/clic-clac/<code>) : prénom (une fois),
 * prise de photo (quota), galerie de l'album.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Studio from "./Studio";
import Gallery from "./Gallery";
import { api, guestId, storage, syncPhotos, formatDate, adminToken, superToken, joinFromHash } from "./client";
import RoleNav from "./RoleNav";
import { useUploadQueue } from "./uploadQueue";
import { importPhotos } from "./importPhotos";
import { MAX_NAME } from "@/lib/clicclac/settings";

export default function GuestApp({ code }) {
  const [album, setAlbum] = useState(undefined);
  const [taken, setTaken] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [studio, setStudio] = useState(false);
  const [toast, setToast] = useState("");
  const [gid, setGid] = useState("");
  const [picked, setPicked] = useState(null); // photo de la galerie à retoucher
  const [importing, setImporting] = useState(null); // { done, total }
  const [onlyMine, setOnlyMine] = useState(false);
  const [orgToken, setOrgToken] = useState(null); // organisateur connecté sur cet appareil
  const [isOrg, setIsOrg] = useState(false);
  const photosRef = useRef([]);
  const pickRef = useRef(null);

  useEffect(() => {
    setGid(guestId());
    // lien de connexion organisateur (#j=…, QR « Sur mon téléphone ») : accepté ici aussi
    joinFromHash(code).catch(() => null).then((t) => setOrgToken(t || adminToken(code) || superToken() || null));
    setName((storage.get(`cc_name_${code}`) || storage.get("cc_name") || "").normalize("NFC"));
  }, [code]);

  const load = useCallback(async () => {
    if (!gid) return;
    try {
      const d = await api(`/${code}?guest=${gid}`, { token: orgToken || undefined });
      setAlbum(d.album);
      setIsOrg(d.role === "admin" || d.role === "super");
      setTaken(d.taken || 0);
      photosRef.current = await syncPhotos(code, photosRef.current, { query: `guest=${gid}` });
      setPhotos(photosRef.current);
    } catch (e) {
      if (e.status === 404) setAlbum(null);
    }
  }, [code, gid, orgToken]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    const onVis = () => { if (!document.hidden) load(); }; // rafraîchit au retour sur l'appli
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const queue = useUploadQueue(code, (r) => {
    if (r.sent) flash(`✓ ${r.sent > 1 ? `${r.sent} photos en attente envoyées` : "Photo en attente envoyée"} !`);
    if (r.dropped.length) flash(`⚠ Photo non envoyée : ${r.dropped[0]}`, 8000);
    load();
  });
  const flash = (text, ms = 5000) => { setToast(text); setTimeout(() => setToast((t) => (t === text ? "" : t)), ms); };

  const saveName = (e) => {
    e.preventDefault();
    const n = draft.normalize("NFC").trim().slice(0, MAX_NAME);
    if (!n) return;
    storage.set(`cc_name_${code}`, n);
    storage.set("cc_name", n);
    setName(n);
  };

  if (album === undefined) return <Shell><p className="text-center text-white/80 pt-24">Chargement…</p></Shell>;
  if (album === null) {
    return (
      <Shell>
        <div className="bg-white rounded-3xl p-8 text-center shadow-xl mt-16">
          <p className="text-4xl mb-3">🤔</p>
          <h1 className="text-xl font-bold mb-2">Album introuvable</h1>
          <p className="text-gray-500 mb-5">Ce code ne correspond à aucun album, ou l'album a expiré.</p>
          <Link href="/clic-clac" className="inline-block bg-[#ff5a5f] text-white font-bold px-6 py-3 rounded-full">Saisir un autre code</Link>
        </div>
      </Shell>
    );
  }

  const s = album.settings;
  // l'organisateur n'a ni quota, ni modération, et peut envoyer même envois fermés
  const left = isOrg || !(s.guestQuota > 0) ? Infinity : Math.max(0, s.guestQuota - taken);
  const closed = s.uploadsOpen === false;
  const open = !closed || isOrg;
  const token = isOrg ? orgToken : undefined;
  const shown = onlyMine ? photos.filter((p) => p.mine) : photos;

  // galerie du téléphone : 1 photo → retouches (cadre, filtre…) ; plusieurs → envoi direct
  const onPick = async (fileList) => {
    let files = [...(fileList || [])];
    if (!files.length) return;
    if (files.length === 1) { setPicked(files[0]); return; }
    let note = "";
    if (files.length > left) { note = ` (${files.length - left} non envoyée${files.length - left > 1 ? "s" : ""} : limite de photos atteinte)`; files = files.slice(0, left); }
    setImporting({ done: 0, total: files.length });
    try {
      const r = await importPhotos(files, { album, code, token, guest: { id: gid, name }, onProgress: setImporting });
      if (r.queued) queue.refresh();
      const parts = [];
      if (r.sent) parts.push(`${r.sent} photo${r.sent > 1 ? "s" : ""} ajoutée${r.sent > 1 ? "s" : ""}${s.moderation && !isOrg ? " (après validation)" : ""}`);
      if (r.queued) parts.push(`${r.queued} en attente d'envoi`);
      if (r.unreadable) parts.push(`${r.unreadable} illisible${r.unreadable > 1 ? "s" : ""}`);
      if (r.failed.length) parts.push(r.failed[0]);
      flash(`${r.failed.length || r.unreadable ? "⚠" : "✓"} ${parts.join(" · ")}${note}`, 8000);
    } finally {
      setImporting(null);
      load();
    }
  };

  if (!name) {
    return (
      <Shell album={album} nav={isOrg ? code : null}>
        <form onSubmit={saveName} className="bg-white rounded-3xl p-7 shadow-xl mt-10 space-y-4">
          <h1 className="text-2xl font-black text-gray-900">Bienvenue ! 👋</h1>
          <p className="text-gray-500">Votre prénom accompagnera vos photos dans l'album.</p>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_NAME} placeholder="Votre prénom"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-[#ff5a5f] outline-none" />
          <button disabled={!draft.trim()} className="w-full bg-[#ff5a5f] disabled:opacity-40 text-white text-lg font-bold py-3.5 rounded-full">C'est parti</button>
          <p className="text-xs text-gray-400 leading-relaxed">
            En participant, vos photos et votre prénom sont visibles par les personnes qui ont le code de l'album.
            Photos hébergées en Europe, sans publicité ni exploitation, supprimées automatiquement le {formatDate(album.expiresAt)}.{" "}
            <Link href="/clic-clac/confidentialite" className="underline">En savoir plus</Link>
          </p>
        </form>
      </Shell>
    );
  }

  return (
    <Shell album={album} nav={isOrg ? code : null}>
      <div className="bg-white rounded-3xl p-5 shadow-xl mt-6 text-center space-y-3">
        <p className="text-gray-500 text-sm">Bonjour <b className="text-gray-900">{name}</b> · <button onClick={() => { setName(""); setDraft(name); }} className="underline">changer</button></p>
        {!open ? (
          <p className="bg-gray-100 text-gray-600 rounded-2xl py-4 px-3 font-semibold">📪 Les envois de photos sont terminés.<br /><span className="font-normal text-sm">L'album reste à votre disposition ci-dessous.</span></p>
        ) : (
          <>
            <button onClick={() => setStudio(true)} disabled={left === 0 || !!importing}
              className="w-full bg-[#ff5a5f] disabled:opacity-40 text-white text-xl font-black py-4 rounded-2xl shadow-lg active:scale-[.98] transition-transform">
              📸 Prendre une photo
            </button>
            {s.allowImport !== false && (
              <>
                <button onClick={() => pickRef.current?.click()} disabled={left === 0 || !!importing}
                  className="w-full bg-white border-2 border-[#ff5a5f] text-[#ff5a5f] disabled:opacity-40 font-bold py-3 rounded-2xl">
                  {importing ? `Envoi… ${importing.done}/${importing.total}` : "🖼️ Ajouter depuis ma galerie"}
                </button>
                <input ref={pickRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
              </>
            )}
          </>
        )}
        {isOrg && closed && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">📪 Envois fermés pour les invités — en tant qu'organisateur, vous pouvez encore ajouter des photos.</p>}
        <p className="text-xs text-gray-400">
          {isOrg ? "Organisateur : pas de limite, vos photos sont publiées directement." : left === Infinity ? `${taken} photo${taken > 1 ? "s" : ""} prise${taken > 1 ? "s" : ""}` : left === 0 ? "Vous avez utilisé toutes vos photos 🙂" : `${left} photo${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`}
          {s.moderation && !isOrg && " · les photos sont validées avant publication"}
        </p>
        {queue.pending > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            📤 {queue.pending} photo{queue.pending > 1 ? "s" : ""} en attente d'envoi (réseau lent) — {queue.pending > 1 ? "elles partiront" : "elle partira"} automatiquement. Gardez cette page ouverte ou revenez-y plus tard.
          </p>
        )}
        {toast && <p className={`font-semibold ${toast.startsWith("⚠") ? "text-red-600" : "text-green-600"}`}>{toast}</p>}
      </div>

      <div className="bg-white rounded-3xl p-3 shadow-xl mt-5">
        <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-3">
          <h2 className="font-bold text-gray-900">🖼️ L'album <span className="text-gray-400 font-normal">({photos.length})</span></h2>
          {photos.some((p) => p.mine) && (
            <div className="flex gap-1 text-sm">
              <button onClick={() => setOnlyMine(false)} className={`px-3 py-1 rounded-full font-semibold ${!onlyMine ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Toutes</button>
              <button onClick={() => setOnlyMine(true)} className={`px-3 py-1 rounded-full font-semibold ${onlyMine ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Mes photos</button>
            </div>
          )}
        </div>
        <Gallery photos={shown} canDownload={s.guestDownload}
          onDelete={async (p) => { await api(`/${code}/photos/${p.id}?guest=${gid}`, { method: "DELETE" }); photosRef.current = photosRef.current.filter((x) => x.id !== p.id); setPhotos(photosRef.current); load(); }} />
      </div>

      <Privacy album={album} />

      {(studio || picked) && (
        <Studio album={album} code={code} token={token} guest={{ id: gid, name }} initialFile={picked}
          onClose={() => { setStudio(false); setPicked(null); }}
          onDone={(r) => {
            setStudio(false);
            setPicked(null);
            if (r.queued) { queue.refresh(); flash("📤 Réseau lent : photo gardée sur votre téléphone, elle partira automatiquement.", 8000); }
            else flash(r.pending ? "✓ Photo envoyée — elle apparaîtra après validation." : "✓ Photo ajoutée à l'album !");
            load();
          }} />
      )}
    </Shell>
  );
}

/* Rappel discret en bas de page : visibilité, conservation, retrait. */
function Privacy({ album }) {
  return (
    <p className="text-center text-xs text-gray-400 mt-6 px-4 leading-relaxed">
      Album visible par les détenteurs du code · supprimé automatiquement le {formatDate(album.expiresAt)}.<br />
      Une photo de vous à retirer ? Supprimez-la (si vous l'avez prise) ou demandez-le à l'organisateur ·{" "}
      <Link href="/clic-clac/confidentialite" className="underline">Confidentialité</Link>
    </p>
  );
}

function Shell({ album, nav, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ff5a5f] via-[#ff8a5b] to-[#fff8f3] bg-no-repeat [background-size:100%_420px] bg-[#fff8f3] px-4 pb-12">
      <div className="max-w-2xl mx-auto pt-6">
        {nav && <RoleNav code={nav} current="guest" dark />}
        <div className="flex items-center gap-3 text-white">
          <img src="/icon-clicclac.svg" alt="" className="w-10 h-10 rounded-xl shadow" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Clic-Clac</p>
            {album && <h1 className="text-2xl font-black leading-tight truncate">{album.name}</h1>}
            {album?.eventDate && <p className="text-sm opacity-90">{formatDate(album.eventDate)}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
