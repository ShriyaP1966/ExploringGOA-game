import { memo } from 'react'
import {
  COAST_PATH,
  HILLS,
  LAND_PATH,
  MAP_HEIGHT,
  MAP_WIDTH,
  REGIONS,
  RIVERS,
  SEA_RECT,
  WAVES,
  toMap,
} from './mapGeometry'

// Static backdrop: sea, land, regions, rivers and decorations. Never changes, so it is memoised.
export const GoaCoastline = memo(function GoaCoastline() {
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id="goa-land">
          <path d={LAND_PATH} />
        </clipPath>
        <linearGradient id="goa-sea" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="var(--sky)" />
          <stop offset="100%" stopColor="var(--ocean)" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect {...SEA_RECT} fill="url(#goa-sea)" />
      {WAVES.map((p) => {
        const [x, y] = toMap(p)
        return (
          <path
            key={`${x}-${y}`}
            className="goa-map__wave"
            d={`M${x - 18},${y} q9,-8 18,0 t18,0`}
          />
        )
      })}
      <text className="goa-map__sea-label" x={toMap([9, 74])[0]} y={toMap([9, 74])[1]} transform={`rotate(-58 ${toMap([9, 74]).join(' ')})`}>
        Arabian Sea
      </text>

      {/* Sandy shore under the land so the coast gets a beach edge */}
      <path d={COAST_PATH} className="goa-map__beach" />

      <g clipPath="url(#goa-land)">
        {REGIONS.map((region) => (
          <polygon key={region.id} points={region.points} className={`goa-map__region goa-map__region--${region.id}`} />
        ))}
        <path d={RIVERS.mandovi} className="goa-map__river" />
        <path d={RIVERS.zuari} className="goa-map__river" />
      </g>

      {REGIONS.map((region) => (
        <text key={region.id} className="goa-map__region-label" x={region.labelAt[0]} y={region.labelAt[1]}>
          {region.label}
        </text>
      ))}

      {HILLS.map((p) => {
        const [x, y] = toMap(p)
        return <path key={`${x}-${y}`} className="goa-map__hill" d={`M${x - 16},${y + 10} L${x},${y - 12} L${x + 16},${y + 10} Z`} />
      })}

      <g className="goa-map__compass" transform={`translate(${MAP_WIDTH - 50} ${MAP_HEIGHT - 50})`}>
        <circle r="20" />
        <path d="M0,-14 L6,4 L0,0 L-6,4 Z" />
        <text y="-24">N</text>
      </g>
    </g>
  )
})
