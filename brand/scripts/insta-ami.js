/*
 * Post Instagram « Ami Invisible » — pistes de couverture (1080 × 1350).
 * node brand/scripts/insta-ami.js → brand/out/reseaux/ami-invisible/*.svg|png + planche-pistes.png
 * Texte en Outfit (police installée localement : copier brand/fonts/*.ttf dans
 * ~/.local/share/fonts puis fc-cache -f). Logo apps360 repris des SVG du kit.
 */
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "..", "node_modules", "sharp"));
process.chdir(path.join(__dirname, ".."));

const W = 1080, H = 1350, X = 97, FS = 104;
const NAVY = "#14306B", ORANGE = "#FF7A1A", GREY = "#AAB4CC", CREAM = "#FFF7ED", RED = "#EF4444";
const OUT = "out/reseaux/ami-invisible";
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const txt = (s, size, color, x, y, { w = 800, anchor = "start", ls = -0.02 } = {}) =>
  `<text x="${x}" y="${y}" font-family="Outfit" font-weight="${w}" font-size="${size}" letter-spacing="${ls * size}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;

// logo du kit (tracés), hauteur de police fs, ligne de base en (x, y)
function logo(file, fs_, x, y, anchor = "start") {
  const src = fs.readFileSync(`out/logo/${file}.svg`, "utf8");
  const [vx, vy, vw, vh] = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>.*?<\/title>/, "");
  const k = fs_ / 100, w = vw * k;
  const left = anchor === "middle" ? x - w / 2 : x;
  return `<g transform="translate(${left - vx * k} ${y}) scale(${k})">${inner}</g>`;
}

// icône de l'app (dessin de public/icon-ami-invisible.svg)
function gift(x, y, size, rot = 0, tile = true) {
  const s = size / 512;
  return `<g transform="translate(${x} ${y}) rotate(${rot} ${size / 2} ${size / 2}) scale(${s})">` +
    (tile ? `<rect width="512" height="512" rx="115" fill="url(#ai)"/>` : "") +
    `<rect x="161" y="245" width="190" height="125" rx="14" fill="#fff"/>
     <rect x="151" y="208" width="210" height="48" rx="12" fill="#fff"/>
     <rect x="240" y="208" width="32" height="162" fill="${tile ? "#F97316" : RED}"/>
     <circle cx="212" cy="186" r="26" fill="none" stroke="#fff" stroke-width="15"/>
     <circle cx="300" cy="186" r="26" fill="none" stroke="#fff" stroke-width="15"/></g>`;
}

const pill = (s, x, y, w, h, bg, fg, size) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/>` + txt(s, size, fg, x + w / 2, y + h / 2 + size * 0.36, { anchor: "middle" });

const DEFS = `<defs>
  <linearGradient id="ai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.28"/></filter>
</defs>`;
const doc = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}<rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

const covers = {
  // A · Série apps360 : bleu nuit du manifeste, grande icône de l'app qui déborde en haut à droite
  "ami-A-serie": doc(NAVY, `
    <g filter="url(#sh)">${gift(470, -110, 720, -10)}</g>
    ${pill("NOUVELLE APPLI", X, 640, 330, 64, ORANGE, "#fff", 30)}
    ${txt("Le Secret Santa,", FS, "#fff", X, 850)}
    ${txt("sans les petits", FS, ORANGE, X, 960)}
    ${txt("papiers.", FS, ORANGE, X, 1070)}
    ${txt("Ami Invisible · tirage au sort et liens secrets", 38, GREY, X, 1150, { w: 500 })}
    ${logo("apps360-logo-fond-sombre", 60, X, 1272)}
    ${txt("gratuit · sans pub", 34, GREY, W - X, 1262, { w: 500, anchor: "end" })}`),

  // B · Couleurs de l'app : dégradé rouge-orange, gros cadeau blanc, texte centré
  "ami-B-couleurs": doc("url(#bg)", `
    <g filter="url(#sh)">${gift(W / 2 - 280, 90, 560, 0, false)}</g>
    ${txt("Le Secret Santa,", FS, "#fff", W / 2, 790, { anchor: "middle" })}
    ${txt("sans les petits papiers.", 76, "#FFE4CC", W / 2, 885, { anchor: "middle" })}
    ${txt("Tirage au sort en ligne · chacun reçoit son lien secret", 34, "#fff", W / 2, 970, { w: 500, anchor: "middle" })}
    ${pill("apps360.fr/ami-invisible", W / 2 - 300, 1040, 600, 92, "#fff", RED, 42)}
    ${logo("apps360-logo-blanc", 52, W / 2, 1272, "middle")}`),

  // C · Le secret : étiquette de cadeau « De : ? ? ? / Pour : Paul », fond crème
  "ami-C-secret": doc(CREAM, `
    <path d="M300 395 C 200 400, 140 300, 70 340 S -10 430, -30 410" fill="none" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>
    <g transform="translate(270 140) rotate(-8 300 230)" filter="url(#sh)">
      <path d="M90 0 H590 Q610 0 610 20 V440 Q610 460 590 460 H90 L0 230 Z" fill="${RED}"/>
      <circle cx="80" cy="230" r="26" fill="${CREAM}"/>
      ${txt("De :", 58, "#FFD3C7", 150, 175, { w: 500 })}
      ${txt("? ? ?", 96, "#fff", 300, 185)}
      <line x1="150" y1="240" x2="550" y2="240" stroke="#FFB4A8" stroke-width="4" stroke-dasharray="14 12"/>
      ${txt("Pour :", 58, "#FFD3C7", 150, 345, { w: 500 })}
      ${txt("Paul", 96, "#fff", 330, 352)}
    </g>
    ${txt("Qui offre à qui ?", FS, NAVY, X, 870)}
    ${txt("Seul le tirage", FS, RED, X, 980)}
    ${txt("le sait.", FS, RED, X, 1090)}
    ${txt("Ami Invisible · le Secret Santa en ligne, gratuit", 38, "#6B6B73", X, 1165, { w: 500 })}
    ${logo("apps360-logo", 60, X, 1272)}`),
};

(async () => {
  for (const [n, svg] of Object.entries(covers)) {
    fs.writeFileSync(`${OUT}/${n}.svg`, svg);
    await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${n}.png`);
  }
  // planche : les 3 pistes côte à côte
  const w = 540, h = 675, g = 40, names = Object.keys(covers);
  const comp = await Promise.all(names.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.png`).resize(w, h).toBuffer(), left: g + i * (w + g), top: g })));
  await sharp({ create: { width: 3 * w + 4 * g, height: h + 2 * g, channels: 3, background: "#0c0f14" } }).composite(comp).png().toFile(`${OUT}/planche-pistes.png`);
  console.log("ok", OUT);
})();
