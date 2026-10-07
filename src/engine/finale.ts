import { LOCATIONS } from '../data/locations'
import type { EndingQuality, FinalSunset, FinalSunsetFactors, GameState } from '../types'
import { formatClock } from './clock'
import { FINALE_RULES } from './config'
import { dayRules, passTime } from './days'
import { isLocationDiscovered, startingDiscoveredLocationIds } from './locations'

export type FinaleCheck = { ok: true } | { ok: false; reason: string }

/** When you got to where you are now today (the start of the day if you woke up here). */
export function arrivalMinuteHere(state: GameState): number {
  const arrivals = state.tripLog.filter((t) => t.day === state.clock.day && t.to === state.currentLocationId)
  return arrivals.length > 0 ? arrivals[arrivals.length - 1].arrivalMinute : 0
}

/** Reads the real game state: how well-earned would a final sunset here be right now? */
export function assessFinalSunset(state: GameState): Omit<FinalSunset, 'day' | 'minuteOfDay'> {
  const here = state.currentLocationId
  const factors: FinalSunsetFactors = {
    arrivedBeforeSunset: arrivalMinuteHere(state) <= FINALE_RULES.arriveBy,
    energyLeft: state.player.energy >= FINALE_RULES.energyLeftAtLeast,
    memories: state.player.memories.length,
    selfDiscovered: isLocationDiscovered(state, here) && !startingDiscoveredLocationIds().includes(here),
    outOfResources: state.player.energy <= 0 || state.player.money <= 0,
  }
  const memoryPoints =
    factors.memories >= FINALE_RULES.memoriesForTwoPoints ? 2 : factors.memories >= FINALE_RULES.memoriesForOnePoint ? 1 : 0
  const points =
    Number(factors.arrivedBeforeSunset) + Number(factors.energyLeft) + memoryPoints + Number(factors.selfDiscovered)

  // Out of energy or money: a smaller, quiet ending rather than none at all.
  const tier = factors.outOfResources
    ? FINALE_RULES.qualities[FINALE_RULES.qualities.length - 1]
    : FINALE_RULES.qualities.find((q) => points >= q.minPoints)!
  return {
    locationId: here,
    factors,
    points,
    quality: tier.quality as EndingQuality,
    xp: tier.xp,
    scoreBonus: tier.scoreBonus,
  }
}

export function checkFinalSunset(state: GameState): FinaleCheck {
  if (!dayRules(state).finaleSunset) return { ok: false, reason: 'Your final sunset is on the last day of the trip.' }
  if (state.finalSunset) return { ok: false, reason: 'You have already watched your final sunset.' }
  if (!isLocationDiscovered(state, state.currentLocationId)) {
    return { ok: false, reason: 'Choose a place you have discovered for your final sunset.' }
  }
  if (state.clock.minuteOfDay > FINALE_RULES.lastStart) {
    return {
      ok: false,
      reason: `The sun has already set (it is gone after ${formatClock(FINALE_RULES.lastStart)}). Your trip will end quietly tonight.`,
    }
  }
  return { ok: true }
}

function record(state: GameState): FinalSunset {
  return { ...assessFinalSunset(state), day: state.clock.day, minuteOfDay: state.clock.minuteOfDay }
}

const QUALITY_TEXT: Record<EndingQuality, string> = {
  legendary: 'Everything came together: the perfect last sunset.',
  golden: 'A golden evening to end the trip.',
  warm: 'A warm, happy end to the trip.',
  quiet: 'A quiet, simple goodbye to Goa.',
}

export function qualityText(quality: EndingQuality): string {
  return QUALITY_TEXT[quality]
}

/** Watch the final sunset where you are. Costs no money or energy; if it's early, you wait for the evening. */
export function watchFinalSunset(state: GameState): GameState {
  const check = checkFinalSunset(state)
  if (!check.ok) return { ...state, notice: check.reason }

  const waited = state.clock.minuteOfDay < FINALE_RULES.waitUntil
  const ready = waited ? passTime(state, FINALE_RULES.waitUntil - state.clock.minuteOfDay) : state
  const finalSunset = record(ready)
  const after = passTime(ready, FINALE_RULES.watchMinutes)
  const name = LOCATIONS[finalSunset.locationId].name
  return {
    ...after,
    finalSunset,
    notice: `🌇 ${waited ? 'You wait for the evening, then watch' : 'You watch'} your final sunset from ${name}. ${qualityText(finalSunset.quality)}`,
  }
}

/** On the last day, a sunset activity counts as choosing this place for the final sunset (assessed as it starts). */
export function finalSunsetFromActivity(stateAtStart: GameState, after: GameState): GameState {
  if (checkFinalSunset(stateAtStart).ok === false) return after
  return { ...after, finalSunset: record(stateAtStart) }
}
