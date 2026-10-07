/**
 * A short sky animation across the top of the day cards: the sun sinks into the sea as the day
 * ends (stars come out), or rises over it in the morning. Pure decoration, CSS-animated, played once.
 */
export function DaySky({ variant }: { variant: 'sunset' | 'sunrise' }) {
  return (
    <div className={`day-sky day-sky--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={`day-sky-warm-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5d8fd1" />
            <stop offset="0.55" stopColor="#f6b98a" />
            <stop offset="1" stopColor="#ffcf7a" />
          </linearGradient>
          <linearGradient id={`day-sky-night-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1433" />
            <stop offset="0.6" stopColor="#2b2f6b" />
            <stop offset="1" stopColor="#d9787a" />
          </linearGradient>
          <radialGradient id={`day-sky-glow-${variant}`}>
            <stop offset="0" stopColor="#ffb347" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect className="day-sky__warm" width="400" height="80" fill={`url(#day-sky-warm-${variant})`} />
        <rect className="day-sky__night" width="400" height="80" fill={`url(#day-sky-night-${variant})`} />
        <g className="day-sky__stars" fill="#fffbe8">
          {[
            [40, 18], [92, 34], [150, 12], [228, 28], [286, 14], [340, 36], [372, 10], [120, 50], [310, 54],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
          ))}
        </g>
        <g className="day-sky__sun">
          <circle cx="200" cy="66" r="44" fill={`url(#day-sky-glow-${variant})`} />
          <circle cx="200" cy="66" r="16" fill="#ff8a3d" />
        </g>
        <rect y="78" width="400" height="32" fill="#2f6f99" />
        <rect className="day-sky__sea-light" y="78" width="400" height="32" fill="#e98a62" />
        <path d="M150 86 h100 M170 94 h60 M188 102 h24" stroke="#ffd39a" strokeWidth="2.5" strokeLinecap="round" className="day-sky__glint" />
        <path d="M0 110 C 60 96, 120 104, 160 98 L160 110Z M260 110 C 300 100, 350 96, 400 104 L400 110Z" fill="#1d3a4a" />
      </svg>
    </div>
  )
}
