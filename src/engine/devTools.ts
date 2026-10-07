import type { GameAction, GameState } from '../types'
import { formatClock } from './clock'
import { DAY_END_MINUTE, DAY_START_MINUTE, ENERGY_MAX, ENERGY_MIN, GAME_CONFIG } from './config'
import { gameReducer } from './reducer'

/**
 * Developer tools for testing and recording. Each one only plans ordinary game actions; the
 * panel sends them through the same reducer as the real game, so every rule still applies.
 */

export type DevPlan = { ok: true; actions: GameAction[] } | { ok: false; reason: string }

/** The latest time a jump can land on: at 10 PM the day ends by itself. */
export const LATEST_JUMP_MINUTE = DAY_END_MINUTE - 1

/**
 * Jumps to a day and time the way the game would get there: end the day, sleep, start the next
 * one, then let time pass. Earlier than now starts a fresh trip first (time never runs backwards).
 */
export function planJump(state: GameState, day: number, minuteOfDay: number): DevPlan {
  if (!Number.isInteger(day) || day < 1 || day > GAME_CONFIG.tripDays) {
    return { ok: false, reason: `Choose a day from 1 to ${GAME_CONFIG.tripDays}.` }
  }
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < DAY_START_MINUTE || minuteOfDay > LATEST_JUMP_MINUTE) {
    return { ok: false, reason: `Choose a time from ${formatClock(DAY_START_MINUTE)} to ${formatClock(LATEST_JUMP_MINUTE)}.` }
  }

  const actions: GameAction[] = []
  let s = state
  const step = (action: GameAction) => {
    actions.push(action)
    s = gameReducer(s, action)
  }
  // Already past that moment (or that day is over): start again, since time never runs backwards.
  const sameDay = s.clock.day === day
  const behind =
    s.clock.day > day || (sameDay && (s.phase === 'day-summary' || (s.phase === 'playing' && s.clock.minuteOfDay > minuteOfDay)))
  if (behind || s.phase === 'ended') step({ type: 'RESET_GAME' })

  // At most a few steps per day; the limit only guards against a rule that stops the day moving on.
  for (let guard = 0; guard < 20 && !(s.phase === 'playing' && s.clock.day === day); guard++) {
    if (s.activeEvent) return { ok: false, reason: 'An event is waiting: choose an option first.' }
    if (s.phase === 'day-intro') step({ type: 'BEGIN_DAY' })
    else if (s.phase === 'day-summary') step({ type: 'CONTINUE_AFTER_SUMMARY' })
    else if (s.phase === 'playing') step({ type: 'END_DAY' })
    if (s.phase === 'ended') return { ok: false, reason: 'That would end the trip before reaching it.' }
  }
  if (!(s.phase === 'playing' && s.clock.day === day)) return { ok: false, reason: `Could not reach Day ${day}.` }
  if (s.activeEvent) return { ok: false, reason: 'An event is waiting: choose an option first.' }
  if (minuteOfDay > s.clock.minuteOfDay) step({ type: 'ADVANCE_TIME', minutes: minuteOfDay - s.clock.minuteOfDay })
  return { ok: true, actions }
}

/** Money to an exact amount: spending (counts as money spent) to go down, receiving to go up. */
export function planSetMoney(state: GameState, money: number): DevPlan {
  if (!Number.isInteger(money) || money < 0) return { ok: false, reason: 'Money must be a whole number, 0 or more.' }
  const diff = money - state.player.money
  if (diff === 0) return { ok: true, actions: [] }
  return { ok: true, actions: [diff > 0 ? { type: 'RECEIVE_MONEY', amount: diff } : { type: 'SPEND_MONEY', amount: -diff }] }
}

export function planSetEnergy(state: GameState, energy: number): DevPlan {
  if (!Number.isInteger(energy) || energy < ENERGY_MIN || energy > ENERGY_MAX) {
    return { ok: false, reason: `Energy must be from ${ENERGY_MIN} to ${ENERGY_MAX}.` }
  }
  const delta = energy - state.player.energy
  return { ok: true, actions: delta === 0 ? [] : [{ type: 'CHANGE_ENERGY', delta }] }
}
