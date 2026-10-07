import { TRAVEL_MODES } from '../../data/travel'
import { formatDuration } from '../../engine/clock'
import { getRoute } from '../../engine/locations'
import { checkScooterRental, hasScooterToday, quoteTravel, scooterFee } from '../../engine/travel'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { LocationId, TravelModeId } from '../../types'
import { formatRupees } from '../format'
import { Button } from '../ui/Button'

const MODES: TravelModeId[] = ['walk', 'scooter', 'taxi']

/** Shows each way to reach a place. The engine decides what is allowed; this only displays and dispatches. */
export function TravelOptions({ to }: { to: LocationId }) {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const route = getRoute(state.currentLocationId, to)
  if (!route) return null

  const rental = checkScooterRental(state)

  return (
    <section className="travel-options" aria-label="Travel options">
      <h4 className="location-details__subtitle">
        Travel here <span className="travel-options__distance">· {route.distanceKm} km away</span>
      </h4>

      <ul className="travel-options__list">
        {MODES.map((mode) => {
          const info = TRAVEL_MODES[mode]
          const leg = route.modes[mode]
          const check = quoteTravel(state, to, mode)
          const canRentHere = mode === 'scooter' && !hasScooterToday(state) && rental.ok

          return (
            <li key={mode} className={`travel-option ${check.ok ? '' : 'travel-option--blocked'}`}>
              <div className="travel-option__row">
                <span className="travel-option__mode">
                  {info.emoji} {info.label}
                </span>
                <span className="travel-option__meta">
                  🕘 {formatDuration(leg.minutes)} · {leg.cost === 0 ? 'Free' : formatRupees(leg.cost)}
                  {check.ok && ` · ⚡ −${check.quote.energy}`}
                </span>
                {canRentHere ? (
                  <Button size="sm" variant="sunset" onClick={() => dispatch({ type: 'RENT_SCOOTER' })}>
                    Rent {formatRupees(scooterFee(state))}/day
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!check.ok}
                    onClick={() => dispatch({ type: 'TRAVEL', to, mode })}
                    aria-label={`Travel by ${info.label.toLowerCase()}`}
                  >
                    Go
                  </Button>
                )}
              </div>
              {!check.ok && <p className="travel-option__reason">{check.reason}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
