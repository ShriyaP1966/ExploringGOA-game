import type { KeyboardEvent } from 'react'
import { LOCATIONS } from '../../data/locations'
import type { MapPinStatus } from '../../engine/locations'
import type { LocationId } from '../../types'
import { toMap } from './mapGeometry'

interface MapPinProps {
  locationId: LocationId
  status: Exclude<MapPinStatus, 'hidden'>
  selected: boolean
  /** The tourist map has hinted at this unexplored place. */
  hinted?: boolean
  onSelect: (id: LocationId) => void
}

// Teardrop with its tip at (0,0) and a round head centred at (0,-34).
const PIN_PATH = 'M0,0 C-6,-10 -18,-20 -18,-34 A18,18 0 1 1 18,-34 C18,-20 6,-10 0,0 Z'

export function MapPin({ locationId, status, selected, hinted = false, onSelect }: MapPinProps) {
  const location = LOCATIONS[locationId]
  const [x, y] = toMap([location.mapPosition.x, location.mapPosition.y])

  const select = () => onSelect(locationId)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select()
    }
  }

  if (status === 'fogged') {
    // No name: just a fogged question mark. Clicking it offers travel, which discovers the place.
    return (
      <g
        className={`map-pin map-pin--fogged ${hinted ? 'map-pin--hinted' : ''} ${selected ? 'map-pin--selected' : ''}`}
        transform={`translate(${x} ${y})`}
        role="button"
        tabIndex={0}
        aria-label={`Undiscovered place${hinted ? ' (marked on your map)' : ''}. Show travel options`}
        aria-pressed={selected}
        onClick={select}
        onKeyDown={onKeyDown}
      >
        <ellipse className="map-pin__fog" cx="0" cy="-26" rx="46" ry="34" />
        <path className="map-pin__body" d={PIN_PATH} />
        <text className="map-pin__glyph" y="-27">
          {hinted ? '!' : '?'}
        </text>
      </g>
    )
  }

  const labelWidth = location.name.length * 8.6 + 22

  return (
    <g
      className={`map-pin map-pin--${status} ${selected ? 'map-pin--selected' : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${location.name}${status === 'current' ? ' (you are here)' : ''}. Show details`}
      aria-pressed={selected}
      onClick={select}
      onKeyDown={onKeyDown}
    >
      {status === 'current' && <circle className="map-pin__pulse" cx="0" cy="0" r="10" />}
      <path className="map-pin__body" d={PIN_PATH} />
      <text className="map-pin__emoji" y="-28">
        {location.emoji}
      </text>
      {status === 'discovered' && (
        <g className="map-pin__check" transform="translate(14 -48)" aria-hidden="true">
          <circle r="8" />
          <path d="M-4,0 L-1,3 L4,-3" />
        </g>
      )}
      <g transform="translate(24 -46)">
        <rect className="map-pin__label-bg" width={labelWidth} height="26" rx="13" />
        <text className="map-pin__label" x={labelWidth / 2} y="18">
          {location.name}
        </text>
      </g>
    </g>
  )
}
