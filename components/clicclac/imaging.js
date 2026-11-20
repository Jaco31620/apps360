"use client";
/*
 * Clic-Clac — traitement d'image dans le navigateur (avant envoi) :
 * filtres (calcul pixel par pixel : fonctionne partout, y compris les anciens
 * Safari sans ctx.filter), cadres, bande « cabine », compression JPEG.
 * La photo envoyée est donc la photo finale, identique partout.
 */

import { HANDF, SERIF, MONO, SANS } from "./frameFonts";

/* ── Filtres ───────────────────────────────────────────────────── */
const FILTER_PARAMS = {
  none: null,
  nb: { gray: 1, contrast: 1.15 },
  vintage: { sepia: 0.45, sat: 0.85, contrast: 0.92, fade: 22, tint: [10, 2, -12] },
  chaud: { sat: 1.12, tint: [20, 6, -16] },
  froid: { sat: 1.05, tint: [-14, 2, 20] },
  contraste: { contrast: 1.32, sat: 1.22 },
  doux: { bright: 12, contrast: 0.88, sat: 0.9, fade: 10 },
};

export function applyFilter(canvas, id) {
  const f = FILTER_PARAMS[id];
  if (!f) return canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const { gray = 0, sepia = 0, sat = 1, contrast = 1, bright = 0, fade = 0, tint = [0, 0, 0] } = f;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
    if (gray) { r = r + (l - r) * gray; g = g + (l - g) * gray; b = b + (l - b) * gray; }
    if (sepia) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia; g += (sg - g) * sepia; b += (sb - b) * sepia;
    }
    if (contrast !== 1) { r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128; }
    r += bright + tint[0]; g += bright + tint[1]; b += bright + tint[2];
    if (fade) { const k = 1 - fade / 255; r = r * k + fade; g = g * k + fade; b = b * k + fade; }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ── Utilitaires ───────────────────────────────────────────────── */
export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

/* Copie redimensionnée (côté le plus long ≤ max). */
export function scaled(src, max) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = makeCanvas(src.width * k, src.height * k);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export const toJpeg = (canvas, quality) => new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));

/* JPEG ≤ maxBytes (baisse la qualité si besoin). */
export async function jpegUnder(canvas, quality, maxBytes) {
  let q = quality, blob = await toJpeg(canvas, q);
  while (blob.size > maxBytes && q > 0.5) { q -= 0.08; blob = await toJpeg(canvas, q); }
  return blob;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* Image (fichier ou élément) → canvas, rognée/limitée à maxSide. */
export function imageToCanvas(img, maxSide = 4096) {
  const w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = makeCanvas(w * k, h * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

/* ── Cadres ────────────────────────────────────────────────────── */
/* Tous les bords sont ajoutés AUTOUR de la photo (rien ne la cache).
 * info = frameInfo(album, customImg) : { text, accent, now, customImg }
 *  - text : texte choisi par l'organisateur ("" = aucun) ;
 *  - accent : couleur de l'événement (#rrggbb) ;
 *  - now : date de la prise de vue (cachet, date incrustée). */
const DEFAULT_ACCENT = "#ff5a5f";
const pad2 = (n) => String(n).padStart(2, "0");

export function frameInfo(album, customImg = null) {
  const s = album?.settings || {};
  const mode = s.frameText || "none";
  const text = mode === "free" ? String(s.frameFreeText || "").trim()
    : mode === "date" ? (album?.eventDate ? fmtDate(album.eventDate) : new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))
    : "";
  return { text, accent: /^#[0-9a-f]{6}$/i.test(s.frameAccent || "") ? s.frameAccent : DEFAULT_ACCENT, now: new Date(), customImg };
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function fit(ctx, text, maxW, size, family, weight = 700, style = "") {
  let s = Math.max(8, Math.round(size));
  const set = () => { ctx.font = `${style} ${weight} ${s}px ${family}`.trim(); };
  set();
  while (ctx.measureText(text).width > maxW && s > 8) { s -= 1; set(); }
  return s;
}
function mix(hex, other, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(other);
  return `rgb(${a.map((v, i) => Math.round(v * (1 - k) + b[i] * k)).join(",")})`;
}
function paperNoise(ctx, x, y, w, h, alpha, seed = 3) {
  const r = seeded(seed), n = Math.min(60000, Math.round((w * h) / 900)), d = Math.max(1.5, Math.min(w, h) / 700);
  for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${alpha * r()})`; ctx.fillRect(x + r() * w, y + r() * h, d, d); }
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const rotate90 = (src, dir) => { // dir 1 : quart de tour horaire, -1 : antihoraire
  const c = makeCanvas(src.height, src.width), ctx = c.getContext("2d");
  if (dir > 0) { ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); } else { ctx.translate(0, c.height); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(src, 0, 0);
  return c;
};

const FRAME_DRAW = {
  /* Polaroïd : proportions d'un vrai tirage, papier texturé, texte manuscrit. */
  polaroid(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), s = Math.round(m * 0.06), b = Math.round(m * (o.text ? 0.27 : 0.21));
    const c = makeCanvas(W + 2 * s, H + s + b), x = c.getContext("2d");
    x.fillStyle = "#fbfaf7"; x.fillRect(0, 0, c.width, c.height); paperNoise(x, 0, 0, c.width, c.height, 0.05);
    x.drawImage(P, s, s);
    x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 1; x.strokeRect(s + 0.5, s + 0.5, W - 1, H - 1);
    if (o.text) { x.fillStyle = "#26262b"; x.textAlign = "center"; x.textBaseline = "middle"; fit(x, o.text, c.width - 3 * s, b * 0.42, HANDF, 700); x.fillText(o.text, c.width / 2, H + s + b * 0.5); }
    return c;
  },

  /* Pellicule : bande de film autour de la photo, perforations, marquages orangés. */
  film(P, o) {
    const land = P.width >= P.height, src = land ? P : rotate90(P, 1);
    const W = src.width, H = src.height, s = Math.round(H * 0.14), pl = Math.round(s * 0.35);
    const c = makeCanvas(W + 2 * pl, H + 2 * s), x = c.getContext("2d");
    x.fillStyle = "#121212"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, pl, s);
    const hw = s * 0.26, hh = s * 0.34, gap = s * 0.5;
    x.fillStyle = "#e7e4dc";
    for (let px = gap * 0.4; px < c.width - hw; px += gap) {
      rrect(x, px, s * 0.14, hw, hh, hw * 0.18); x.fill();
      rrect(x, px, c.height - s * 0.14 - hh, hw, hh, hw * 0.18); x.fill();
    }
    x.fillStyle = "#f29a2e"; x.textBaseline = "middle"; x.font = `700 ${Math.round(s * 0.16)}px ${MONO}`;
    const yTop = s * 0.76, yBot = c.height - s * 0.76;
    x.textAlign = "left";
    for (let k = 0, px = pl + s * 0.3; px < c.width - s; k++, px += W / 3) x.fillText(`▸ ${12 + k}   ${12 + k}A`, px, yBot);
    const label = o.text ? o.text.toUpperCase() : "CLIC-CLAC 400";
    fit(x, label, W * 0.7, s * 0.16, MONO, 700); x.fillText(label, pl + s * 0.3, yTop);
    x.font = `700 ${Math.round(s * 0.16)}px ${MONO}`; x.textAlign = "right"; x.fillText("◂ 400", c.width - pl - s * 0.3, yTop);
    return land ? c : rotate90(c, -1);
  },

  /* Ruban adhésif : tirage légèrement de travers, deux bouts de ruban colorés. */
  tape(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), b = Math.round(m * 0.04), bb = o.text ? Math.round(m * 0.15) : b;
    const pw = W + 2 * b, ph = H + b + bb, ang = (-2.2 * Math.PI) / 180, g = Math.round(m * 0.09);
    const bw = Math.abs(pw * Math.cos(ang)) + Math.abs(ph * Math.sin(ang)), bh = Math.abs(pw * Math.sin(ang)) + Math.abs(ph * Math.cos(ang));
    const c = makeCanvas(bw + 2 * g, bh + 2 * g), x = c.getContext("2d");
    x.fillStyle = mix(o.accent, "#ffffff", 0.86); x.fillRect(0, 0, c.width, c.height);
    x.translate(c.width / 2, c.height / 2); x.rotate(ang);
    x.save(); x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = m * 0.025; x.shadowOffsetY = m * 0.008; x.fillStyle = "#ffffff"; x.fillRect(-pw / 2, -ph / 2, pw, ph); x.restore();
    x.drawImage(P, -pw / 2 + b, -ph / 2 + b);
    if (o.text) { x.fillStyle = "#2a2a30"; x.textAlign = "center"; x.textBaseline = "middle"; fit(x, o.text, pw - 3 * b, bb * 0.5, HANDF, 700); x.fillText(o.text, 0, -ph / 2 + b + H + bb * 0.5); }
    const tw = m * 0.24, th = m * 0.07;
    [[-pw / 2 + tw * 0.25, -ph / 2 + th * 0.1, -0.6], [pw / 2 - tw * 0.25, -ph / 2 + th * 0.1, 0.6]].forEach(([tx, ty, a]) => {
      x.save(); x.translate(tx, ty); x.rotate(a); x.fillStyle = o.accent; x.globalAlpha = 0.62;
      const z = th / 6; x.beginPath(); x.moveTo(-tw / 2, -th / 2);
      for (let i = 0; i <= 6; i++) x.lineTo(tw / 2 - (i % 2 ? z * 0.3 : 0), -th / 2 + i * z);
      for (let i = 6; i >= 0; i--) x.lineTo(-tw / 2 + (i % 2 ? z * 0.3 : 0), -th / 2 + i * z);
      x.closePath(); x.fill(); x.restore();
    });
    return c;
  },

  /* Confettis : marge blanche parsemée de confettis (quelques-uns débordent un peu). */
  confetti(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), b = Math.round(m * 0.085), t = o.text ? Math.round(m * 0.11) : 0;
    const c = makeCanvas(W + 2 * b, H + 2 * b + t), x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(P, b, b);
    const r = seeded(11), cols = [o.accent, "#ffc93c", "#2ec4b6", "#ff6fae", "#5b5fe8"];
    for (let i = 0; i < 110; i++) {
      let px, py, tries = 0;
      do { px = r() * c.width; py = r() * c.height; tries++; }
      while (tries < 20 && ((px > b * 1.35 && px < c.width - b * 1.35 && py > b * 1.35 && py < b + H - b * 0.35) || (t && py > H + b * 1.2 && px > c.width * 0.15 && px < c.width * 0.85)));
      x.save(); x.translate(px, py); x.rotate(r() * Math.PI); x.fillStyle = cols[i % cols.length];
      if (r() < 0.6) x.fillRect(-m * 0.011, -m * 0.0045, m * 0.022, m * 0.009); else { x.beginPath(); x.arc(0, 0, m * 0.0065, 0, Math.PI * 2); x.fill(); }
      x.restore();
    }
    if (o.text) { x.fillStyle = o.accent; x.textAlign = "center"; x.textBaseline = "middle"; fit(x, o.text, c.width * 0.66, t * 0.62, HANDF, 700); x.fillText(o.text, c.width / 2, H + b + t * 0.58); }
    return c;
  },

  /* Carte postale : timbre dentelé de la couleur de l'événement + cachet daté. */
  postcard(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), b = Math.round(m * 0.045), t = o.text ? Math.round(m * 0.11) : 0;
    const c = makeCanvas(W + 2 * b, H + 2 * b + t), x = c.getContext("2d");
    x.fillStyle = "#fdfcf8"; x.fillRect(0, 0, c.width, c.height); x.drawImage(P, b, b);
    const sw = Math.round(m * 0.15), sh = Math.round(sw * 1.22), st = makeCanvas(sw, sh), s = st.getContext("2d");
    s.fillStyle = "#fffdf6"; s.fillRect(0, 0, sw, sh);
    const pr = sw * 0.035, step = pr * 3;
    s.globalCompositeOperation = "destination-out";
    for (let i = step / 2; i < sw; i += step) { s.beginPath(); s.arc(i, 0, pr, 0, 7); s.arc(i, sh, pr, 0, 7); s.fill(); }
    for (let i = step / 2; i < sh; i += step) { s.beginPath(); s.arc(0, i, pr, 0, 7); s.arc(sw, i, pr, 0, 7); s.fill(); }
    s.globalCompositeOperation = "source-over";
    const ip = sw * 0.12; s.fillStyle = o.accent; s.fillRect(ip, ip, sw - 2 * ip, sh - 2 * ip);
    s.fillStyle = "#ffffff"; s.textAlign = "center"; s.textBaseline = "middle";
    s.font = `700 ${Math.round(sw * 0.42)}px ${SANS}`; s.fillText("♥", sw / 2, sh * 0.44);
    s.font = `700 ${Math.round(sw * 0.12)}px ${SANS}`; s.fillText(String(o.now.getFullYear()), sw / 2, sh * 0.76);
    const sx = c.width - b - sw - m * 0.03, sy = b + m * 0.03;
    x.save(); x.shadowColor = "rgba(0,0,0,.3)"; x.shadowBlur = m * 0.01; x.translate(sx + sw / 2, sy + sh / 2); x.rotate(0.04); x.drawImage(st, -sw / 2, -sh / 2); x.restore();
    const R = sw * 0.55, cx = sx - R * 0.35, cy = sy + sh * 0.62;
    x.save(); x.strokeStyle = "rgba(30,30,40,.6)"; x.fillStyle = "rgba(30,30,40,.6)"; x.lineWidth = Math.max(2, m * 0.004);
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, R * 0.8, 0, 7); x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${Math.round(R * 0.3)}px ${MONO}`;
    x.fillText(`${pad2(o.now.getDate())}.${pad2(o.now.getMonth() + 1)}.${String(o.now.getFullYear()).slice(2)}`, cx, cy);
    for (let k = 0; k < 4; k++) {
      x.beginPath(); const yy = cy - R * 0.45 + k * R * 0.3, x0 = cx - R * 3.2;
      for (let px = x0; px <= cx - R * 1.05; px += 4) { const yv = yy + Math.sin(px / (R * 0.18)) * R * 0.07; px === x0 ? x.moveTo(px, yv) : x.lineTo(px, yv); }
      x.stroke();
    }
    x.restore();
    if (o.text) { x.fillStyle = "#2d2d33"; x.textAlign = "left"; x.textBaseline = "middle"; fit(x, o.text, c.width * 0.7, t * 0.6, HANDF, 700); x.fillText(o.text, b * 1.4, H + b + t * 0.56); }
    return c;
  },

  /* Doré fin : moulure dorée fine et passe-partout blanc. */
  gold(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), f = Math.round(m * 0.05), mat = Math.round(m * 0.085), t = o.text ? Math.round(m * 0.08) : 0;
    const c = makeCanvas(W + 2 * (f + mat), H + 2 * (f + mat) + t), x = c.getContext("2d");
    moulding(x, 0, 0, c.width, c.height, f, ["#5a3b0c", "#b8892e", "#f4d98a", "#c8962f", "#7a5216"]);
    x.fillStyle = "#f8f6f0"; x.fillRect(f, f, c.width - 2 * f, c.height - 2 * f);
    const px = f + mat, py = f + mat;
    x.fillStyle = "#e6e1d3"; x.fillRect(px - m * 0.006, py - m * 0.006, W + m * 0.012, H + m * 0.012); // biseau
    x.drawImage(P, px, py); innerShadow(x, px, py, W, H, m * 0.01);
    if (o.text) { x.fillStyle = "#4a3f2c"; x.textAlign = "center"; x.textBaseline = "middle"; fit(x, o.text, W * 0.8, t * 0.55, SERIF, 400, "italic"); x.fillText(o.text, c.width / 2, py + H + (mat + t) * 0.5); }
    return c;
  },

  /* Appareil jetable : coins arrondis, date de la prise de vue incrustée (chiffres orangés). */
  disposable(P, o) {
    const W = P.width, H = P.height, m = Math.min(W, H), b = Math.round(m * 0.035);
    const c = makeCanvas(W + 2 * b, H + 2 * b), x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    x.save(); rrect(x, b, b, W, H, m * 0.025); x.clip(); x.drawImage(P, b, b); x.restore();
    const h = m * 0.05, lw = h * 0.12, gw = h * 0.55, gap = h * 0.22;
    const SEG = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
    const str = `'${String(o.now.getFullYear()).slice(2)} ${pad2(o.now.getMonth() + 1)} ${pad2(o.now.getDate())}`;
    const total = [...str].reduce((acc, ch) => acc + (ch === " " ? gw * 0.6 : ch === "'" ? gw * 0.35 : gw + gap), 0);
    let px = b + W - m * 0.05 - total; const py = b + H - m * 0.05 - h;
    x.save(); x.fillStyle = "#ff8a1c"; x.shadowColor = "rgba(255,120,20,.9)"; x.shadowBlur = h * 0.35;
    for (const ch of str) {
      if (ch === " ") { px += gw * 0.6; continue; }
      if (ch === "'") { x.fillRect(px, py, lw, h * 0.25); px += gw * 0.35; continue; }
      const hh = h / 2;
      const S = { a: [px + lw, py, gw - 2 * lw, lw], b: [px + gw - lw, py + lw, lw, hh - lw * 1.5], c: [px + gw - lw, py + hh + lw * 0.5, lw, hh - lw * 1.5], d: [px + lw, py + h - lw, gw - 2 * lw, lw], e: [px, py + hh + lw * 0.5, lw, hh - lw * 1.5], f: [px, py + lw, lw, hh - lw * 1.5], g: [px + lw, py + hh - lw / 2, gw - 2 * lw, lw] };
      for (const sg of SEG[ch] || "") { const [a1, a2, a3, a4] = S[sg]; x.save(); x.transform(1, 0, -0.12, 1, (a2 + a4) * 0.12, 0); x.fillRect(a1, a2, a3, a4); x.restore(); }
      px += gw + gap;
    }
    x.restore();
    return c;
  },
};

/* photo (canvas filtré) + cadre → nouveau canvas. */
export function applyFrame(photo, frame, info = {}) {
  const o = { text: info.text || "", accent: info.accent || DEFAULT_ACCENT, now: info.now || new Date() };
  if (FRAME_DRAW[frame]) return FRAME_DRAW[frame](photo, o);
  const c = makeCanvas(photo.width, photo.height), ctx = c.getContext("2d");
  ctx.drawImage(photo, 0, 0);
  if (frame === "custom" && info.customImg) ctx.drawImage(info.customImg, 0, 0, photo.width, photo.height); // cadre perso posé par-dessus
  return c;
}

/* ── Moulure à onglets (dégradé = profil en relief), pour « Doré fin » ── */
function moulding(ctx, x, y, w, h, b, stops) {
  const sides = [
    { poly: [[x, y], [x + w, y], [x + w - b, y + b], [x + b, y + b]], g: [x, y, x, y + b] },
    { poly: [[x + w, y], [x + w, y + h], [x + w - b, y + h - b], [x + w - b, y + b]], g: [x + w, y, x + w - b, y] },
    { poly: [[x + w, y + h], [x, y + h], [x + b, y + h - b], [x + w - b, y + h - b]], g: [x, y + h, x, y + h - b] },
    { poly: [[x, y + h], [x, y], [x + b, y + b], [x + b, y + h - b]], g: [x, y, x + b, y] },
  ];
  sides.forEach((sd, i) => {
    ctx.save();
    ctx.beginPath();
    sd.poly.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    const gr = ctx.createLinearGradient(...sd.g);
    stops.forEach((c, k) => gr.addColorStop(k / (stops.length - 1), c));
    ctx.fillStyle = gr; ctx.fill();
    ctx.fillStyle = i < 1 || i === 3 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.18)"; // éclairage : haut/gauche clairs
    ctx.fill();
    ctx.restore();
  });
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = Math.max(1, b / 60);
  for (const [ax, ay, bx2, by2] of [[x, y, x + b, y + b], [x + w, y, x + w - b, y + b], [x + w, y + h, x + w - b, y + h - b], [x, y + h, x + b, y + h - b]]) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
  }
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeRect(x + b, y + b, w - 2 * b, h - 2 * b);
  ctx.restore();
}

/* Ombre portée de la moulure sur la photo (effet de profondeur). */
function innerShadow(ctx, x, y, w, h, d) {
  const edges = [
    [x, y, x, y + d, [x, y, w, d]], [x, y + h, x, y + h - d, [x, y + h - d, w, d]],
    [x, y, x + d, y, [x, y, d, h]], [x + w, y, x + w - d, y, [x + w - d, y, d, h]],
  ];
  for (const [x0, y0, x1, y1, r] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(...r);
  }
}

/* ── Recadrage ─────────────────────────────────────────────────── */
/* Zone de recadrage (en pixels de la source) : format ratio (null = celui de la
 * photo), zoom ≥ 1, centre (cx, cy) en fraction — bornée à la photo. */
export function cropRect(W, H, ratio, zoom = 1, cx = 0.5, cy = 0.5) {
  const r = ratio || W / H;
  let bw = W, bh = W / r;
  if (bh > H) { bh = H; bw = H * r; }
  const w = bw / zoom, h = bh / zoom;
  const x = Math.max(0, Math.min(W - w, cx * W - w / 2)), y = Math.max(0, Math.min(H - h, cy * H - h / 2));
  return { x, y, w, h };
}

export function cropCanvas(src, crop) {
  if (!crop || (!crop.ratio && (crop.zoom || 1) === 1)) return src;
  const r = cropRect(src.width, src.height, crop.ratio, crop.zoom, crop.cx, crop.cy);
  const c = makeCanvas(r.w, r.h);
  c.getContext("2d").drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

/* ── Bande « cabine » : 4 photos (filtrées) → bande verticale ─────── */
export function composeStrip(shots, info = {}) {
  const cw = 900, ch = 675, gap = 22, pad = 34, band = info.text ? 170 : 80; // bas de bande : texte de l'organisateur (ou rien)
  const c = makeCanvas(cw + 2 * pad, pad + shots.length * ch + (shots.length - 1) * gap + band), ctx = c.getContext("2d");
  ctx.fillStyle = "#fbfaf5"; ctx.fillRect(0, 0, c.width, c.height);
  shots.forEach((s, i) => {
    // recadrage centré au format 4:3
    const k = Math.max(cw / s.width, ch / s.height), sw = cw / k, sh = ch / k;
    ctx.drawImage(s, (s.width - sw) / 2, (s.height - sh) / 2, sw, sh, pad, pad + i * (ch + gap), cw, ch);
  });
  if (info.text) {
    ctx.fillStyle = "#26262b"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    fit(ctx, info.text, cw, 72, HANDF, 700);
    ctx.fillText(info.text, c.width / 2, c.height - band / 2);
  }
  return c;
}

/* Tailles (côté le plus long). Standard 2048 : net sur une télé 1080p,
 * correct en 4K. HD 4096 : résolution native d'un téléphone 12 Mpx (impression).
 * La HD part dans une requête à part (limite Vercel de 4,5 Mo par requête). */
export const STD_SIDE = 2048, HD_SIDE = 4096, WORK_SIDE = 2200;

/* Prépare les fichiers à envoyer : standard, miniature (480), HD (option). */
export async function exportForUpload(canvas, { keepHd }) {
  const full = await jpegUnder(scaled(canvas, STD_SIDE), 0.85, 2.6 * 1024 * 1024);
  const thumb = await jpegUnder(scaled(canvas, 480), 0.72, 350 * 1024);
  const hd = keepHd ? await jpegUnder(scaled(canvas, HD_SIDE), 0.9, 4 * 1024 * 1024) : null;
  return { full, thumb, hd };
}
