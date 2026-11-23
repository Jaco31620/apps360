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
const TEAL_D = "#2DE0CC", NAVY = "#14306B", ORANGE = "#FF7A1A", GREY = "#AAB4CC", CREAM = "#FFF7ED", RED = "#EF4444";
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
    <text x="${X}" y="1165" font-family="Outfit" font-size="38" letter-spacing="-0.76"><tspan font-weight="800" fill="${NAVY}">Ami Invisible</tspan><tspan dx="14" font-weight="500" fill="#6B6B73">· le Secret Santa en ligne, gratuit</tspan></text>
    ${logo("apps360-logo", 60, X, 1272)}`),
};


/* ── Carrousel retenu (couverture C) : 4 images, fond crème, explication courte ── */
const MUTED = "#6B6B73";
const dot = (cx, cy, r, inner, bg = RED) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/>${inner}`;
const tagMini = (x, y, k, rot = -8) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><path d="M90 0 H590 Q610 0 610 20 V440 Q610 460 590 460 H90 L0 230 Z" fill="${RED}"/><circle cx="80" cy="230" r="26" fill="${CREAM}"/></g>`;
const header = (title, n) => `
  ${txt(title, 84, NAVY, X, 210)}
  <rect x="${X}" y="250" width="120" height="10" rx="5" fill="${RED}"/>
`;
const footer = (pal = "apps360-logo") => logo(pal, 52, X, 1275) + txt("apps360.fr/ami-invisible", 32, MUTED, W - X, 1266, { w: 500, anchor: "end" });

// pictogrammes blancs (centrés en 0,0, environ 60 px)
const ICON = {
  // exclusion : deux personnes séparées par un trait
  exclude: `<circle cx="-18" cy="-14" r="11" fill="#fff"/><path d="M-36 22 a18 18 0 0 1 36 0 z" fill="#fff"/><circle cx="20" cy="-14" r="11" fill="#fff"/><path d="M2 22 a18 18 0 0 1 36 0 z" fill="#fff"/><line x1="-34" y1="30" x2="36" y2="-36" stroke="${RED}" stroke-width="12"/><line x1="-34" y1="30" x2="36" y2="-36" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  // liste de souhaits : feuille avec lignes et cœur
  wish: `<rect x="-26" y="-32" width="52" height="64" rx="8" fill="#fff"/><rect x="-15" y="-18" width="30" height="6" rx="3" fill="${RED}"/><rect x="-15" y="-4" width="30" height="6" rx="3" fill="${RED}"/><rect x="-15" y="10" width="18" height="6" rx="3" fill="${RED}"/>`,
  // l'année suivante : flèche circulaire
  again: `<path d="M24 -14 A28 28 0 1 0 28 12" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M14 -30 L32 -14 L10 -4 Z" fill="#fff"/>`,
  // à distance : trois personnes
  group: `<circle cx="0" cy="-16" r="11" fill="#fff"/><path d="M-18 22 a18 18 0 0 1 36 0 z" fill="#fff"/><circle cx="-30" cy="-6" r="8" fill="#fff" opacity="0.75"/><path d="M-44 22 a14 14 0 0 1 28 0 z" fill="#fff" opacity="0.75"/><circle cx="30" cy="-6" r="8" fill="#fff" opacity="0.75"/><path d="M16 22 a14 14 0 0 1 28 0 z" fill="#fff" opacity="0.75"/>`,
};

function rows(items, top, gap, numbered) {
  return items.map(([title, line1, line2], i) => {
    const y = top + i * gap;
    const badge = numbered
      ? dot(X + 50, y, 50, txt(String(i + 1), 58, "#fff", X + 50, y + 21, { anchor: "middle" }))
      : dot(X + 50, y, 50, `<g transform="translate(${X + 50} ${y})">${ICON[numbered === false ? items[i][3] : ""]}</g>`, NAVY);
    return `${badge}
      ${txt(title, 50, NAVY, X + 140, y - 8)}
      ${txt(line1, 35, MUTED, X + 140, y + 40, { w: 500 })}
      ${line2 ? txt(line2, 35, MUTED, X + 140, y + 84, { w: 500 }) : ""}`;
  }).join("");
}

const carousel = {
  "carrousel-1": covers["ami-C-secret"],
  "carrousel-2": doc(CREAM, `
    ${header("Comment ça marche ?", 2)}
    ${rows([
      ["Créez votre tirage", "Un nom, et si vous voulez une date,", "un lieu, un budget."],
      ["Ajoutez les participants", "Un prénom et un e-mail suffisent."],
      ["Lancez le tirage au sort", "Un clic. Le secret est bien gardé :", "l'organisateur peut jouer aussi."],
      ["Chacun reçoit son lien secret", "Lui seul sait à qui il fera un cadeau."],
    ], 430, 220, true)}
    ${footer()}`),
  "carrousel-3": doc(CREAM, `
    ${header("Et en plus", 3)}
    ${rows([
      ["Exclusions", "Les couples ne tombent pas", "l'un sur l'autre.", "exclude"],
      ["Listes de souhaits", "Fini les idées de cadeau en panne.", "", "wish"],
      ["L'année suivante", "On repart du même groupe, sans retomber", "sur la même personne.", "again"],
      ["Même à distance", "Famille, amis, collègues :", "chacun reçoit son lien où qu'il soit.", "group"],
    ], 430, 220, false)}
    ${footer()}`),
  "carrousel-4": doc(NAVY, `
    <g filter="url(#sh)">${gift(560, -90, 600, -10)}</g>
    ${txt("Gratuit.", FS, "#fff", X, 640)}
    ${txt("Sans pub.", FS, ORANGE, X, 750)}
    ${txt("Sans mot de passe.", FS, TEAL_D, X, 860)}
    ${txt("Organisez votre tirage en quelques minutes :", 38, GREY, X, 970, { w: 500 })}
    ${pill("apps360.fr/ami-invisible", X, 1010, 600, 92, RED, "#fff", 42)}
    ${txt("lien en bio", 32, GREY, X + 630, 1068, { w: 500 })}
    ${logo("apps360-logo-fond-sombre", 52, X, 1275)}`),
};

(async () => {
  for (const [n, svg] of Object.entries(covers)) {
    fs.writeFileSync(`${OUT}/${n}.svg`, svg);
    await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${n}.png`);
  }
  for (const [n, svg] of Object.entries(carousel)) {
    fs.writeFileSync(`${OUT}/${n}.svg`, svg);
    await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${n}.png`);
  }
  {
    const w = 432, h = 540, g = 30, names = Object.keys(carousel);
    const comp = await Promise.all(names.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.png`).resize(w, h).toBuffer(), left: g + i * (w + g), top: g })));
    await sharp({ create: { width: 4 * w + 5 * g, height: h + 2 * g, channels: 3, background: "#0c0f14" } }).composite(comp).png().toFile(`${OUT}/planche-carrousel.png`);
  }
  // planche : les 3 pistes côte à côte
  const w = 540, h = 675, g = 40, names = Object.keys(covers);
  const comp = await Promise.all(names.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.png`).resize(w, h).toBuffer(), left: g + i * (w + g), top: g })));
  await sharp({ create: { width: 3 * w + 4 * g, height: h + 2 * g, channels: 3, background: "#0c0f14" } }).composite(comp).png().toFile(`${OUT}/planche-pistes.png`);
  console.log("ok", OUT);
})();
