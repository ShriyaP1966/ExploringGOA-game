import { DAYS } from '../data/days'
import type { DayEndReason, DayInfo, DayRules, DayStartSnapshot, DaySummary, GameState } from '../types'
import { advanceTime } from './clock'
import { BUDGET_RULES, DAY_END_MINUTE, DAY_START_MINUTE, ENERGY_MAX, GAME_CONFIG, SLEEP_RULES, XP_REWARDS } from './config'
import { addXp } from './player'

export function dayInfo(day: number): DayInfo {
  return DAYS[Math.min(Math.max(day, 1), GAME_CONFIG.tripDays)]
}

export function dayRules(state: GameState): DayRules {
  return dayInfo(state.clock.day).rules
}

export function isFinalDay(state: GameState): boolean {
  return state.clock.day >= GAME_CONFIG.tripDays
}

/** The first day a rule becomes true, e.g. when scooters unlock. */
export function firstDayWhere(test: (rules: DayRules) => boolean): number | null {
  for (let day = 1; day <= GAME_CONFIG.tripDays; day++) if (test(dayInfo(day).rules)) return day
  return null
}

export function snapshotDayStart(state: GameState): DayStartSnapshot {
  return {
    money: state.player.money,
    moneySpent: state.player.stats.moneySpent,
    xp: state.player.xp,
    kmTraveled: state.player.stats.kmTraveled,
    discoveredLocationIds: [...state.discoveredLocationIds],
    locationId: state.currentLocationId,
  }
}

/** Advances the clock but never past 10 PM. The reducer ends the day when 10 PM is reached. */
export function passTime(state: GameState, minutes: number): GameState {
  const allowed = Math.min(minutes, DAY_END_MINUTE - state.clock.minuteOfDay)
  return allowed > 0 ? advanceTime(state, allowed) : state
}

export function isDayOver(state: GameState): boolean {
  return state.clock.minuteOfDay >= DAY_END_MINUTE
}

export function sleepRestore(state: GameState, endedBy: DayEndReason): number {
  const early = endedBy === 'player' && state.clock.minuteOfDay < SLEEP_RULES.earlyBedBefore
  return early ? SLEEP_RULES.earlyBedRestore : SLEEP_RULES.restore
}

/** A good decision: you did something today and kept spending within the daily budget. */
export function stayedUnderBudget(state: GameState): boolean {
  const spentToday = state.player.stats.moneySpent - state.dayStart.moneySpent
  const didSomething = state.completedActivities.some((a) => a.day === state.clock.day)
  return didSomething && spentToday <= BUDGET_RULES.dailyBudget
}

export function buildDaySummary(state: GameState, endedBy: DayEndReason): DaySummary {
  const start = state.dayStart
  const lastDay = isFinalDay(state) || endedBy === 'final-sunset'
  return {
    day: state.clock.day,
    endedBy,
    moneySpent: state.player.stats.moneySpent - start.moneySpent,
    moneyLeft: state.player.money,
    xpEarned: state.player.xp - start.xp,
    kmTraveled: state.player.stats.kmTraveled - start.kmTraveled,
    discovered: state.discoveredLocationIds.filter((id) => !start.discoveredLocationIds.includes(id)),
    activityIds: state.completedActivities.filter((a) => a.day === state.clock.day).map((a) => a.activityId),
    underBudget: stayedUnderBudget(state),
    nextMorningEnergy: lastDay ? null : Math.min(ENERGY_MAX, state.player.energy + sleepRestore(state, endedBy)),
  }
}

/**
 * Closes the day and shows its summary. On the last day (or once the Final Sunset quest ends the trip)
 * the trip ends: straight to the My Goa Summer recap, with the day's summary still recorded.
 */
export function endDay(state: GameState, endedBy: DayEndReason): GameState {
  if (state.phase !== 'playing') return state
  // The budget bonus is awarded first, so it shows in the day's XP.
  const rewarded = stayedUnderBudget(state) ? addXp(state, XP_REWARDS.underBudgetDay) : state
  const summary = buildDaySummary(rewarded, endedBy)
  const ending = endedBy === 'final-sunset' ? 'final-sunset' : isFinalDay(state) ? 'trip-over' : null
  const tripEnding = state.ending ?? ending
  return {
    ...rewarded,
    phase: tripEnding ? 'ended' : 'day-summary',
    daySummaries: [...state.daySummaries, summary],
    ending: tripEnding,
    notice: tripEnding ? '🌇 Your trip is over.' : `🌙 Day ${state.clock.day} is over. Time to sleep.`,
  }
}

/** From the summary: either the trip is over, or wake up on the next day at 9 AM. */
export function continueAfterSummary(state: GameState): GameState {
  if (state.phase !== 'day-summary') return state
  if (state.ending) return { ...state, phase: 'ended' }

  const summary = state.daySummaries[state.daySummaries.length - 1]
  const morning: GameState = {
    ...state,
    clock: { day: state.clock.day + 1, minuteOfDay: DAY_START_MINUTE },
    player: { ...state.player, energy: summary.nextMorningEnergy ?? state.player.energy },
    phase: 'day-intro',
    notice: `☀️ Good morning! Day ${state.clock.day + 1} is ready when you are.`,
  }
  return { ...morning, dayStart: snapshotDayStart(morning) }
}

export function beginDay(state: GameState): GameState {
  if (state.phase !== 'day-intro') return state
  const info = dayInfo(state.clock.day)
  return { ...state, phase: 'playing', notice: `${info.emoji} Day ${info.day} begins: ${info.title}. ${info.tagline}` }
}
