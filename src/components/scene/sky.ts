/**
 * How the sky looks at any minute of the day: colours blended smoothly between keyframes, the
 * sun's place on its arc, the moon, stars and how strongly lamps glow. Presentation only (no game
 * rules): scenes and the page background read it so everything is lit by the same light.
 */

export interface SkyLook {
  /** Sky gradient, top to horizon. */
  top: string
  middle: string
  horizon: string
  /** Sea gradient, near the horizon to the shore. */
  seaFar: string
  seaNear: string
  /** Warm light around the sun (or cool light around the moon). */
  glow: string
  /** Colour washed over the land: warm at golden hour, blue at night. */
  tint: string
  tintOpacity: number
  /** The sun, in a 0–1 frame (x left→right, y top→bottom); y > 1 means below the horizon. */
  sunX: number
  sunY: number
  sunColor: string
  moonOpacity: number
  starOpacity: number
  /** 0 by day, 1 at night: windows, lanterns and fairy lights. */
  lamps: number
  cloudColor: string
  cloudOpacity: number
}

interface Key {
  minute: number
  top: string
  middle: string
  horizon: string
  seaFar: string
  seaNear: string
  glow: string
  tint: string
  tintOpacity: number
  sunColor: string
  cloudColor: string
}

const h = (hour: number, minute = 0) => hour * 60 + minute

/** Keyframes through the day; anything between is blended. */
const KEYS: Key[] = [
  { minute: h(6), top: '#3a4a8c', middle: '#c58bb0', horizon: '#ffc59a', seaFar: '#6f7fb3', seaNear: '#3d5a8a', glow: '#ffb27a', tint: '#7c6bb0', tintOpacity: 0.25, sunColor: '#ffb36b', cloudColor: '#f6c9c3' },
  { minute: h(9), top: '#5cb8ec', middle: '#a6dcf6', horizon: '#fff1d2', seaFar: '#5ec4dc', seaNear: '#1f8fb0', glow: '#fff3c4', tint: '#fff3d6', tintOpacity: 0.05, sunColor: '#fff2b0', cloudColor: '#ffffff' },
  { minute: h(13), top: '#2f9fe0', middle: '#7fcdf3', horizon: '#e4f6ff', seaFar: '#3fbcd6', seaNear: '#0d7fa5', glow: '#fffbe0', tint: '#ffffff', tintOpacity: 0, sunColor: '#fffbe6', cloudColor: '#ffffff' },
  { minute: h(16, 30), top: '#4aa6dc', middle: '#9fd2ee', horizon: '#ffe9bf', seaFar: '#4fb6cf', seaNear: '#16809f', glow: '#ffe7a8', tint: '#ffd9a0', tintOpacity: 0.08, sunColor: '#ffe9a0', cloudColor: '#fff6e6' },
  { minute: h(17, 45), top: '#5d8fd1', middle: '#f6b98a', horizon: '#ffcf7a', seaFar: '#e3a77a', seaNear: '#2f7c99', glow: '#ffb347', tint: '#ffad5c', tintOpacity: 0.18, sunColor: '#ffbe55', cloudColor: '#ffd3a8' },
  { minute: h(18, 30), top: '#3d4f96', middle: '#e8708a', horizon: '#ff9a4d', seaFar: '#e98a62', seaNear: '#3a5f8f', glow: '#ff7a3d', tint: '#ff7348', tintOpacity: 0.26, sunColor: '#ff7b3a', cloudColor: '#ff9f8a' },
  { minute: h(19, 15), top: '#26306b', middle: '#6b4e8f', horizon: '#d9787a', seaFar: '#6a5b8e', seaNear: '#26406b', glow: '#c76f8f', tint: '#4b3f8a', tintOpacity: 0.34, sunColor: '#ff6a3a', cloudColor: '#9a7aa8' },
  { minute: h(20, 30), top: '#0d1433', middle: '#1c2a5a', horizon: '#33467a', seaFar: '#24365f', seaNear: '#101d3d', glow: '#9fb6ff', tint: '#1b2a63', tintOpacity: 0.46, sunColor: '#ff6a3a', cloudColor: '#3a4775' },
  { minute: h(24), top: '#0a1029', middle: '#141f45', horizon: '#26375f', seaFar: '#1d2c50', seaNear: '#0b1532', glow: '#9fb6ff', tint: '#16225a', tintOpacity: 0.5, sunColor: '#ff6a3a', cloudColor: '#2c3866' },
]

/** Where the sea meets the sky, as a share of the scene's height. The sun sets exactly here. */
export const HORIZON = 0.6

/** The sun rises and sets at these minutes (sunset matches the game's 6:30 PM). */
export const SUNRISE = h(6, 15)
export const SUNSET = h(18, 40)

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Blends two #rrggbb colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[c(ar, br), c(ag, bg), c(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const smooth = (t: number) => t * t * (3 - 2 * t)

export function skyLook(minuteOfDay: number): SkyLook {
  const m = Math.min(KEYS[KEYS.length - 1].minute, Math.max(KEYS[0].minute, minuteOfDay))
  const i = Math.max(0, KEYS.findIndex((k) => k.minute > m) - 1)
  const a = KEYS[i]
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)]
  const t = b.minute === a.minute ? 0 : smooth((m - a.minute) / (b.minute - a.minute))
  const blend = (key: keyof Omit<Key, 'minute' | 'tintOpacity'>) => mix(a[key], b[key], t)

  // The sun climbs an arc from sunrise to sunset; after that it sinks below the horizon line.
  const day = clamp01((minuteOfDay - SUNRISE) / (SUNSET - SUNRISE))
  const sunX = 0.08 + day * 0.84
  const arc = Math.sin(Math.PI * day)
  const sunY = minuteOfDay >= SUNSET ? HORIZON + (minuteOfDay - SUNSET) / 60 : HORIZON - arc * 0.48

  const night = clamp01((minuteOfDay - h(19)) / 75)
  return {
    top: blend('top'),
    middle: blend('middle'),
    horizon: blend('horizon'),
    seaFar: blend('seaFar'),
    seaNear: blend('seaNear'),
    glow: blend('glow'),
    tint: blend('tint'),
    tintOpacity: a.tintOpacity + (b.tintOpacity - a.tintOpacity) * t,
    sunX,
    sunY,
    sunColor: blend('sunColor'),
    moonOpacity: night,
    starOpacity: clamp01((minuteOfDay - h(19, 15)) / 60),
    lamps: clamp01((minuteOfDay - h(18, 15)) / 60),
    cloudColor: blend('cloudColor'),
    cloudOpacity: 0.9 - night * 0.55,
  }
}
