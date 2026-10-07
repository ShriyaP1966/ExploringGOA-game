import { LOCATIONS } from '../data/locations'
import { TRAVEL_MODES } from '../data/travel'
import type { GameState, LocationId, Region, TravelModeId } from '../types'

const REGION_NAMES: Record<Region, string> = { north: 'North Goa', central: 'Central Goa', south: 'South Goa' }
import { advanceTime, formatClock, formatDuration } from './clock'
import { DAY_END_MINUTE, LEVEL_PERKS, TRAVEL_RULES } from './config'
import { dayInfo, dayRules, firstDayWhere } from './days'
import { heatPenalty } from './items'
import { discoveryText, getRoute, isLocationDiscovered, isLocationVisible, markDiscovered } from './locations'
import { changeEnergy, spendMoney } from './player'
import { rupees } from './utils'

export interface TravelQuote {
  to: LocationId
  mode: TravelModeId
  distanceKm: number
  minutes: number
  cost: number
  energy: number
}

export type TravelCheck = { ok: true; quote: TravelQuote } | { ok: false; reason: string }

export type RentalCheck = { ok: true } | { ok: false; reason: string }

/** Energy a trip uses. Any trip costs at least 1. */
export function travelEnergy(distanceKm: number, mode: TravelModeId): number {
  return Math.max(1, Math.ceil(distanceKm * TRAVEL_MODES[mode].energyPerKm))
}

/** The day rental fee, with the Explorer discount from level 2. */
export function scooterFee(state: GameState): number {
  const discounted = state.player.level >= LEVEL_PERKS.scooterDiscountFromLevel
  return Math.round(TRAVEL_RULES.scooterDayFee * (discounted ? 1 - LEVEL_PERKS.scooterDiscount : 1))
}

export function hasScooterToday(state: GameState): boolean {
  return state.scooterRentedOnDay === state.clock.day
}

export function checkScooterRental(state: GameState): RentalCheck {
  if (!dayRules(state).scooterRental) {
    const from = firstDayWhere((rules) => rules.scooterRental)
    return {
      ok: false,
      reason: `Scooter shops need a day to check your licence.${from ? ` You can rent one from Day ${from}.` : ''}`,
    }
  }
  if (hasScooterToday(state)) return { ok: false, reason: 'You already have a scooter for today.' }
  if (state.clock.minuteOfDay + TRAVEL_RULES.scooterRentalMinutes > DAY_END_MINUTE) {
    return { ok: false, reason: 'The rental shops have closed for the night.' }
  }
  if (state.player.money < scooterFee(state)) {
    return {
      ok: false,
      reason: `Not enough money to rent a scooter: it costs ${rupees(scooterFee(state))} for the day, you have ${rupees(state.player.money)}.`,
    }
  }
  return { ok: true }
}

export function rentScooter(state: GameState): GameState {
  const check = checkScooterRental(state)
  if (!check.ok) return { ...state, notice: check.reason }
  const paid = advanceTime(spendMoney(state, scooterFee(state)), TRAVEL_RULES.scooterRentalMinutes)
  return {
    ...paid,
    scooterRentedOnDay: state.clock.day,
    notice: `🛵 Scooter rented for Day ${state.clock.day} (${rupees(scooterFee(state))}${scooterFee(state) < TRAVEL_RULES.scooterDayFee ? ", Explorer discount" : ""}). No fuel needed, so every ride today is free.`,
  }
}

/** Name to use in messages: undiscovered places stay anonymous. */
function placeName(state: GameState, id: LocationId): string {
  return isLocationDiscovered(state, id) ? LOCATIONS[id].name : 'that unexplored place'
}

/** Checks every travel rule without changing anything. The UI uses this to show options and reasons. */
export function quoteTravel(state: GameState, to: LocationId, mode: TravelModeId): TravelCheck {
  if (to === state.currentLocationId) return { ok: false, reason: `You're already at ${LOCATIONS[to].name}.` }
  if (!isLocationVisible(state, to)) return { ok: false, reason: "You don't know of any place like that yet." }

  const route = getRoute(state.currentLocationId, to)
  if (!route) return { ok: false, reason: 'There is no way to get there from here.' }

  const name = placeName(state, to)
  const today = dayInfo(state.clock.day)
  const region = LOCATIONS[to].region
  if (!today.rules.regions.includes(region)) {
    const opens = firstDayWhere((rules) => rules.regions.includes(region))
    return {
      ok: false,
      reason: `Day ${today.day} is for settling in around North Goa.${opens ? ` Trips to ${REGION_NAMES[region]} open on Day ${opens}.` : ''}`,
    }
  }
  const leg = route.modes[mode]
  const quote: TravelQuote = {
    to,
    mode,
    distanceKm: route.distanceKm,
    minutes: leg.minutes,
    cost: leg.cost,
    // Walking in the midday heat is extra tiring (less so with sunglasses).
    energy: travelEnergy(route.distanceKm, mode) + (mode === 'walk' ? heatPenalty(state) : 0),
  }

  if (mode === 'walk' && route.distanceKm > TRAVEL_RULES.walkMaxKm) {
    return {
      ok: false,
      reason: `Too far to walk: ${name} is ${route.distanceKm} km away (${TRAVEL_RULES.walkMaxKm} km at most). Take a scooter or a taxi.`,
    }
  }

  if (mode === 'scooter' && !hasScooterToday(state)) {
    const rental = checkScooterRental(state)
    return {
      ok: false,
      reason: rental.ok ? `Rent a scooter first (${rupees(scooterFee(state))} for the day).` : rental.reason,
    }
  }

  if (quote.cost > state.player.money) {
    return {
      ok: false,
      reason: `Not enough money: the ${TRAVEL_MODES[mode].label.toLowerCase()} costs ${rupees(quote.cost)}, you have ${rupees(state.player.money)}.`,
    }
  }

  if (quote.energy > state.player.energy) {
    return {
      ok: false,
      reason: `Too tired: this trip needs ⚡${quote.energy} energy and you have ⚡${state.player.energy}. Rest or eat first, or choose an easier way to travel.`,
    }
  }

  if (state.clock.minuteOfDay + quote.minutes > DAY_END_MINUTE) {
    return {
      ok: false,
      reason: `Not enough time left today: the trip takes ${formatDuration(quote.minutes)} and you must arrive by ${formatClock(DAY_END_MINUTE)}.`,
    }
  }

  return { ok: true, quote }
}

const TRIP_VERB: Record<TravelModeId, string> = {
  walk: 'Walked',
  scooter: 'Rode your scooter',
  taxi: 'Took a taxi',
}

export function travel(state: GameState, to: LocationId, mode: TravelModeId): GameState {
  const check = quoteTravel(state, to, mode)
  if (!check.ok) return { ...state, notice: check.reason }
  const { quote } = check

  const isNewPlace = !isLocationDiscovered(state, to)
  let next = spendMoney(state, quote.cost)
  next = changeEnergy(next, -quote.energy)
  next = advanceTime(next, quote.minutes)
  // Arriving somewhere new reveals it on the map, counts it and earns XP.
  // You are there before you discover it, so any memory is stamped at the new place.
  next = markDiscovered({ ...next, currentLocationId: to }, to)

  const location = LOCATIONS[to]
  const costText = quote.cost > 0 ? ` · ${rupees(quote.cost)}` : ''
  const discoveredText = isNewPlace ? ` ${discoveryText(to)}` : ''

  return {
    ...next,
    player: {
      ...next.player,
      stats: { ...next.player.stats, kmTraveled: next.player.stats.kmTraveled + quote.distanceKm },
    },
    currentLocationId: to,
    visitedLocationIds: next.visitedLocationIds.includes(to) ? next.visitedLocationIds : [...next.visitedLocationIds, to],
    // A local's offer stays where you met them.
    pendingHelp: null,
    tripLog: [
      ...next.tripLog,
      {
        day: state.clock.day,
        minuteOfDay: state.clock.minuteOfDay,
        arrivalMinute: state.clock.minuteOfDay + quote.minutes,
        from: state.currentLocationId,
        to,
        mode,
        distanceKm: quote.distanceKm,
      },
    ],
    notice:
      `${TRAVEL_MODES[mode].emoji} ${TRIP_VERB[mode]} to ${location.name}: ` +
      `${formatDuration(quote.minutes)} · ${quote.distanceKm} km · ⚡−${quote.energy}${costText}.${discoveredText}`,
  }
}
