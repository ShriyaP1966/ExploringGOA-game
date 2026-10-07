import type { GameState, SkyPhase } from '../types'
import { MINUTES_PER_DAY, SUNSET_MINUTE } from './config'
import { isPositiveAmount } from './utils'

export function advanceTime(state: GameState, minutes: number): GameState {
  if (!isPositiveAmount(minutes)) return state
  const total = state.clock.minuteOfDay + Math.round(minutes)
  return {
    ...state,
    clock: {
      day: state.clock.day + Math.floor(total / MINUTES_PER_DAY),
      minuteOfDay: total % MINUTES_PER_DAY,
    },
  }
}

/** The colour of the sky at a given time; sunset is around 6:30 PM. */
export function skyPhase(minuteOfDay: number): SkyPhase {
  if (minuteOfDay < 12 * 60) return 'morning'
  if (minuteOfDay < 16 * 60 + 30) return 'afternoon'
  if (minuteOfDay < SUNSET_MINUTE - 30) return 'golden'
  if (minuteOfDay < SUNSET_MINUTE + 30) return 'sunset'
  if (minuteOfDay < 20 * 60) return 'dusk'
  return 'night'
}

/** 45 -> "45 min", 60 -> "1 h", 75 -> "1 h 15 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** 540 -> "9:00 AM", 0 -> "12:00 AM", 795 -> "1:15 PM". */
export function formatClock(minuteOfDay: number): string {
  const hours24 = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  const suffix = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}
