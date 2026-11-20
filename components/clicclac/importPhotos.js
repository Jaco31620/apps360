"use client";
/*
 * Clic-Clac — import de plusieurs photos depuis la galerie du téléphone.
 * Chaque photo est préparée comme une prise de vue (format imposé, filtre et
 * cadre imposés par l'album le cas échéant, sinon telle quelle), réencodée en
 * JPEG — ce qui retire aussi les métadonnées (position GPS…) — puis envoyée
 * via la file d'envoi (nouveaux essais, conservation hors ligne).
 */
import { CROPS } from "@/lib/clicclac/settings";
import { applyFilter, applyFrame, cropCanvas, exportForUpload, imageToCanvas, loadImage, HD_SIDE, WORK_SIDE } from "./imaging";
import { sendWithRetry, enqueue, newUploadId } from "./uploadQueue";

async function prepare(file, album, customImg) {
  const s = album.settings;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let c = imageToCanvas(img, s.keepHd ? HD_SIDE : WORK_SIDE);
    const ratio = CROPS.find((x) => x.id === s.crop)?.ratio || null;
    if (ratio) c = cropCanvas(c, { ratio, zoom: 1, cx: 0.5, cy: 0.5 });
    if (s.filtersMode === "imposed") c = applyFilter(c, s.imposedFilter);
    if (s.framesMode === "imposed" && (s.imposedFrame !== "custom" || customImg)) {
      c = applyFrame(c, s.imposedFrame, { title: album.name, date: album.eventDate, customImg });
    }
    return exportForUpload(c, { keepHd: s.keepHd });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* files : FileList/Array · onProgress({ done, total }) ·
 * → { sent, queued, failed: [messages], unreadable } */
export async function importPhotos(files, { album, code, token = null, guest, onProgress }) {
  const list = [...files].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
  const out = { sent: 0, queued: 0, failed: [], unreadable: 0 };
  let customImg = null;
  if (album.settings.framesMode === "imposed" && album.settings.imposedFrame === "custom" && album.customFrameUrl) {
    customImg = await loadImage(album.customFrameUrl).catch(() => null);
  }
  for (let i = 0; i < list.length; i++) {
    onProgress?.({ done: i, total: list.length });
    let parts;
    try { parts = await prepare(list[i], album, customImg); } catch (e) { out.unreadable++; continue; }
    const item = {
      id: newUploadId(), code, token: token || null, at: Date.now(), full: parts.full, thumb: parts.thumb, hd: parts.hd || null,
      fields: { guestId: guest.id, guestName: guest.name, caption: "", kind: "photo" },
    };
    try {
      await sendWithRetry(item);
      out.sent++;
    } catch (e) {
      if (e.retryable) { await enqueue(item); out.queued++; continue; }
      out.failed.push(e.message);
      if (e.status === 429 || e.status === 403) break; // quota atteint, album complet ou fermé : inutile d'insister
    }
  }
  onProgress?.({ done: list.length, total: list.length });
  return out;
}
