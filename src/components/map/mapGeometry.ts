// Shared coordinate system for the SVG map. Location data stores positions as percentages.
export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 560

type Pct = readonly [number, number]

export function toMap([x, y]: Pct): [number, number] {
  return [(x / 100) * MAP_WIDTH, (y / 100) * MAP_HEIGHT]
}

function polygon(points: Pct[]): string {
  return points.map((p) => toMap(p).join(',')).join(' ')
}

function smoothPath(points: Pct[]): string {
  // Catmull-Rom-ish smoothing via quadratic midpoints keeps the coastline organic.
  const pts = points.map(toMap)
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i]
    const [nx, ny] = pts[i + 1]
    d += ` Q${cx},${cy} ${(cx + nx) / 2},${(cy + ny) / 2}`
  }
  const last = pts[pts.length - 1]
  return `${d} L${last[0]},${last[1]}`
}

/*
 * The SVG uses preserveAspectRatio "meet", so on panels wider or taller than 1000×560 the area
 * outside the viewBox is still painted. Everything below therefore extends past 0–100% (BLEED)
 * so the sea and land always reach the panel edges.
 */
const BLEED = 150

// Stylised Goa coastline, north (top) to south (bottom). The Arabian Sea is to the west.
const COAST: Pct[] = [
  [-10, -60],
  [12, 0],
  [15.5, 11],
  [19.5, 20],
  [23.5, 30],
  [27, 36],
  [30, 40],
  [33, 45],
  [36, 49],
  [44, 60],
  [52, 71],
  [59, 80],
  [65.5, 87.5],
  [70, 94],
  [74, 100],
  [90, 160],
]

const FAR_EAST = 100 + BLEED
const FAR_NORTH = -BLEED
const FAR_SOUTH = 100 + BLEED
const FAR_WEST = -BLEED

/** The land mass: the coastline closed off far to the east. */
export const LAND_PATH = `${smoothPath(COAST)} L${toMap([FAR_EAST, 160]).join(',')} L${toMap([FAR_EAST, -60]).join(',')} Z`

/** Sea rectangle covering the viewBox plus the bleed on every side. */
export const SEA_RECT = (() => {
  const [x, y] = toMap([FAR_WEST, FAR_NORTH])
  const [x2, y2] = toMap([FAR_EAST, FAR_SOUTH])
  return { x, y, width: x2 - x, height: y2 - y }
})()

export const COAST_PATH = smoothPath(COAST)

export const RIVERS = {
  mandovi: smoothPath([
    [30.5, 40.5],
    [36, 42.5],
    [44, 43],
    [52, 41.5],
    [62, 44],
    [74, 42],
  ]),
  zuari: smoothPath([
    [45, 61.5],
    [52, 60],
    [60, 62],
    [70, 59.5],
    [82, 61],
  ]),
}

/** Full-width bands, clipped to the land, that tint the three regions. The rivers mark the borders. */
export const REGIONS = [
  {
    id: 'north',
    label: 'NORTH GOA',
    labelAt: toMap([62, 16]),
    points: polygon([
      [FAR_WEST, FAR_NORTH],
      [FAR_EAST, FAR_NORTH],
      [FAR_EAST, 41],
      [74, 42],
      [62, 44],
      [52, 41.5],
      [44, 43],
      [36, 42.5],
      [FAR_WEST, 41],
    ]),
  },
  {
    id: 'central',
    label: 'CENTRAL GOA',
    labelAt: toMap([72, 52]),
    points: polygon([
      [FAR_WEST, 41],
      [36, 42.5],
      [44, 43],
      [52, 41.5],
      [62, 44],
      [74, 42],
      [FAR_EAST, 41],
      [FAR_EAST, 61],
      [82, 61],
      [70, 59.5],
      [60, 62],
      [52, 60],
      [FAR_WEST, 61],
    ]),
  },
  {
    id: 'south',
    label: 'SOUTH GOA',
    labelAt: toMap([86, 76]),
    points: polygon([
      [FAR_WEST, 61],
      [52, 60],
      [60, 62],
      [70, 59.5],
      [82, 61],
      [FAR_EAST, 61],
      [FAR_EAST, FAR_SOUTH],
      [FAR_WEST, FAR_SOUTH],
    ]),
  },
] as const

/** Western Ghats hills along the eastern edge. */
export const HILLS: Pct[] = [
  [93, 10],
  [97, 22],
  [91, 32],
  [96, 70],
  [92, 88],
  [97, 95],
]

/** Little wave marks in the sea. */
export const WAVES: Pct[] = [
  [4, 12],
  [8, 30],
  [3, 50],
  [14, 62],
  [24, 80],
  [10, 90],
  [38, 92],
]
