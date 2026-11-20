/*
 * Jukebox — conversion de l'ANCIEN format du catalogue (avant la refonte du
 * 03/11/2026 : une ligne par fiche Deezer × mode, clé « dz:<id>:<mode> », fiches
 * rattachées par merged_into) vers chanson / fiches Deezer / versions.
 * Ne sert plus qu'à l'import CSV du super-admin (fichiers exportés avant la
 * refonte, lib/jukeboxLibrary.js). La migration elle-même et l'ancienne table
 * jukebox_songs ont été retirées le 20/11/2026 (SQL v40).
 *
 * Règles :
 *  - une chanson par fiche Deezer « racine » ; une fiche rattachée (merged_into)
 *    devient une fiche Deezer de la chanson de sa ligne gardée ;
 *  - versions : une par mode (normal = paroles, karaoke) ; si deux fiches
 *    d'une même chanson ont une version du même mode, la ligne gardée l'emporte
 *    (« conflit » compté) ;
 *  - chanson : texte corrigé, année, langue, pays, ISRC de la ligne gardée
 *    (mode normal d'abord), sinon des autres ; écoutes additionnées (lignes non
 *    rattachées seulement) ; blind test si une de ses lignes l'était.
 */
const OLD_KEY = /^dz:(\d+):(normal|karaoke)$/;

const first = (list, f) => {
  for (const r of list) if (r[f] !== null && r[f] !== undefined && r[f] !== "") return r[f];
  return null;
};

/* Calcul pur (testé) : lignes anciennes + fiches déjà migrées → nouvelles
 * chansons, fiches, versions, table de correspondance des clés. */
export function planMigration(oldRows, existingAliases = [], newId = () => crypto.randomUUID()) {
  const rows = oldRows.filter((r) => OLD_KEY.test(r.key));
  const parse = (k) => { const m = OLD_KEY.exec(k); return m ? { id: m[1], mode: m[2] } : null; };
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const byId = new Map();
  for (const r of rows) {
    const { id } = parse(r.key);
    (byId.get(id) || byId.set(id, []).get(id)).push(r);
  }
  // fiche racine d'une fiche Deezer : celle de sa ligne gardée (chaîne suivie, sans boucle)
  const rootOf = (id, seen = new Set()) => {
    if (seen.has(id)) return id;
    seen.add(id);
    const m = (byId.get(id) || []).find((r) => r.merged_into && byKey.has(r.merged_into));
    return m ? rootOf(parse(m.merged_into).id, seen) : id;
  };
  const groups = new Map(); // racine → fiches Deezer
  for (const id of byId.keys()) {
    const root = rootOf(id);
    (groups.get(root) || groups.set(root, []).get(root)).push(id);
  }

  const workOf = new Map(existingAliases.map((a) => [String(a.deezer_id), a.work_id]));
  const works = [], aliases = [], versions = [];
  const keyMap = new Map(); // « dz:id:mode » → « w:chanson:mode »
  let conflicts = 0, reused = 0;
  for (const [root, ids] of groups) {
    ids.sort((a, b) => (a === root ? -1 : b === root ? 1 : 0)); // racine d'abord
    const known = ids.map((id) => workOf.get(id)).find(Boolean);
    const workId = known || newId();
    if (known) reused++;
    const own = ids.flatMap((id) => byId.get(id).filter((r) => !r.merged_into));
    const all = ids.flatMap((id) => byId.get(id));
    // ordre de préférence : ligne gardée en mode normal, puis ses autres modes, puis les autres fiches
    const pref = [...own].sort((a, b) => (parse(a.key).id === root ? 0 : 1) - (parse(b.key).id === root ? 0 : 1)
      || (parse(a.key).mode === "normal" ? 0 : 1) - (parse(b.key).mode === "normal" ? 0 : 1));
    const meta = pref.length ? pref : all;
    if (!known) {
      works.push({
        id: workId,
        label: first(meta, "label"), artist_fix: first(meta, "artist_fix"), title_fix: first(meta, "title_fix"),
        isrc: first(meta, "isrc") ?? (all.some((r) => r.isrc === "") ? "" : null),
        song_duration: first(meta, "song_duration"), year: first(meta, "year"), lang: first(meta, "lang"),
        country: first(meta, "country"), fr: first(meta, "fr"), enriched_at: first(meta, "enriched_at"),
        rank: Math.max(0, ...all.map((r) => r.rank || 0)) || null,
        plays: own.reduce((n, r) => n + (r.plays || 0), 0),
        blind: all.some((r) => r.blind),
        created_at: all.map((r) => r.created_at || r.checked_at).filter(Boolean).sort()[0] || new Date().toISOString(),
      });
    }
    for (const id of ids) {
      const rs = byId.get(id);
      aliases.push({
        deezer_id: Number(id), work_id: workId,
        label: first(rs, "label"), song_duration: first(rs, "song_duration"), isrc: first(rs, "isrc"),
      });
    }
    const kinds = new Set();
    for (const r of pref) {
      const { mode } = parse(r.key);
      if (kinds.has(mode)) { conflicts++; continue; }
      kinds.add(mode);
      versions.push({
        work_id: workId, kind: mode, video_id: r.video_id, duration: r.duration ?? null,
        video_title: r.video_title ?? null, video_channel: r.video_channel ?? null,
        lyrics: !!r.lyrics, validated: !!r.validated, missing: !!r.missing, source: "migration",
        checked_at: r.checked_at || new Date().toISOString(), created_at: r.created_at || r.checked_at || new Date().toISOString(),
      });
    }
    for (const r of all) keyMap.set(r.key, `w:${workId}:${parse(r.key).mode}`);
  }
  return { rows: rows.length, works, aliases, versions, keyMap, conflicts, reused, songs: groups.size };
}
