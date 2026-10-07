import type { ReactNode } from 'react'
import { H, HZ, lit, W } from './frame'
import { useSceneIds } from './ids'
import { HORIZON, type SkyLook } from './sky'

const STARS: [number, number, number][] = [
  [60, 40, 1.4], [140, 90, 1], [210, 30, 1.6], [300, 70, 1.1], [380, 25, 1.3], [450, 110, 0.9], [520, 50, 1.5],
  [600, 85, 1], [660, 30, 1.2], [730, 100, 1.4], [800, 45, 1], [870, 80, 1.6], [920, 20, 1.1], [100, 150, 0.9],
  [260, 140, 1.2], [480, 160, 1], [700, 150, 1.1], [880, 170, 0.9], [30, 200, 1], [560, 205, 0.8],
]

/** Shared gradients and filters, ids prefixed so they never clash with the map. */
export function SceneDefs({ look }: { look: SkyLook }) {
  const ids = useSceneIds()
  return (
    <defs>
      <linearGradient id={ids.id('sky')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={look.top} />
        <stop offset="0.6" stopColor={look.middle} />
        <stop offset="1" stopColor={look.horizon} />
      </linearGradient>
      <linearGradient id={ids.id('sea')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={look.seaFar} />
        <stop offset="1" stopColor={look.seaNear} />
      </linearGradient>
      <radialGradient id={ids.id('sun-glow')}>
        <stop offset="0" stopColor={look.glow} stopOpacity="0.85" />
        <stop offset="0.35" stopColor={look.glow} stopOpacity="0.35" />
        <stop offset="1" stopColor={look.glow} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ids.id('lamp-glow')}>
        <stop offset="0" stopColor="#ffe6a3" stopOpacity="0.95" />
        <stop offset="0.4" stopColor="#ffb85c" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.id('reflection')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={look.glow} stopOpacity="0.8" />
        <stop offset="1" stopColor={look.glow} stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/**
 * The sky, sun (with its glow), moon, stars and drifting clouds. `top` is the highest point of the
 * scene that is visible (a wide, short stage shows less sky), so everything in the sky is placed
 * within what can be seen: the sun keeps its whole arc from the top of the view down to the horizon.
 */
export function SkyBackdrop({ look, top = 0 }: { look: SkyLook; top?: number }) {
  const ids = useSceneIds()
  const span = HZ - top
  /** Sky heights (0 = top of the full frame, HZ = horizon) squeezed into the visible sky. */
  const skyY = (y: number) => top + (y / HZ) * span
  const sx = look.sunX * W
  const sy = look.sunY <= HORIZON ? top + 26 + (look.sunY / HORIZON) * (span - 26) : HZ + (look.sunY - HORIZON) * H
  const sunUp = look.sunY < HORIZON + 0.08
  const moonY = skyY(80)
  return (
    <g className="scene-sky">
      <rect x={-W} y={top} width={3 * W} height={span + 4} fill={ids.url('sky')} />
      <g opacity={look.starOpacity}>
        {STARS.map(([x, y, r], i) => (
          <circle key={i} className="scene-star" cx={x} cy={skyY(y)} r={r} fill="#fffbe8" style={{ animationDelay: `${(i % 5) * 0.7}s` }} />
        ))}
      </g>
      {sunUp && (
        <g>
          <circle cx={sx} cy={sy} r={150} fill={ids.url('sun-glow')} />
          <circle cx={sx} cy={sy} r={26} fill={look.sunColor} />
          <circle cx={sx} cy={sy} r={33} fill={look.sunColor} opacity="0.25" />
        </g>
      )}
      <g opacity={look.moonOpacity}>
        <circle cx={W * 0.78} cy={moonY} r={90} fill={ids.url('sun-glow')} opacity="0.5" />
        <circle cx={W * 0.78} cy={moonY} r={20} fill="#f4f1de" />
        <circle cx={W * 0.78 + 8} cy={moonY - 5} r={17} fill={look.top} />
      </g>
      <Clouds look={look} skyY={skyY} />
    </g>
  )
}

function Cloud({ x, y, scale, look }: { x: number; y: number; scale: number; look: SkyLook }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="scene-cloud" fill={look.cloudColor} opacity={look.cloudOpacity}>
        <ellipse cx="0" cy="0" rx="46" ry="18" />
        <ellipse cx="-26" cy="4" rx="28" ry="14" />
        <ellipse cx="22" cy="-10" rx="30" ry="20" />
        <ellipse cx="-6" cy="-16" rx="22" ry="16" />
        <ellipse cx="0" cy="8" rx="56" ry="9" opacity="0.6" />
      </g>
    </g>
  )
}

/** Clouds at fixed sky heights, squeezed into the visible sky by `skyY`. */
function Clouds({ look, skyY }: { look: SkyLook; skyY: (y: number) => number }) {
  return (
    <g>
      <Cloud x={150} y={skyY(70)} scale={1.1} look={look} />
      <Cloud x={430} y={skyY(130)} scale={0.7} look={look} />
      <Cloud x={720} y={skyY(60)} scale={0.9} look={look} />
      <Cloud x={880} y={skyY(170)} scale={0.55} look={look} />
    </g>
  )
}

/** The sea from the horizon down to `shore`, with waves and the sun's (or moon's) reflection. */
export function Sea({ look, shore = H, children }: { look: SkyLook; shore?: number; children?: ReactNode }) {
  const ids = useSceneIds()
  const sx = look.sunX * W
  const low = look.sunY < HORIZON ? Math.min(1, Math.max(0, (look.sunY - 0.12) / (HORIZON - 0.12))) : 0
  const reflection = low * 0.75
  return (
    <g className="scene-sea">
      <rect y={HZ} width={W} height={shore - HZ} fill={ids.url('sea')} />
      <rect y={HZ} width={W} height={2} fill={look.horizon} opacity="0.6" />
      {reflection > 0.02 && (
        <path
          d={`M${sx - 18} ${HZ} L${sx + 18} ${HZ} L${sx + 70} ${shore} L${sx - 70} ${shore}Z`}
          fill={ids.url('reflection')}
          opacity={reflection}
        />
      )}
      {look.moonOpacity > 0.05 && (
        <path
          d={`M${W * 0.78 - 8} ${HZ} L${W * 0.78 + 8} ${HZ} L${W * 0.78 + 40} ${shore} L${W * 0.78 - 40} ${shore}Z`}
          fill="#f4f1de"
          opacity={look.moonOpacity * 0.18}
        />
      )}
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.35">
        {[
          [120, HZ + 18, 40], [380, HZ + 12, 30], [640, HZ + 24, 46], [840, HZ + 16, 28],
          [220, HZ + 44, 60], [520, HZ + 52, 54], [760, HZ + 60, 64],
        ].map(([x, y, w], i) =>
          y < shore - 6 ? (
            <path key={i} className="scene-wave" style={{ animationDelay: `${i * 0.6}s` }} d={`M${x} ${y} q${w / 4} -5 ${w / 2} 0 t${w / 2} 0`} />
          ) : null,
        )}
      </g>
      {children}
    </g>
  )
}

/** Foam where the sea meets the sand: `d` is the shoreline, drawn left to right. */
export function Foam({ d }: { d: string }) {
  return (
    // Square ends, so the foam joins its mirrored copy at the scene's edges without a bright dot.
    <path className="scene-foam" d={d} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="butt" opacity="0.75" />
  )
}

interface PalmProps {
  x: number
  /** Ground level at the trunk. */
  y: number
  height?: number
  /** Positive leans right. */
  lean?: number
  look: SkyLook
  delay?: number
}

const FROND_ANGLES = [-168, -140, -110, -70, -40, -12, 20]

/** A palm tree: a curved trunk and a crown of fronds that sways in the breeze. */
export function Palm({ x, y, height = 170, lean = 0.25, look, delay = 0 }: PalmProps) {
  const topX = lean * height * 0.45
  const trunk = lit(look, '#8a5a35')
  const ring = lit(look, '#a8774b')
  const leaf = lit(look, '#2f8f5b')
  const leafDark = lit(look, '#21704a')
  const s = height / 170
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="scene-palm" style={{ animationDelay: `${delay}s` }}>
        <path d={`M-7 0 Q${topX * 0.2 - 5} ${-height * 0.55} ${topX - 3} ${-height} L${topX + 3} ${-height} Q${topX * 0.2 + 7} ${-height * 0.55} 7 0Z`} fill={trunk} />
        <path
          d={`M0 -6 Q${topX * 0.2} ${-height * 0.55} ${topX} ${-height}`}
          stroke={ring}
          strokeWidth="9"
          strokeDasharray="3 9"
          fill="none"
        />
        <g transform={`translate(${topX} ${-height}) scale(${s})`}>
          {FROND_ANGLES.map((angle, i) => (
            <path
              key={angle}
              transform={`rotate(${angle})`}
              d="M0 0 C 28 -20, 72 -18, 104 14 C 82 2, 60 2, 46 8 C 32 6, 14 4, 0 0Z"
              fill={i % 2 ? leafDark : leaf}
            />
          ))}
          <circle cx="-5" cy="6" r="6" fill={lit(look, '#6b4b2a')} />
          <circle cx="5" cy="8" r="6" fill={lit(look, '#5c3f22')} />
        </g>
      </g>
    </g>
  )
}

/** Soft rolling sand in the foreground: three bands, lightest at the front. */
export function SandWaves({ look, top = 400 }: { look: SkyLook; top?: number }) {
  const t = top
  return (
    <g>
      <path d={`M0 ${t} C 160 ${t - 26}, 320 ${t + 10}, 480 ${t - 8} S 800 ${t - 30}, ${W} ${t - 6} L${W} ${H} L0 ${H}Z`} fill={lit(look, '#e9c48a')} />
      <path d={`M0 ${t + 26} C 200 ${t + 6}, 360 ${t + 40}, 560 ${t + 22} S 860 ${t + 4}, ${W} ${t + 24} L${W} ${H} L0 ${H}Z`} fill={lit(look, '#f2d39f')} />
      <path d={`M0 ${t + 56} C 240 ${t + 40}, 420 ${t + 70}, 640 ${t + 52} S 900 ${t + 44}, ${W} ${t + 58} L${W} ${H} L0 ${H}Z`} fill={lit(look, '#f8e2b8')} />
      <g fill="none" stroke={lit(look, '#d9ad6c')} strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <path d={`M120 ${t + 36} q30 -6 60 0`} />
        <path d={`M430 ${t + 64} q40 -8 80 0`} />
        <path d={`M760 ${t + 34} q30 -6 60 0`} />
      </g>
    </g>
  )
}

/** A warm light that only shows after dark: a glow plus a bright core. */
export function Lamp({ x, y, r = 4, look, glow = 26 }: { x: number; y: number; r?: number; look: SkyLook; glow?: number }) {
  const ids = useSceneIds()
  if (look.lamps <= 0) return null
  return (
    <g opacity={look.lamps}>
      <circle cx={x} cy={y} r={glow} fill={ids.url('lamp-glow')} />
      <circle cx={x} cy={y} r={r} fill="#fff1c1" />
    </g>
  )
}

/** A lit window: dark-ish by day, glowing warmly at night. */
export function Window({ x, y, w, h, look, day = '#5b4636' }: { x: number; y: number; w: number; h: number; look: SkyLook; day?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.2} fill={lit(look, day)} />
      {look.lamps > 0 && <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.2} fill="#ffcf6b" opacity={look.lamps * 0.95} />}
    </g>
  )
}

/** A string of fairy lights hanging between two points. */
export function FairyLights({ from, to, sag = 18, count = 9, look }: { from: [number, number]; to: [number, number]; sag?: number; count?: number; look: SkyLook }) {
  const [x1, y1] = from
  const [x2, y2] = to
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 + sag
  const colours = ['#ffd36b', '#ff8a6b', '#9be3ff', '#c6ff8a']
  const point = (t: number) => [
    (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t ** 2 * x2,
    (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t ** 2 * y2,
  ]
  return (
    <g>
      <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} stroke={lit(look, '#4a3a2c')} strokeWidth="1.2" fill="none" />
      {Array.from({ length: count }, (_, i) => {
        const [x, y] = point((i + 0.5) / count)
        return (
          <g key={i}>
            {look.lamps > 0 && <circle cx={x} cy={y} r={9} fill={colours[i % 4]} opacity={look.lamps * 0.35} />}
            <circle cx={x} cy={y} r={2.6} fill={look.lamps > 0.3 ? colours[i % 4] : lit(look, '#d8d0c0')} />
          </g>
        )
      })}
    </g>
  )
}
