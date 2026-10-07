import { useState } from 'react'
import { LOCATIONS, LOCATION_IDS } from '../../data/locations'
import { mapPinStatus } from '../../engine/locations'
import { useGameState } from '../../hooks/useGame'
import type { LocationId } from '../../types'
import { GoaCoastline } from './GoaCoastline'
import { LocationDetails } from './LocationDetails'
import { MapPin } from './MapPin'
import { MAP_HEIGHT, MAP_WIDTH, toMap } from './mapGeometry'

export function WorldMap() {
  const state = useGameState()
  // Which details panel is open is view-only state; it never touches the game state.
  const [selectedId, setSelectedId] = useState<LocationId | null>(null)

  const pins = LOCATION_IDS.map((id) => ({ id, status: mapPinStatus(state, id) })).filter(
    (pin) => pin.status !== 'hidden',
  )
  const selectedStatus = selectedId ? mapPinStatus(state, selectedId) : null
  // Hidden places can never be open (guards against a reset while a panel is open).
  const openId = selectedStatus && selectedStatus !== 'hidden' ? selectedId : null
  const [fromX, fromY] = toMap([
    LOCATIONS[state.currentLocationId].mapPosition.x,
    LOCATIONS[state.currentLocationId].mapPosition.y,
  ])
  const routeTo = openId && openId !== state.currentLocationId ? LOCATIONS[openId].mapPosition : null

  return (
    <div className="world-map">
      <svg
        className="goa-map"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Map of Goa"
      >
        <GoaCoastline />
        {routeTo && (
          <line
            className="goa-map__route"
            x1={fromX}
            y1={fromY}
            x2={toMap([routeTo.x, routeTo.y])[0]}
            y2={toMap([routeTo.x, routeTo.y])[1]}
          />
        )}
        {pins.map(({ id, status }) =>
          status === 'hidden' ? null : (
            <MapPin
              key={id}
              locationId={id}
              status={status}
              hinted={state.hintedLocationIds.includes(id)}
              selected={id === openId}
              onSelect={(clicked) => setSelectedId(clicked === openId ? null : clicked)}
            />
          ),
        )}
      </svg>

      <ul className="map-legend" aria-label="Map legend">
        <li>
          <span className="map-legend__dot map-legend__dot--current" /> You are here
        </li>
        <li>
          <span className="map-legend__dot map-legend__dot--discovered" /> Discovered ({state.player.stats.placesDiscovered})
        </li>
        <li>
          <span className="map-legend__dot map-legend__dot--fogged" /> Unexplored: travel there to discover it
        </li>
        {state.hintedLocationIds.some((id) => mapPinStatus(state, id) === 'fogged') && (
          <li>
            <span className="map-legend__dot map-legend__dot--hinted" /> Marked by a hint
          </li>
        )}
      </ul>

      {openId && (
        <LocationDetails
          locationId={openId}
          isCurrent={openId === state.currentLocationId}
          isDiscovered={selectedStatus === 'current' || selectedStatus === 'discovered'}
          mapHint={state.hintedLocationIds.includes(openId) ? LOCATIONS[openId].mapHint : undefined}
          // Open on the side away from the pin so it never covers the place you clicked.
          side={LOCATIONS[openId].mapPosition.x > 50 ? 'left' : 'right'}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
