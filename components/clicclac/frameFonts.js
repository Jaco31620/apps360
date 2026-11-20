/*
 * Clic-Clac — polices des cadres (auto-hébergées par next/font : aucune
 * requête vers Google depuis le navigateur des invités).
 * Le canvas n'utilise une police qu'une fois chargée : frameFontsReady()
 * la charge avant de dessiner (repli propre si elle n'arrive pas).
 */
import { Caveat, Playfair_Display, Courier_Prime, Outfit } from "next/font/google";

const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400"], style: ["italic"], display: "swap", preload: false });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["700"], display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"], display: "swap", preload: false });

export const HANDF = `${caveat.style.fontFamily}, "Segoe Print", cursive`;
export const SERIF = `${playfair.style.fontFamily}, Georgia, serif`;
export const MONO = `${courier.style.fontFamily}, "Courier New", monospace`;
export const SANS = `${outfit.style.fontFamily}, system-ui, sans-serif`;

let ready = null;
export function frameFontsReady() {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve();
  if (!ready) {
    const specs = [`700 40px ${HANDF}`, `500 40px ${HANDF}`, `italic 400 40px ${SERIF}`, `700 40px ${MONO}`, `600 40px ${SANS}`, `700 40px ${SANS}`];
    const all = Promise.all(specs.map((f) => document.fonts.load(f).catch(() => null)));
    ready = Promise.race([all, new Promise((r) => setTimeout(r, 4000))]); // réseau lent : on dessine quand même
  }
  return ready;
}
