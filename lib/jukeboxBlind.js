/*
 * Jukebox — blind test : helpers PURS (client + serveur).
 *
 * Les titres sont toujours piochés au hasard parmi ceux de la mémoire
 * marqués « blind test » (filtres : langue, décennies, vidéos validées).
 *
 * Correction des réponses : une seule saisie (« queen bohemian rhapsody »,
 * « Queen », « bohemian »…), comparée à l'artiste et au titre, sans tenir
 * compte des majuscules, accents, ponctuation, articles de tête (the, le,
 * la, les, l'), ni des mentions entre parenthèses / après « feat. » ou « - »
 * (Remastered, Radio Edit, Live…). Fautes de frappe tolérées selon la
 * longueur : 0 jusqu'à 4 lettres, 1 jusqu'à 8, 2 jusqu'à 15, puis 20 %.
 * Artiste : son nom de famille suffit (« Hallyday »), et pour un duo, l'un
 * des deux noms.
 */

export const BLIND_MODES = [
  { id: "phone", label: "Réponses sur téléphone", hint: "Les invités tapent leur réponse, les points sont comptés." },
  { id: "anim", label: "Animé par la régie", hint: "Sans téléphone : l'écran masque le titre jusqu'à ce que vous le dévoiliez." },
];
export const BLIND_REVEAL_CHOICES = [
  { v: 20, label: "Après 20 s" },
  { v: 30, label: "Après 30 s" },
  { v: 45, label: "Après 45 s" },
  { v: 60, label: "Après 1 min" },
  { v: 0, label: "À la main" },
];
export const BLIND_AFTER_CHOICES = [
  { v: 10, label: "10 s après la réponse" },
  { v: 20, label: "20 s après la réponse" },
  { v: 0, label: "Titre en entier" },
];
/* Filtres de la pioche dans la mémoire (titres enrichis : année, langue). */
export const BLIND_LANGS = [
  { id: "all", label: "Tous" },
  { id: "fr", label: "Français" }, // drapeau dessiné à l'affichage (FrFlag : l'émoji s'affiche « FR » sous Windows)
  { id: "intl", label: "🌍 International" },
];
/* Titres difficiles (🎓, étiquette de la chanson dans le super-admin) :
 * exclus par défaut ; inclus, au plus 1 titre pioché sur N (réglage de la soirée). */
export const HARD = 2; // jukebox_works.difficulty : 0 normal, 2 difficile
export const BLIND_HARD_CHOICES = [
  { v: 0, label: "Non" },
  { v: 10, label: "1 sur 10" },
  { v: 5, label: "1 sur 5" },
  { v: 3, label: "1 sur 3" },
];
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
export const decadeLabel = (d) => (d < 2000 ? `${String(d).slice(2)}'s` : `${d}'s`);
export const MAX_ANSWER_LEN = 120;
export const MAX_ATTEMPTS = 10; // essais par titre et par invité
export const POINTS_BASE = 50; // par élément trouvé (artiste, titre)
export const POINTS_SPEED = 50; // bonus de rapidité maximum, par élément
export const SPEED_WINDOW = 45; // secondes, si la réponse est dévoilée à la main

export function normalizeBlind(b) {
  return {
    on: !!b?.on,
    mode: BLIND_MODES.some((m) => m.id === b?.mode) ? b.mode : "phone",
    lang: BLIND_LANGS.some((l) => l.id === b?.lang) ? b.lang : "all",
    decades: Array.isArray(b?.decades) ? DECADES.filter((d) => b.decades.map(Number).includes(d)) : [], // vide : toutes
    validated: !!b?.validated, // vidéos validées à la main seulement
    hard: BLIND_HARD_CHOICES.some((c) => c.v === Number(b?.hard)) ? Number(b.hard) : 0, // difficiles : 0 exclus, N = au plus 1 sur N
    reveal: BLIND_REVEAL_CHOICES.some((c) => c.v === Number(b?.reveal)) ? Number(b.reveal) : 30,
    after: BLIND_AFTER_CHOICES.some((c) => c.v === Number(b?.after)) ? Number(b.after) : 10,
    revealedId: typeof b?.revealedId === "string" ? b.revealedId : null, // titre dévoilé à la main
    revealedPos: b?.revealedPos != null && Number.isFinite(Number(b.revealedPos)) ? Number(b.revealedPos) : null, // position de lecture au dévoilement
    holdId: typeof b?.holdId === "string" ? b.holdId : null, // titre prolongé : pas de passage automatique au suivant
    since: Number.isFinite(Number(b?.since)) ? Number(b.since) : 0, // nouvelle partie : titres passés avant, de nouveau piochables
  };
}

/* Un titre difficile peut-il être pioché maintenant ? `recent` : les
 * titres piochés avant (du plus ancien au plus récent, true = difficile) ;
 * au plus 1 sur `share` : aucun parmi les share − 1 derniers. */
export function hardAllowed(recent, share) {
  if (!(share > 0)) return false;
  return !recent.slice(-(share - 1)).some(Boolean);
}

/* Stats des réponses (super-admin, « 📊 À reclasser ») : un titre normal que
 * peu de joueurs trouvent, ou un difficile que presque tous trouvent,
 * sur assez de réponses. stat = { n: réponses, found: artiste ou titre trouvé }. */
export const RERANK_MIN = 8;
export const RERANK_LOW = 0.25;
export const RERANK_HIGH = 0.7;
export function rerankReason(stat, difficulty) {
  if (!stat || stat.n < RERANK_MIN) return null;
  const rate = stat.found / stat.n;
  if (difficulty >= HARD) return rate >= RERANK_HIGH ? "easy" : null;
  return rate < RERANK_LOW ? "hard" : null;
}

/* « Beyoncé » → « beyonce » ; (…), […], feat., « - Remastered »… retirés. */
export function cleanTitle(s) {
  return String(s || "")
    .replace(/\s*[([].*?[)\]]/g, " ")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, "")
    .replace(/\s+[-–—]\s+.*(remaster|version|edit|live|mix|remix|mono|stereo|acoustic|bonus|demo).*$/i, "");
}
/* Nombres écrits en lettres (français, anglais) → chiffres, pour que « 10 »
 * et « dix », « 7 » et « seven » se valent : « quatre vingt dix » → 90,
 * « vingt et un » → 21, « twenty one » → 21 ; « un deux trois » → « 1 2 3 ». */
const UNITS = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, nonante: 90,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const HUNDRED = new Set(["cent", "cents", "hundred"]);
const THOUSAND = new Set(["mille", "thousand"]);
const isNum = (w) => w in UNITS || w in TENS || HUNDRED.has(w) || THOUSAND.has(w);
export function numberWords(words) {
  const out = [];
  let i = 0;
  while (i < words.length) {
    if (!isNum(words[i])) { out.push(words[i++]); continue; }
    let total = 0, cur = 0, last = null, last10 = false;
    while (i < words.length) {
      const w = words[i];
      // « vingt et un », « soixante et onze »
      if (w === "et" && last === "tens" && ["un", "une", "onze"].includes(words[i + 1])) { i++; continue; }
      if (w in UNITS) {
        // « un deux trois » : trois nombres ; sauf dix-sept, soixante-dix-huit, quatre-vingt-dix-neuf
        if (last === "unit" && !(last10 && UNITS[w] >= 7 && UNITS[w] <= 9)) break;
        last10 = last !== "unit" && w === "dix";
        cur += UNITS[w]; last = "unit";
      } else if (w in TENS) {
        if (last === "unit" && cur % 100 === 4 && TENS[w] === 20) { cur += 76; last = "tens"; } // quatre vingt(s) = 80
        else if (last === "unit" || last === "tens") break;
        else { cur += TENS[w]; last = "tens"; }
      } else if (HUNDRED.has(w)) {
        if (last === "hundred" || last === "thousand" && cur) break;
        cur = (cur || 1) * 100; last = "hundred";
      } else if (THOUSAND.has(w)) {
        if (last === "thousand") break;
        total += (cur || 1) * 1000; cur = 0; last = "thousand";
      } else break;
      i++;
    }
    out.push(String(total + cur));
  }
  return out;
}

export function normalizeText(s) {
  const words = String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " et ")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim().split(" ").filter(Boolean);
  // sigles : « N.T.M » → « ntm », comme « NTM » (suite de lettres seules)
  const joined = [];
  let run = false; // le mot précédent est une suite de lettres seules
  for (const w of words) {
    const letter = /^[a-z]$/.test(w);
    if (letter && run) joined[joined.length - 1] += w;
    else joined.push(w);
    run = letter;
  }
  return numberWords(joined).join(" ")
    .replace(/^(the|le|la|les|l) /, "")
    .trim();
}

export const tolerance = (len) => (len <= 4 ? 0 : len <= 8 ? 1 : len <= 15 ? 2 : Math.floor(len * 0.2));

/* Distance d'édition : lettre en trop, en moins, changée ou deux lettres
 * inversées (« stromea ») = 1 faute. */
export function distance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

/* La saisie contient-elle `target` (déjà normalisé) ? On essaie chaque suite
 * de mots de la saisie de longueur voisine, espaces ignorés. */
function contains(answerWords, target) {
  if (!target) return false;
  const t = target.replace(/ /g, "");
  const k = target.split(" ").length;
  const tol = tolerance(t.length);
  for (let size = Math.max(1, k - 1); size <= k + 1; size++)
    for (let i = 0; i + size <= answerWords.length; i++)
      if (distance(answerWords.slice(i, i + size).join(""), t) <= tol) return true;
  return false;
}

/* Autres réponses acceptées, notées entre parenthèses ou crochets dans le
 * texte (corrigeable dans le super-admin, ✎ Texte) : « Orchestral Manoeuvres
 * in the Dark (OMD) », « Ces soirées-là (Yakalelo) ». Les mentions techniques
 * (remaster, live, version, feat…) ne comptent pas. */
const TECH = /\b(remaster(ed)?|version|edit|live|mix|remix|mono|stereo|acoustic|bonus|demo|feat\.?|ft\.?|featuring|instrumental|karaok[eé]|lyrics?|paroles|official|clip|video|single|radio|extended|original|from|bande originale|ost)\b|\d{4}/i;
export function altAnswers(s) {
  return [...String(s || "").matchAll(/[([]([^)\]]+)[)\]]/g)].map((m) => m[1].trim())
    .filter((x) => x.length >= 2 && !TECH.test(x)).map(normalizeText).filter(Boolean);
}

/* Variantes acceptées pour l'artiste : nom complet, chacun des artistes d'un
 * duo, nom de famille (dernier mot, 4 lettres et plus), autre nom entre parenthèses. */
function artistVariants(artist) {
  const full = normalizeText(cleanTitle(artist));
  const out = new Set([full, ...altAnswers(artist)]);
  for (const part of String(artist || "").replace(/\s*[([].*?[)\]]/g, " ").split(/\s*(?:,|&|\bet\b|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bvs\.?)\s*/i)) {
    const n = normalizeText(part);
    if (!n) continue;
    out.add(n);
    const words = n.split(" ");
    if (words.length >= 2 && words[words.length - 1].length >= 4) out.add(words[words.length - 1]);
  }
  return [...out].filter(Boolean);
}

/* Artistes invités notés dans le titre (« Señorita (feat. Camila Cabello) »,
 * « Titre - feat. X ») : acceptés comme interprète. */
export function featArtists(title) {
  const t = String(title || "");
  // « with » / « avec » seulement entre parenthèses (« Dancing with Myself » : pas un invité)
  const m = t.match(/\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)/i) || t.match(/[([]\s*(?:with|avec)\s+([^)\]]+)/i);
  return m ? m[1].trim() : "";
}

/* { artist: bool, title: bool } */
export function checkAnswer(answer, artist, title) {
  const words = normalizeText(answer).split(" ").filter(Boolean);
  if (!words.length) return { artist: false, title: false };
  const feat = featArtists(title);
  return {
    artist: [...artistVariants(artist), ...(feat ? artistVariants(feat) : [])].some((v) => contains(words, v)),
    title: [normalizeText(cleanTitle(title)), ...altAnswers(title)].some((v) => v && contains(words, v)),
  };
}

/* Points d'un élément trouvé `elapsed` secondes après le début du titre. */
export function pointsFor(elapsed, window) {
  const w = window > 0 ? window : SPEED_WINDOW;
  return POINTS_BASE + Math.round(POINTS_SPEED * Math.max(0, 1 - elapsed / w));
}

/* Artiste et titre d'une vidéo YouTube ajoutée par lien (« Artiste - Titre
 * (Official Video) », chaîne « ArtisteVEVO » ou « Artiste - Topic »). */
export function splitVideoTitle(title, channel) {
  const m = String(title || "").match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  if (m) return { artist: m[1], title: m[2] };
  return { artist: String(channel || "").replace(/VEVO$|\s*-\s*Topic$|\s*Official$/i, ""), title };
}

/* Même interprète : nom identique une fois nettoyé, l'un contenu dans l'autre mot
 * pour mot (« Queen » / « Queen & David Bowie »), ou écrit presque pareil
 * (« Halliday » / « Hallyday ») — pas un mot pris au milieu d'un autre
 * (« Sia » ≠ « Iglesias ») ni un titre (« Dancing Queen »). */
export function sameArtist(a, b) {
  const x = normalizeText(a), y = normalizeText(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const wx = x.split(" "), wy = y.split(" ");
  const inside = (u, v) => v.length > u.length && v.join(" ").includes(u.join(" ")) && v.some((w, k) => u.every((t, j) => v[k + j] === t));
  if (inside(wx, wy) || inside(wy, wx)) return true;
  const cx = x.replace(/ /g, ""), cy = y.replace(/ /g, "");
  return Math.min(cx.length, cy.length) >= 5 && distance(cx, cy) <= (Math.min(cx.length, cy.length) >= 9 ? 2 : 1);
}
