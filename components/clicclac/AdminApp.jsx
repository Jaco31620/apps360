"use client";
/*
 * Clic-Clac — espace organisateur (/clic-clac/<code>/admin) :
 * photos (modération, suppression, ZIP de l'album), réglages (cadres, filtres,
 * quota invité, modération…), partage (QR, liens, borne, e-mail).
 * Connexion : code organisateur (PIN), ou jeton super-admin.
 */
import { sentText } from "@/lib/mail";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import Gallery from "./Gallery";
import TvLink from "@/components/jukebox/TvLink";
import PhoneLink from "./PhoneLink";
import RoleNav from "./RoleNav";
import { makeZip } from "./zip";
import { api, adminToken, superToken, storage, joinFromHash, syncPhotos, formatBytes, formatDate } from "./client";
import { FRAMES, FILTERS, CROPS, MAX_FRAME_TEXT, MAX_NAME } from "@/lib/clicclac/settings";
import SoutenirLink from "@/components/SoutenirLink";
import AppIcon from "@/components/AppIcon";

const FRAME_ACCENTS = ["#ff5a5f", "#c9a227", "#2f7a62", "#2b4c9b", "#e46aa6", "#1c1c22"];

export default function AdminApp({ code }) {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState("photos");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [phone, setPhone] = useState(false);
  const photosRef = useRef([]);

  useEffect(() => {
    joinFromHash(code)
      .then((t) => setToken(t || adminToken(code) || superToken()))
      .catch((e) => { setErr(e.message); setToken(adminToken(code) || superToken()); })
      .finally(() => setReady(true));
  }, [code]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api(`/${code}`, { token });
      if (!d.admin) { storage.set(`cc_admin_${code}`, null); setToken(null); return; }
      setInfo(d);
      photosRef.current = await syncPhotos(code, photosRef.current, { token, rev: d.album?.photosRev });
      setPhotos(photosRef.current);
    } catch (e) {
      if (e.status === 404) setInfo(null);
    }
  }, [code, token]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

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
      <Page>
        <form onSubmit={login} className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl p-7 mt-10 space-y-4">
          <h1 className="text-xl font-black">Espace organisateur</h1>
          <p className="text-gray-500 text-sm">Album <b>{code}</b> — saisissez votre code organisateur.</p>
          <input autoFocus value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} placeholder="Code organisateur"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg tracking-widest focus:border-[#ff5a5f] outline-none" />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button className="w-full bg-[#ff5a5f] text-white font-bold py-3 rounded-full">Se connecter</button>
        </form>
      </Page>
    );
  }
  if (!info) return <Page><p className="text-center text-gray-500 pt-20">Chargement…</p></Page>;

  const { album, usage } = info;
  const s = info.admin.settings;
  const pending = photos.filter((p) => p.status === "pending");

  return (
    <Page>
      <RoleNav code={code} current="admin" />
      <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#ff5a5f]">Espace organisateur</p>
          <AlbumName code={code} token={token} name={album.name} reload={load} />
          <p className="text-sm text-gray-500">
            {album.eventDate && <>{formatDate(album.eventDate)} · </>}code <b className="tracking-wider">{album.code}</b>
            {info.role === "super" && <span className="ml-2 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">super-admin</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setPhone(true)} className="px-4 py-2 rounded-full text-sm font-bold bg-white border border-gray-200">📱 Sur mon téléphone</button>
          <UploadsToggle code={code} token={token} open={s.uploadsOpen} reload={load} />
          <button onClick={() => { storage.set(`cc_admin_${code}`, null); router.push("/clic-clac"); }} className="text-sm text-gray-400 underline">Se déconnecter</button>
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Photos" value={`${usage.photos} / ${s.maxPhotos}`} bar={usage.photos / s.maxPhotos} />
        <Stat label="Stockage" value={formatBytes(usage.bytes)} sub={s.keepHd ? "avec version HD" : "version standard"} />
        <Stat label="Suppression prévue" value={formatDate(album.expiresAt)} sub={`${s.retentionDays} jours après l'événement`} />
      </div>

      <ScreenCard code={code} />

      <nav className="flex gap-2 mb-4">
        {[["photos", `🖼️ Photos${pending.length ? ` (${pending.length} à valider)` : ""}`], ["settings", "⚙️ Réglages"], ["share", "📣 Partager"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full font-semibold text-sm ${tab === k ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>{l}</button>
        ))}
      </nav>

      {tab === "photos" && <PhotosTab code={code} token={token} photos={photos} pending={pending} reload={load} setPhotos={setPhotos} hd={s.keepHd} />}
      {tab === "settings" && <SettingsTab code={code} token={token} settings={s} album={album} reload={load} />}
      {tab === "share" && <ShareTab code={code} token={token} album={album} />}
      {phone && <PhoneLink code={code} token={token} onClose={() => setPhone(false)} />}
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen bg-[#fff8f3] px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/clic-clac" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 mb-4">
          <AppIcon app="clicclac" /> Clic-Clac
        </Link>
        {children}
      </div>
    </div>
  );
}

/* Ouverture / fermeture des envois (fin d'événement) : l'album reste consultable. */
/* Nom de l'album, modifiable sur place (crayon). */
function AlbumName({ code, token, name, reload }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!v.trim()) { setErr("Le nom ne peut pas être vide."); return; }
    if (v.trim() === name) { setEdit(false); return; }
    setBusy(true); setErr("");
    try { await api(`/${code}/settings`, { method: "PATCH", token, body: { name: v } }); await reload(); setEdit(false); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (!edit) {
    return (
      <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
        <span>{name}</span>
        <button onClick={() => { setV(name); setErr(""); setEdit(true); }} title="Renommer l'album" aria-label="Renommer l'album"
          className="text-base w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">✏️</button>
      </h1>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input autoFocus value={v} maxLength={MAX_NAME} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEdit(false)}
          aria-label="Nom de l'album" className="text-2xl font-black text-gray-900 border-2 border-[#ff5a5f] rounded-xl px-3 py-1 w-80 max-w-full" />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-full text-sm font-bold bg-[#ff5a5f] text-white disabled:opacity-50">{busy ? "…" : "Enregistrer"}</button>
        <button type="button" onClick={() => setEdit(false)} className="px-3 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">Annuler</button>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : <p className="text-xs text-gray-400">Visible par les invités : page de l'album, affiche, écran d'affichage.</p>}
    </form>
  );
}

export function UploadsToggle({ code, token, open, reload }) {
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    if (open && !confirm("Fermer les envois ? Les invités (et la borne) ne pourront plus ajouter de photos ; l'album reste consultable et vous pourrez rouvrir à tout moment.")) return;
    setBusy(true);
    try { await api(`/${code}/settings`, { method: "PATCH", token, body: { settings: { uploadsOpen: !open } } }); await reload(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <button onClick={flip} disabled={busy}
      className={`px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50 ${open ? "bg-green-100 text-green-800" : "bg-gray-900 text-white"}`}>
      {open ? "🟢 Envois ouverts · Fermer" : "📪 Envois fermés · Rouvrir"}
    </button>
  );
}

/* Écran d'affichage (diaporama live) : les trois façons de l'afficher, bien en vue. */
function ScreenCard({ code }) {
  const [tv, setTv] = useState(false);
  const card = "flex flex-col items-start text-left gap-0.5 rounded-2xl px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors";
  return (
    <section className="bg-gray-900 text-white rounded-3xl p-5 mb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-3">
        <h2 className="text-lg font-black">📺 Écran d'affichage</h2>
        <p className="text-sm text-white/60">Le diaporama en direct des photos, sur une télé ou un vidéoprojecteur.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <a href={`/clic-clac/${code}/live`} target="_blank" className={card}>
          <span className="font-bold">🖥️ Ouvrir l'écran ici</span>
          <span className="text-xs text-white/60">Ordinateur branché à la télé ou au vidéoprojecteur, puis plein écran (touche F).</span>
        </a>
        <button onClick={() => setTv(true)} className={card}>
          <span className="font-bold">📡 Sur une télé connectée</span>
          <span className="text-xs text-white/60">Ouvrez <b className="text-white">apps360.fr/tv</b> dans le navigateur de la télé, puis scannez son QR code.</span>
        </button>
        <Link href={`/clic-clac/${code}/telecommande`} className={card}>
          <span className="font-bold">📱 Télécommande</span>
          <span className="text-xs text-white/60">Pause, photo suivante, mise en page, afficher une photo… depuis votre téléphone.</span>
        </Link>
      </div>
      {tv && <TvLink app="clicclac" code={code} onClose={() => setTv(false)} />}
    </section>
  );
}

function Stat({ label, value, sub, bar }) {
  return (
    <div className="bg-white rounded-2xl border border-orange-100 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-xl font-black text-gray-900">{value}</p>
      {bar != null && <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-[#ff5a5f]" style={{ width: `${Math.min(100, bar * 100)}%` }} /></div>}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Photos : modération, suppression, ZIP, sélection livre photo ── */
const safeName = (s) => (s || "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 20);
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function bookExtras(list, offset, hd) {
  const enc = new TextEncoder();
  const rows = [["N°", "Fichier", "Date", "Heure", "Prénom", "Légende", "Type"].map(csvCell).join(";")];
  list.forEach((p, i) => {
    const d = p.createdAt ? new Date(p.createdAt) : null;
    rows.push([offset + i + 1, p.file, d ? d.toLocaleDateString("fr-FR") : "", d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      p.name, p.caption, p.kind === "strip" ? "Bande cabine" : "Photo"].map(csvCell).join(";"));
  });
  const readme = [
    "LIVRE PHOTO — mode d'emploi",
    "",
    "Ce dossier contient les photos que vous avez choisies (⭐), dans l'ordre où elles ont été prises.",
    "Les fichiers sont numérotés : la plupart des sites d'impression les rangent dans cet ordre.",
    "",
    "legendes.csv : pour chaque photo, la date, l'heure, le prénom de l'auteur et sa légende.",
    "Il s'ouvre avec Excel, LibreOffice ou Google Sheets ; copiez-collez les légendes dans votre livre.",
    "",
    "Pour créer le livre : choisissez un site ou une boutique de livres photo, puis importez",
    "toutes les photos du dossier (glisser-déposer). Choisissez la mise en page automatique",
    "« par ordre de nom de fichier » ou « par date » si elle est proposée.",
    "",
    hd
      ? "Qualité : photos en haute définition (jusqu'à 4096 pixels), adaptées à des pages jusqu'au format A4."
      : "Qualité : cet album n'a pas gardé la haute définition (photos jusqu'à 2048 pixels) : idéal jusqu'au format 15 × 20 cm. Pour un grand format, une photo par page reste correcte ; évitez les doubles pages.",
    "Les bandes « cabine » sont des images verticales : prévoyez-les en pleine page ou en colonne.",
  ].join("\r\n");
  return [
    { name: "legendes.csv", data: enc.encode("﻿" + rows.join("\r\n")) }, // BOM : accents corrects sous Excel
    { name: "LISEZ-MOI.txt", data: enc.encode("﻿" + readme) },
  ];
}

function PhotosTab({ code, token, photos, pending, reload, setPhotos, hd }) {
  const [filter, setFilter] = useState("all");
  const [zip, setZip] = useState(null);
  const [favIds, setFavIds] = useState([]);
  useEffect(() => { api(`/${code}/book`, { token }).then((r) => setFavIds(r.ids || [])).catch(() => {}); }, [code, token]);
  const present = new Set(photos.map((p) => p.id));
  const favs = new Set(favIds.filter((id) => present.has(id)));
  const favList = photos.filter((p) => favs.has(p.id));
  const list = filter === "pending" ? pending : filter === "book" ? favList : photos;

  const approve = async (p) => {
    await api(`/${code}/photos/${p.id}`, { method: "PATCH", token, body: { status: "published" } });
    setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, status: "published" } : x)));
  };
  const remove = async (p) => {
    await api(`/${code}/photos/${p.id}`, { method: "DELETE", token });
    setPhotos((l) => l.filter((x) => x.id !== p.id));
    reload();
  };
  const fav = async (p, on) => {
    setFavIds((l) => (on ? [...l, p.id] : l.filter((x) => x !== p.id))); // tout de suite à l'écran
    try { const r = await api(`/${code}/book`, { method: "POST", token, body: { id: p.id, on } }); setFavIds(r.ids || []); }
    catch (e) { alert(e.message); setFavIds((l) => (on ? l.filter((x) => x !== p.id) : [...l, p.id])); }
  };

  // ZIP par parties : tout est assemblé en mémoire, on limite donc la taille
  // de chaque fichier (~200 Mo) pour ne pas faire planter tablettes et téléphones.
  const perPart = hd ? 80 : 300;
  const parts = Math.max(1, Math.ceil(photos.length / perPart));
  const bookParts = Math.max(1, Math.ceil(favList.length / perPart));
  /* book : seulement la sélection ⭐, avec legendes.csv et LISEZ-MOI.txt */
  const [zipDone, setZipDone] = useState(false); // album téléchargé → ligne « soutenir apps360 »
  const downloadPart = async (k, book = false) => {
    const tag = `${book ? "b" : "a"}${k}`;
    setZip({ tag, done: 0, total: 0 });
    try {
      const { photos: all } = await api(`/${code}/photos?hd=1`, { token });
      const chrono = [...all].reverse().filter((p) => !book || favs.has(p.id)); // numérotation dans l'ordre de prise de vue
      const n = book ? bookParts : parts;
      const slice = chrono.slice(k * perPart, (k + 1) * perPart);
      const files = new Array(slice.length);
      let done = 0;
      setZip({ tag, done: 0, total: slice.length });
      let next = 0;
      const worker = async () => {
        while (next < slice.length) {
          const i = next++, p = slice[i];
          const res = await fetch(p.hd || p.full, { cache: "no-store" });
          if (!res.ok) throw new Error(`photo ${k * perPart + i + 1} illisible (HTTP ${res.status})`);
          p.file = `${String(k * perPart + i + 1).padStart(book ? 3 : 4, "0")}-${safeName(p.name) || "invite"}${p.kind === "strip" ? "-bande" : ""}.jpg`;
          files[i] = { name: p.file, data: new Uint8Array(await res.arrayBuffer()) };
          setZip({ tag, done: ++done, total: slice.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, slice.length) }, worker)); // 4 téléchargements en parallèle
      if (book) files.push(...bookExtras(slice, k * perPart, hd));
      const blob = makeZip(files);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const base = book ? `livre-photo-${code}` : `clic-clac-${code}`;
      a.download = n > 1 ? `${base}-partie-${k + 1}-sur-${n}.zip` : `${base}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      setZipDone(true);
    } catch (e) {
      alert("Téléchargement impossible : " + e.message);
    } finally {
      setZip(null);
    }
  };
  const zipLabel = (k) => (zip?.tag === `a${k}` ? `Préparation… ${zip.done}/${zip.total}` : parts > 1
    ? `⬇ ZIP ${k + 1}/${parts} (photos ${k * perPart + 1}–${Math.min(photos.length, (k + 1) * perPart)})`
    : "⬇ Télécharger l'album (ZIP)");
  const bookLabel = (k) => (zip?.tag === `b${k}` ? `Préparation… ${zip.done}/${zip.total}` : bookParts > 1
    ? `📖 Kit livre photo ${k + 1}/${bookParts}`
    : `📖 Télécharger le kit livre photo (${favList.length} photo${favList.length > 1 ? "s" : ""})`);

  return (
    <div className="bg-white rounded-3xl border border-orange-100 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filter === "all" ? "bg-[#ff5a5f] text-white" : "bg-gray-100 text-gray-600"}`}>Toutes ({photos.length})</button>
        <button onClick={() => setFilter("pending")} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filter === "pending" ? "bg-amber-400 text-amber-950" : "bg-gray-100 text-gray-600"}`}>À valider ({pending.length})</button>
        <button onClick={() => setFilter("book")} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filter === "book" ? "bg-amber-400 text-amber-950" : "bg-gray-100 text-gray-600"}`}>⭐ Livre photo ({favList.length})</button>
        <div className="flex-1" />
        {pending.length > 0 && filter === "pending" && (
          <button onClick={async () => { for (const p of pending) await approve(p); }} className="px-3 py-1.5 rounded-full text-sm font-semibold bg-green-500 text-white">✓ Tout publier</button>
        )}
        {filter !== "book" && Array.from({ length: parts }, (_, k) => (
          <button key={k} onClick={() => downloadPart(k)} disabled={!!zip || !photos.length} className="px-4 py-1.5 rounded-full text-sm font-bold bg-gray-900 text-white disabled:opacity-50">
            {zipLabel(k)}
          </button>
        ))}
      </div>
      {zipDone && <SoutenirLink />}
      {filter === "book" && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
          <p className="font-bold text-gray-900">📖 Préparer un livre photo</p>
          <p className="text-sm text-gray-600">
            Touchez l'étoile ⭐ des photos à garder (dans « Toutes »), puis téléchargez le kit : les photos choisies
            {hd ? " en haute définition" : ""}, numérotées dans l'ordre de prise de vue, avec un fichier des légendes et prénoms.
            Il suffit ensuite de les importer chez l'imprimeur de livres photo de votre choix.
          </p>
          {!hd && <p className="text-xs text-amber-800">Cet album n'a pas gardé la haute définition : qualité idéale jusqu'au format 15 × 20 cm.</p>}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: bookParts }, (_, k) => (
              <button key={k} onClick={() => downloadPart(k, true)} disabled={!!zip || !favList.length} className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white disabled:opacity-50">
                {bookLabel(k)}
              </button>
            ))}
          </div>
        </div>
      )}
      <Gallery photos={list} admin canDownload onApprove={approve} onDelete={remove} favs={favs} onFav={fav}
        empty={filter === "pending" ? "Aucune photo en attente." : filter === "book" ? "Aucune photo choisie : touchez l'étoile ⭐ des photos dans « Toutes »." : "Aucune photo pour l'instant."} />
    </div>
  );
}

/* ── Réglages ── */
function SettingsTab({ code, token, settings, album, reload }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => { setS((x) => ({ ...x, ...patch })); setSaved(""); };
  const toggle = (key, id) => set({ [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] });

  const save = async () => {
    setBusy(true);
    try {
      const { uploadsOpen, ...rest } = s; // ouverture des envois : bouton de l'en-tête, jamais écrasée ici
      const r = await api(`/${code}/settings`, { method: "PATCH", token, body: { settings: rest } });
      setS(r.settings); setSaved("✓ Enregistré"); reload();
    } catch (e) { setSaved("⚠ " + e.message); } finally { setBusy(false); }
  };

  const uploadFrame = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try { await api(`/${code}/frame`, { method: "POST", token, form }); reload(); set({ frames: [...new Set([...s.frames, "custom"])] }); }
    catch (e) { alert(e.message); }
  };

  const Mode = ({ k }) => (
    <div className="flex gap-1.5">
      {[["off", "Désactivé"], ["imposed", "Imposé"], ["choice", "Au choix de l'invité"]].map(([v, l]) => (
        <button key={v} onClick={() => set({ [k]: v })} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${s[k] === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
      ))}
    </div>
  );
  const Check = ({ checked, onChange, children }) => (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={onChange} className="w-5 h-5 accent-[#ff5a5f]" /><span>{children}</span></label>
  );

  return (
    <div className="bg-white rounded-3xl border border-orange-100 p-6 space-y-7">
      <section className="space-y-2">
        <h3 className="font-bold text-gray-900">Invités</h3>
        <Check checked={s.moderation} onChange={(e) => set({ moderation: e.target.checked })}>Valider les photos avant publication (modération)</Check>
        <Check checked={s.guestDownload} onChange={(e) => set({ guestDownload: e.target.checked })}>Les invités peuvent télécharger les photos (une par une)</Check>
        <Check checked={s.stripEnabled} onChange={(e) => set({ stripEnabled: e.target.checked })}>Proposer la bande « cabine » de 4 photos</Check>
        <Check checked={s.allowImport} onChange={(e) => set({ allowImport: e.target.checked })}>Les invités peuvent ajouter des photos de leur galerie (déjà prises)</Check>
        {s.allowImport && (
          <div className="pl-7">
            <Check checked={s.importMany} onChange={(e) => set({ importMany: e.target.checked })}>…plusieurs à la fois (envoi direct, sans passer par l'édition)</Check>
            <p className="text-xs text-gray-400">Décoché : une photo à la fois, avec le même parcours qu'une prise de vue (format, filtre, cadre). Seuls le format, le filtre et le cadre imposés s'appliquent à un envoi groupé.</p>
          </div>
        )}
        <label className="flex items-center gap-3 py-1.5">
          <span>Photos par invité</span>
          <input type="number" min={0} max={s.maxPhotos} value={s.guestQuota} onChange={(e) => set({ guestQuota: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            className="w-24 border-2 border-gray-200 rounded-lg px-2 py-1" />
          <span className="text-sm text-gray-400">0 = illimité · la borne n'a pas de limite</span>
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-gray-900">Recadrage</h3>
        <div className="flex flex-wrap gap-1.5">
          {[["free", "Libre (l'invité choisit)"], ["off", "Désactivé"], ...CROPS.filter((c) => c.ratio).map((c) => [c.id, `Imposé ${c.label}`])].map(([v, l]) => (
            <button key={v} onClick={() => set({ crop: v })} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${s.crop === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-gray-400">Un format imposé (ex. carré) donne un album homogène, idéal pour les pêle-mêle : l'invité ajuste seulement la position et le zoom.</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold text-gray-900">Cadres</h3>
        <Mode k="framesMode" />
        {s.framesMode === "choice" && (
          <div className="flex flex-wrap gap-x-5">{FRAMES.map((f) => (
            <Check key={f.id} checked={s.frames.includes(f.id)} onChange={() => toggle("frames", f.id)}>{f.label}{f.id === "custom" && !settings.customFrame ? " (à envoyer)" : ""}</Check>
          ))}</div>
        )}
        {s.framesMode === "imposed" && (
          <select value={s.imposedFrame} onChange={(e) => set({ imposedFrame: e.target.value })} className="border-2 border-gray-200 rounded-xl px-3 py-2">
            {FRAMES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
        {s.framesMode !== "off" && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 mr-1">Texte sur les cadres</span>
              {[["none", "Aucun"], ["date", "Date de l'événement"], ["free", "Texte libre"]].map(([v, l]) => (
                <button key={v} onClick={() => set({ frameText: v })} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${s.frameText === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
              ))}
              {s.frameText === "free" && (
                <input value={s.frameFreeText} maxLength={MAX_FRAME_TEXT} onChange={(e) => set({ frameFreeText: e.target.value })}
                  placeholder="Ex. Léa & Tom · 20.11.26" className="border-2 border-gray-200 rounded-lg px-2 py-1 w-60 max-w-full" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 mr-1">Couleur de l'événement</span>
              {FRAME_ACCENTS.map((c) => (
                <button key={c} onClick={() => set({ frameAccent: c })} aria-label={`Couleur ${c}`} style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 border-white ${s.frameAccent === c ? "ring-2 ring-gray-900" : "ring-1 ring-gray-200"}`} />
              ))}
              <input type="color" value={s.frameAccent} onChange={(e) => set({ frameAccent: e.target.value })} aria-label="Autre couleur" className="w-8 h-8 cursor-pointer" />
              <span className="text-xs text-gray-400">ruban adhésif, confettis, timbre de la carte postale</span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 bg-orange-50 rounded-2xl p-3">
          <span className="text-sm text-gray-600">Cadre perso : PNG transparent posé sur la photo (idéalement au format 4:3 ou 3:4).</span>
          <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={(e) => { uploadFrame(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white border border-gray-200">{settings.customFrame ? "Changer" : "Envoyer un cadre"}</button>
          {settings.customFrame && (
            <button onClick={async () => { await api(`/${code}/frame`, { method: "DELETE", token }); reload(); }} className="px-3 py-1.5 rounded-full text-sm font-semibold text-red-600 bg-white border border-red-200">Retirer</button>
          )}
          {album.customFrameUrl && <img src={album.customFrameUrl} crossOrigin="anonymous" alt="Cadre perso" className="h-16 bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] [background-size:12px_12px] rounded" />}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold text-gray-900">Filtres</h3>
        <Mode k="filtersMode" />
        {s.filtersMode === "choice" && (
          <div className="flex flex-wrap gap-x-5">{FILTERS.map((f) => <Check key={f.id} checked={s.filters.includes(f.id)} onChange={() => toggle("filters", f.id)}>{f.label}</Check>)}</div>
        )}
        {s.filtersMode === "imposed" && (
          <select value={s.imposedFilter} onChange={(e) => set({ imposedFilter: e.target.value })} className="border-2 border-gray-200 rounded-xl px-3 py-2">
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
      </section>

      <section className="text-sm text-gray-500 bg-gray-50 rounded-2xl p-4">
        Capacité ({s.maxPhotos} photos), durée de conservation ({s.retentionDays} jours) et version HD ({s.keepHd ? "oui" : "non"}) sont réglées par le super-admin.
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="bg-[#ff5a5f] text-white font-bold px-6 py-3 rounded-full disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        {saved && <span className="text-sm font-semibold text-gray-600">{saved}</span>}
      </div>
    </div>
  );
}

/* ── Partage ── */
function ShareTab({ code, token, album }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const guestUrl = `${origin}/clic-clac/${code}`;
  const copy = async (text, k) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(""), 2000); } catch (e) { /* ignoré */ } };

  const boothToken = async () => (await api(`/${code}/auth`, { method: "POST", token, body: { booth: true } })).token;
  const openBooth = async () => { storage.set(`cc_booth_${code}`, await boothToken()); router.push(`/clic-clac/${code}/borne`); };
  const copyBooth = async () => copy(`${origin}/clic-clac/${code}/borne#b=${await boothToken()}`, "booth");

  const send = async (e) => {
    e.preventDefault();
    setStatus(null);
    try {
      const r = await api(`/${code}/share`, { method: "POST", token, body: { to: to.split(/[\s,;]+/).filter(Boolean), message: msg } });
      setStatus({ ok: !r.failed?.length, text: sentText(r) }); setTo((r.failed || []).join(", "));
    } catch (err) { setStatus({ ok: false, text: err.message }); }
  };

  const btn = "px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 hover:bg-gray-50";
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-3xl border border-orange-100 p-6 text-center space-y-3">
        <h3 className="font-bold text-gray-900">Inviter à participer</h3>
        {origin && <div className="inline-block p-3 bg-white rounded-2xl border"><QRCodeSVG value={guestUrl} size={200} /></div>}
        <p className="text-3xl font-black tracking-[0.25em] text-gray-900">{code}</p>
        <p className="text-sm text-gray-500 break-all">{guestUrl}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => copy(guestUrl, "guest")} className={btn}>{copied === "guest" ? "✓ Copié" : "Copier le lien invité"}</button>
          <a href={`/clic-clac/${code}/affiche`} target="_blank" className={btn}>🖨️ Affiche à imprimer</a>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-3xl border border-orange-100 p-6 space-y-3">
          <h3 className="font-bold text-gray-900">Borne photo</h3>
          <p className="text-sm text-gray-500">Un appareil dédié (tablette, ordinateur avec webcam) en mode cabine : grand bouton, compte à rebours, pas de limite de photos, QR « récupérer ma photo ».</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={openBooth} className="px-4 py-2 rounded-full text-sm font-bold bg-[#ff5a5f] text-white">Ouvrir la borne sur cet appareil</button>
            <button onClick={copyBooth} className={btn}>{copied === "booth" ? "✓ Copié" : "Copier le lien borne"}</button>
          </div>
          <p className="text-xs text-gray-400">Le lien borne donne accès à la prise de photos sans limite pendant 7 jours : ne le partagez pas.</p>
        </div>
        <form onSubmit={send} className="bg-white rounded-3xl border border-orange-100 p-6 space-y-3">
          <h3 className="font-bold text-gray-900">Envoyer le lien de l'album par e-mail</h3>
          <textarea rows={2} value={to} onChange={(e) => setTo(e.target.value)} placeholder="adresse@exemple.fr, autre@exemple.fr"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 resize-none focus:border-[#ff5a5f] outline-none" />
          <textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message (facultatif)"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 resize-none focus:border-[#ff5a5f] outline-none" />
          {status && <p className={`text-sm font-semibold ${status.ok ? "text-green-600" : "text-red-600"}`}>{status.text}</p>}
          <button disabled={!to.trim()} className="bg-gray-900 text-white font-bold px-5 py-2.5 rounded-full disabled:opacity-40">Envoyer</button>
        </form>
      </div>
    </div>
  );
}
