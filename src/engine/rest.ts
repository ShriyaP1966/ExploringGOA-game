import type { GameState } from '../types'
import { advanceTime, formatClock } from './clock'
import { DAY_END_MINUTE, ENERGY_MAX, REST_RULES } from './config'
import { changeEnergy } from './player'

export type RestCheck = { ok: true } | { ok: false; reason: string }

export function checkRest(state: GameState): RestCheck {
  if (state.player.energy >= ENERGY_MAX) return { ok: false, reason: 'You are full of energy: no need to rest.' }
  if (state.clock.minuteOfDay + REST_RULES.minutes > DAY_END_MINUTE) {
    return { ok: false, reason: `It is nearly ${formatClock(DAY_END_MINUTE)}: end the day and sleep instead.` }
  }
  return { ok: true }
}

/** Rest where you are: free, takes an hour, restores some energy. */
export function rest(state: GameState): GameState {
  const check = checkRest(state)
  if (!check.ok) return { ...state, notice: check.reason }
  const rested = changeEnergy(advanceTime(state, REST_RULES.minutes), REST_RULES.energy)
  const gained = rested.player.energy - state.player.energy
  return { ...rested, notice: `😌 You rest in the shade for an hour. ⚡+${gained}` }
}
