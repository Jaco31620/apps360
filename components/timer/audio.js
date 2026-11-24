"use client";
/*
 * Sons de Timer. Signaux calculés (bip, strident, alarme) ou enregistrés
 * (cloche, sifflet : CC0), à pleine amplitude ; seul le curseur les baisse.
 * Voix : celle du téléphone (France de préférence) ou Claire (voix/*.mp3).
 */
export const SOUNDS = [["bip", "Bip"], ["cloche", "Cloche"], ["sifflet", "Sifflet"], ["strident", "Strident"], ["alarme", "Alarme"], ["off", "Aucun"]];
export const VOICES = [["tel", "Voix du téléphone"], ["claire", "Claire"]];
const TEXT = {
  prep: "Prépare-toi", work: "Effort", rest: "Repos", sets: "Série terminée, repos", last: "Dernier tour",
  go: "C’est parti", next: "Tour suivant", half: "Moitié", end: "Bravo, séance terminée",
};
const FILES = { cloche: "/timer/sons/cloche.mp3", sifflet: "/timer/sons/sifflet.mp3" };

let ac = null, out = null, vocal = null, voiceTimer = null, voiceSrc = null, set = {};
const files = {}, synth = {};

/* À appeler dans un geste de l'utilisateur (les navigateurs bloquent le son sinon). */
export function unlock(settings) {
  configure(settings);
  try {
    if (!ac) {
      // se mêler à la musique d'une autre app au lieu de l'arrêter (Safari)
      try { if (navigator.audioSession) navigator.audioSession.type = "transient"; } catch (e) { /* non géré */ }
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.connect(ac.destination);
      vocal = ac.createGain(); vocal.connect(ac.destination);
    }
    if (ac.state !== "running") ac.resume().catch(() => {});
    configure(set);
    if (FILES[set.sound]) load(FILES[set.sound]).catch(() => {});
    if (set.voice && set.voiceName === "claire") Object.keys(TEXT).forEach((k) => load(`/timer/voix/${k}.mp3`).catch(() => {}));
  } catch (e) { /* pas de son : le timer marche quand même */ }
}
export function configure(settings) {
  set = { ...settings };
  if (out) out.gain.value = (set.vol / 100) ** 2;
  if (vocal) vocal.gain.value = (set.volVoice / 100) ** 2;
}

function load(url) {
  files[url] = files[url] || fetch(url)
    .then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
    .then((b) => ac.decodeAudioData(b))
    .catch((e) => { delete files[url]; throw e; });
  return files[url];
}

async function recorded(url, d, at = 0, off = 0) {
  const t0 = ac.currentTime;
  try {
    const b = await load(url), n = ac.createBufferSource(), g = ac.createGain();
    const t = Math.max(ac.currentTime, t0 + at), e = Math.min(d, b.duration - off);
    n.buffer = b;
    g.gain.setValueAtTime(1, t);
    g.gain.setValueAtTime(1, t + Math.max(0, e - 0.03));
    g.gain.linearRampToValueAtTime(0, t + e);
    n.connect(g).connect(out);
    n.start(t, off);
    n.stop(t + e);
  } catch (e) { beep("bip", 0.5, at); /* fichier indisponible */ }
}

function beep(kind, d, at = 0, pitch = 1) {
  const id = [kind, d, pitch].join();
  if (!synth[id]) {
    const sr = ac.sampleRate, n = Math.ceil(sr * d), buf = ac.createBuffer(1, n, sr), x = buf.getChannelData(0);
    const sin = (f, t) => Math.sin(2 * Math.PI * f * t);
    let max = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let y;
      if (kind === "bip") y = Math.tanh(3 * sin(1040 * pitch, t));
      else if (kind === "strident") y = Math.tanh(4 * sin(1880 * Math.sqrt(pitch), t));
      else y = (t * 9) % 1 < 0.55 || d < 0.3 ? Math.tanh(5 * (sin(2050, t) + 0.5 * sin(4100, t))) : 0;
      x[i] = y * Math.min(1, t / 0.004, (d - t) / 0.02);
      max = Math.max(max, Math.abs(x[i]));
    }
    for (let i = 0; i < n; i++) x[i] *= 0.98 / max;
    synth[id] = buf;
  }
  const s = ac.createBufferSource();
  s.buffer = synth[id];
  s.connect(out);
  s.start(ac.currentTime + at);
}

/* ev : work | rest | end | tick | half */
export function signal(ev) {
  const k = set.sound;
  if (!ac || !k || k === "off") return;
  if (ac.state !== "running") ac.resume().catch(() => {});
  if (ev === "tick") return beep("bip", 0.13);
  if (ev === "half") { beep("bip", 0.1); beep("bip", 0.1, 0.17); return; }
  const rest = ev === "rest", end = ev === "end";
  if (k === "cloche") {
    if (end) { recorded(FILES.cloche, 1.7); recorded(FILES.cloche, 1.7, 0.9); }
    else if (rest) recorded(FILES.cloche, 1.2, 0, 0.49);
    else recorded(FILES.cloche, 1.7);
  } else if (k === "sifflet") {
    (end ? [[0, 0.28], [0.42, 0.28], [0.84, 1]] : rest ? [[0, 0.17], [0.27, 0.17]] : [[0, 1]]).forEach(([a, d]) => recorded(FILES.sifflet, d, a));
  } else {
    (end ? [[0, 0.35], [0.5, 0.35], [1, 0.8]] : rest ? (k === "bip" ? [[0, 0.6]] : [[0, 0.16], [0.26, 0.16]]) : [[0, 0.7]])
      .forEach(([a, d]) => beep(k, d, a, rest ? 0.68 : 1));
  }
}

function phoneVoice() {
  try {
    const l = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
    return l.find((v) => /^fr[-_]FR/i.test(v.lang)) || l[0];
  } catch (e) { return null; }
}
export function silence() {
  clearTimeout(voiceTimer);
  try { voiceSrc?.stop(); } catch (e) { /* déjà arrêtée */ }
  voiceSrc = null;
  try { speechSynthesis.cancel(); } catch (e) { /* non géré */ }
}
/* Annonce, juste après le signal pour ne pas être couverte. */
export function say(k) {
  if (!set.voice) return;
  silence();
  voiceTimer = setTimeout(async () => {
    const v = set.voiceName === "tel" ? phoneVoice() : null;
    try {
      if (v) {
        const u = new SpeechSynthesisUtterance(TEXT[k]);
        u.voice = v; u.lang = v.lang; u.rate = 1.1; u.volume = set.volVoice / 100;
        speechSynthesis.speak(u);
      } else if (ac) {
        const n = ac.createBufferSource();
        n.buffer = await load(`/timer/voix/${k}.mp3`);
        n.connect(vocal);
        n.start();
        voiceSrc = n;
      }
    } catch (e) { /* annonce manquée */ }
  }, ["bip", "off"].includes(set.sound) ? 300 : 850);
}
export const buzz = (p) => { try { navigator.vibrate?.(p); } catch (e) { /* non géré */ } };
