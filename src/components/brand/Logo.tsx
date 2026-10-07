import { useId } from 'react'

/**
 * The Exploring Goa emblem: a striped retro sun setting into the Arabian Sea, framed by a palm.
 * Pure SVG (no images), so it is crisp at any size: the title screen and the HUD both use it.
 */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const sky = `logo-sky-${id}`
  const sun = `logo-sun-${id}`
  const clip = `logo-clip-${id}`
  return (
    <svg className={`logo-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4fa3" />
          <stop offset="0.45" stopColor="#f2667e" />
          <stop offset="0.8" stopColor="#ffb347" />
        </linearGradient>
        <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="1" stopColor="#ff9a3c" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="58" fill="#fffaf0" />
      <g clipPath={`url(#${clip})`}>
        <rect width="120" height="120" fill={`url(#${sky})`} />
        {/* The sun, with retro stripes cut across its lower half. */}
        <circle cx="60" cy="72" r="30" fill={`url(#${sun})`} />
        {[66, 74, 81, 87].map((y, i) => (
          <rect key={y} x="20" y={y} width="80" height={2 + i * 0.8} fill="#f98a5a" />
        ))}
        {/* The sea and its waves. */}
        <rect y="78" width="120" height="42" fill="#0b6e8a" />
        <rect y="78" width="120" height="6" fill="#1597b8" />
        <path d="M14 92 q8 -4 16 0 t16 0 M60 100 q8 -4 16 0 t16 0 M30 108 q8 -4 16 0 t16 0" stroke="#bfe9f4" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* A palm leaning in from the right. */}
        <path d="M98 120 Q92 82 80 52" stroke="#3a2a1d" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g fill="#1f4d3a" transform="translate(80 52)">
          <path d="M0 0 C -14 -10, -30 -8, -40 4 C -28 -2, -14 -2, 0 0Z" />
          <path d="M0 0 C -10 -16, -6 -30, 4 -38 C -2 -26, -2 -12, 0 0Z" />
          <path d="M0 0 C 10 -14, 26 -16, 36 -8 C 24 -8, 12 -6, 0 0Z" />
          <path d="M0 0 C 14 -2, 28 6, 32 18 C 22 8, 10 4, 0 0Z" />
          <path d="M0 0 C -16 2, -28 12, -30 24 C -20 14, -10 6, 0 0Z" />
        </g>
      </g>
      <circle cx="60" cy="60" r="54" fill="none" stroke="#ffffff" strokeWidth="4" />
    </svg>
  )
}

/** The full logo: emblem plus the "Exploring Goa" wordmark (real text, so it stays accessible and sharp). */
export function Logo() {
  return (
    <div className="logo">
      <LogoMark size={104} className="logo__mark" />
      <h1 className="logo__wordmark" aria-label="Exploring Goa">
        <span className="logo__exploring" aria-hidden="true">
          Exploring
        </span>
        <span className="logo__goa" aria-hidden="true">
          Goa
        </span>
      </h1>
    </div>
  )
}
