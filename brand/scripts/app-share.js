/*
 * Images d'aperçu des liens partagés, une par app (1200 × 630) :
 *   node brand/scripts/app-share.js → public/brand/partage/<app>.png
 * Contenu centré dans le carré central (WhatsApp recadre parfois en carré).
 * Police Outfit installée localement : copier brand/fonts/*.ttf dans
 * ~/.local/share/fonts puis fc-cache -f.
 * Nouvelle app : l'ajouter ici, puis `...shareMeta(...)` dans son layout.
 */
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "..", "node_modules", "sharp"));
const PUB = path.join(__dirname, "..", "..", "public");
const OUT = path.join(PUB, "brand", "partage");

// [app, nom, accroche, fond clair (deux teintes pâles de l'icône)]
const APPS = [
  ["ami-invisible", "Ami Invisible", "Le tirage au sort de vos cadeaux", "#FEE2E2", "#FFEDD5"],
  ["respiration", "Respiration", "Guidez votre souffle", "#E0E7FF", "#FCE7F3"],
  ["timer", "Timer", "Choisis, règle, GO", "#DBEAFE", "#FFEDD5"],
  ["nuage", "Nuage de mots", "Vos réponses, en direct à l'écran", "#CFFAFE", "#EDE9FE"],
  ["clicclac", "Clic-Clac", "Le photo booth de votre événement", "#FFE4E6", "#FEF3C7"],
  ["jukebox", "Jukebox", "C'est vous qui choisissez la musique", "#FAE8FF", "#E0E7FF"],
];
const W = 1200, H = 630, S = 250;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logo = await sharp(path.join(PUB, "brand/apps360-logo.svg"), { density: 300 }).resize({ height: 46 }).png().toBuffer({ resolveWithObject: true });
  const mask = Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 0.225}"/></svg>`);
  for (const [app, name, tag, a, b] of APPS) {
    const icon = await sharp(path.join(PUB, "icons", `${app}-512.png`)).resize(S, S).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <g font-family="Outfit" fill="#14306B" text-anchor="middle">
        <text x="600" y="410" font-weight="800" font-size="84" letter-spacing="-1.7">${name}</text>
        <text x="600" y="466" font-weight="500" font-size="33">${tag}</text>
      </g></svg>`;
    await sharp(Buffer.from(bg)).composite([
      { input: icon, left: (W - S) / 2, top: 62 },
      { input: logo.data, left: Math.round((W - logo.info.width) / 2), top: 536 },
    ]).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${app}.png`));
    console.log("ok", app);
  }
})();
