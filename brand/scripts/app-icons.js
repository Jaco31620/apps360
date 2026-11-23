/*
 * Icônes PNG des apps à partir de leur SVG (public/icon-<app>.svg) :
 *   public/icons/<app>-180.png  → écran d'accueil iPhone (icons.apple du layout)
 *   public/icons/<app>-192.png, -512.png → manifestes PWA (Android)
 * Carré plein, coins NON arrondis : iOS et Android arrondissent eux-mêmes
 * (des coins transparents deviendraient noirs sur iPhone).
 * Nouvelle app : ajouter son nom à APPS, relancer `node brand/scripts/app-icons.js`.
 */
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "..", "node_modules", "sharp"));

const APPS = ["jukebox", "clicclac", "nuage", "ami-invisible", "respiration", "blackroll"];
const PUB = path.join(__dirname, "..", "..", "public");
const OUT = path.join(PUB, "icons");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const app of APPS) {
    // premier <rect> plein cadre = fond de l'icône : coins droits
    const svg = fs.readFileSync(path.join(PUB, `icon-${app}.svg`), "utf8")
      .replace(/(<rect\b[^>]*?)\s+rx="[\d.]+"/, "$1");
    for (const size of [180, 192, 512]) {
      await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).flatten({ background: "#ffffff" }).png().toFile(path.join(OUT, `${app}-${size}.png`));
    }
    console.log("ok", app);
  }
})();
