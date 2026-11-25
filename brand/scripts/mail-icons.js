/* Icônes des e-mails : coins déjà arrondis (Outlook ignore border-radius).
 * Depuis public/icons/<app>-512.png → public/icons/mail/<app>.png (120 px).
 * À relancer si une icône change : node brand/scripts/mail-icons.js */
const sharp = require("sharp");
const path = require("path");
const dir = path.join(__dirname, "../../public/icons");
const S = 120;
const mask = Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 0.225}" fill="#fff"/></svg>`);
(async () => {
  for (const app of ["ami-invisible", "clicclac", "jukebox", "nuage", "respiration", "timer"])
    await sharp(path.join(dir, `${app}-512.png`)).resize(S, S).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toFile(path.join(dir, "mail", `${app}.png`));
})();
