/*
 * Jukebox — BETA écran commun avec Clic-Clac (27/11/2026) : l'écran de la soirée
 * affiche aussi les photos d'un album Clic-Clac. PUR : partagé client + serveur.
 *  - video  : vidéo en grand, chaque nouvelle photo s'affiche en grand quelques secondes ;
 *  - mix    : vidéo aux 2/3, pêle-mêle de photos au 1/3 ;
 *  - photos : pêle-mêle plein écran, vidéo réduite en vignette (le son continue).
 */
export const PHOTO_LAYOUTS = ["video", "mix", "photos"];
export const PHOTO_LAYOUT_LABELS = { video: "🎵 Vidéo", mix: "🎞️ Mélange", photos: "📸 Photos" };
/* Durée d'une nouvelle photo en grand (disposition « video ») et écart minimal entre deux. */
export const PHOTO_SHOW_MS = 7000;
export const PHOTO_GAP_MS = 20000;
