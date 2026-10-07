import { TRAVEL_RULES } from '../../engine/config'
import { checkScooterRental, hasScooterToday, scooterFee } from '../../engine/travel'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { formatRupees } from '../format'
import { Button } from '../ui/Button'

/** Rent a scooter where you are. The engine decides if renting is allowed today. */
export function RentScooterRow() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  if (hasScooterToday(state)) {
    return (
      <div className="ask-local">
        <span className="ask-local__label">🛵 Your scooter is ready: rides are free today.</span>
      </div>
    )
  }
  const check = checkScooterRental(state)
  return (
    <div className="ask-local">
      <div className="ask-local__row">
        <span className="ask-local__label">
          🛵 Rent a scooter
          <span className="ask-local__meta">
            {' '}
            · {formatRupees(scooterFee(state))}/day · {TRAVEL_RULES.scooterRentalMinutes} min
          </span>
        </span>
        <Button size="sm" variant="sunset" disabled={!check.ok} onClick={() => dispatch({ type: 'RENT_SCOOTER' })}>
          Rent
        </Button>
      </div>
      {!check.ok && <p className="activity__reason">{check.reason}</p>}
    </div>
  )
}
