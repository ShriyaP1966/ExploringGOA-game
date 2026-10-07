import { formatDuration } from '../../engine/clock'
import { checkChoice, eventById, rideDestination, situationText } from '../../engine/events'
import { LOCATIONS } from '../../data/locations'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { EventOutcome, GameState } from '../../types'
import { formatRupees } from '../format'
import { Button } from '../ui/Button'

/** What a choice will do, shown before you pick it. */
function effects(state: GameState, outcome: EventOutcome): string[] {
  const list: string[] = []
  if (outcome.cost) list.push(`💸 ${formatRupees(outcome.cost)}`)
  if (!outcome.cost && !outcome.freeRide && (outcome.minutes || outcome.energyDelta)) list.push('Free')
  if (outcome.energyDelta) list.push(`⚡ ${outcome.energyDelta > 0 ? '+' : '−'}${Math.abs(outcome.energyDelta)}`)
  if (outcome.minutes) list.push(`🕘 ${formatDuration(outcome.minutes)}`)
  if (outcome.freeRide) {
    const to = rideDestination(state)
    list.push(to ? `🚗 Free ride to the nearest place you know (${LOCATIONS[to].name})` : '🚗 Free ride')
  }
  if (outcome.clueId) list.push('🗺️ Reveals a new place')
  if (outcome.xp) list.push(`✨ +${outcome.xp} XP`)
  return list
}

/** The waiting event: its situation and choices. The game waits until one is chosen. */
export function EventPopup() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  if (!state.activeEvent) return null
  const event = eventById(state.activeEvent.eventId)

  return (
    <div className="day-overlay event-overlay">
      <div className="day-card event-card" role="alertdialog" aria-modal="true" aria-labelledby="event-title">
        <p className="day-card__eyebrow">Something happened</p>
        <h2 id="event-title" className="day-card__title">
          {event.emoji} {event.title}
        </h2>
        <p className="event-card__situation">{situationText(state)}</p>
        <p className="event-card__prompt">What do you do?</p>
        <ul className="event-choices">
          {event.choices.map((choice, index) => {
            const check = checkChoice(state, choice)
            return (
              <li key={choice.id} className="event-choice">
                <Button
                  className="event-choice__button"
                  variant={index === 0 ? 'primary' : 'ghost'}
                  disabled={!check.ok}
                  onClick={() => dispatch({ type: 'CHOOSE_EVENT_OPTION', choiceId: choice.id })}
                >
                  {choice.label}
                </Button>
                <span className="event-choice__effects">
                  {check.ok ? effects(state, choice.outcome).join(' · ') || 'No cost' : check.reason}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
