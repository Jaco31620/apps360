/*
 * Jukebox — palmarès des votes ❤️ : titres les plus aimés et meilleurs DJ
 * (invités dont les titres ont reçu le plus de cœurs). `p` = { tracks, djs }
 * (lib/jukeboxVotes palmares). `big` : écran ; sinon téléphone (fond clair).
 */
const MEDALS = ["🥇", "🥈", "🥉"];

export function Palmares({ p, big }) {
  if (!p?.tracks?.length && !p?.djs?.length) return null;
  const row = big ? "text-[1.4vw]" : "text-sm";
  const head = big ? "text-[1.6vw] font-bold mb-[1.2vh]" : "font-bold text-gray-900 mb-1.5";
  const muted = big ? "text-white/60" : "text-gray-500";
  const List = ({ items, label }) => (
    <ol className={big ? "space-y-[1vh]" : "space-y-1"}>
      {items.map((x, i) => (
        <li key={i} className={`flex items-center gap-2 ${row}`}>
          <span className={big ? "w-[2.5vw] text-center" : "w-6 text-center"}>{MEDALS[x.rank - 1] || x.rank}</span>
          <span className="flex-1 min-w-0 truncate">{label(x)}</span>
          <span className={`tabular-nums font-bold ${muted}`}>❤️ {x.points}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div className={big ? "grid grid-cols-2 gap-[3vw] text-left" : "space-y-4"}>
      {p.tracks?.length > 0 && (
        <div>
          <h3 className={head}>🎵 Titres les plus aimés</h3>
          <List items={p.tracks} label={(t) => (
            <><span className={`font-semibold ${big ? "" : "text-gray-900"}`}>{t.title}</span>{t.channel ? <span className={muted}> — {t.channel}</span> : null}</>
          )} />
        </div>
      )}
      {p.djs?.length > 0 && (
        <div>
          <h3 className={head}>🎧 Meilleurs DJ</h3>
          <List items={p.djs} label={(d) => <span className={`font-semibold ${big ? "" : "text-gray-900"}`}>{d.name}</span>} />
        </div>
      )}
    </div>
  );
}
