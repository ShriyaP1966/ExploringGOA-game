import { EVENTS } from '../data/events'
import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type {
  EventChoice,
  EventCondition,
  EventId,
  EventTrigger,
  GameState,
  LocationId,
  RandomEvent,
} from '../types'
import { formatDuration } from './clock'
import { MINUTES_PER_DAY } from './config'
import { dayInfo, isDayOver, passTime } from './days'
import { removeItem } from './items'
import { discoveryText, findClue, getRoute, isLocationDiscovered, isLocationVisible, markDiscovered } from './locations'
import { recordMoment } from './memories'
import { addItem, addXp, changeEnergy, spendMoney } from './player'
import { nextRandom } from './random'
import { rupees } from './utils'

export type ChoiceCheck = { ok: true } | { ok: false; reason: string }

export function eventById(id: EventId): RandomEvent {
  const event = EVENTS.find((e) => e.id === id)
  if (!event) throw new Error(`Unknown event "${id}"`)
  return event
}

function absoluteMinute(day: number, minuteOfDay: number): number {
  return day * MINUTES_PER_DAY + minuteOfDay
}

function now(state: GameState): number {
  return absoluteMinute(state.clock.day, state.clock.minuteOfDay)
}

/** Evaluates an event condition against the real game state. Pure. */
export function checkEventCondition(state: GameState, condition: EventCondition, trigger: EventTrigger | null): boolean {
  const lastTrip = state.tripLog[state.tripLog.length - 1]
  const justTravelled = trigger === 'trip' && lastTrip !== undefined
  switch (condition.type) {
    case 'after':
      return trigger === condition.trigger
    case 'trip-mode':
      return justTravelled && lastTrip.mode === condition.mode
    case 'trip-distance-at-least':
      return justTravelled && lastTrip.distanceKm >= condition.km
    case 'location-in':
      return condition.locationIds.includes(state.currentLocationId)
    case 'money-at-most':
      return state.player.money <= condition.amount
    case 'money-at-least':
      return state.player.money >= condition.amount
    case 'energy-at-most':
      return state.player.energy <= condition.amount
    case 'energy-at-least':
      return state.player.energy >= condition.amount
    case 'time-between':
      return state.clock.minuteOfDay >= condition.from && state.clock.minuteOfDay <= condition.to
    case 'day-in':
      return condition.days.includes(state.clock.day)
    case 'quest-status':
      return state.quests.some((q) => q.questId === condition.questId && q.status === condition.status)
    case 'has-item':
      return state.player.inventory.some((e) => e.itemId === condition.itemId && e.quantity > 0)
    case 'lacks-clue':
      return !state.foundClueIds.includes(condition.clueId)
    case 'event-recently':
      return state.eventLog.some(
        (r) =>
          r.eventId === condition.eventId &&
          r.resolvedDay === state.clock.day &&
          now(state) - absoluteMinute(r.resolvedDay, r.resolvedMinute) <= condition.withinMinutes,
      )
    case 'all':
      return condition.conditions.every((c) => checkEventCondition(state, c, trigger))
    case 'any':
      return condition.conditions.some((c) => checkEventCondition(state, c, trigger))
    case 'not':
      return !checkEventCondition(state, condition.condition, trigger)
  }
}

export function isOnCooldown(state: GameState, event: RandomEvent): boolean {
  const last = [...state.eventLog].reverse().find((r) => r.eventId === event.id)
  return last !== undefined && now(state) - absoluteMinute(last.resolvedDay, last.resolvedMinute) < event.cooldownMinutes
}

/** Events whose conditions are all true right now and that are not cooling down. */
export function eligibleEvents(state: GameState, trigger: EventTrigger): RandomEvent[] {
  return EVENTS.filter(
    (event) => !isOnCooldown(state, event) && event.conditions.every((c) => checkEventCondition(state, c, trigger)),
  )
}

function activate(state: GameState, eventId: EventId): GameState {
  return {
    ...state,
    activeEvent: {
      eventId,
      day: state.clock.day,
      minuteOfDay: state.clock.minuteOfDay,
      locationId: state.currentLocationId,
    },
  }
}

/**
 * After a trip or activity: eligible events roll their probability in order and the first success
 * fires. At most one event at a time, and never during a pending event or once the day is over.
 */
export function maybeTriggerEvent(state: GameState, trigger: EventTrigger): GameState {
  if (state.activeEvent || state.phase !== 'playing' || state.ending || isDayOver(state)) return state
  let seed = state.rngSeed
  for (const event of eligibleEvents(state, trigger)) {
    const [roll, nextSeed] = nextRandom(seed)
    seed = nextSeed
    if (roll < event.probability) return activate({ ...state, rngSeed: seed }, event.id)
  }
  return { ...state, rngSeed: seed }
}

/** Developer tool: start an event regardless of its conditions. */
export function forceEvent(state: GameState, eventId: EventId): GameState {
  return state.activeEvent ? state : activate(state, eventId)
}

export function checkChoice(state: GameState, choice: EventChoice): ChoiceCheck {
  if (choice.requires && !checkEventCondition(state, choice.requires, null)) {
    return { ok: false, reason: choice.unavailableReason ?? 'Not possible right now.' }
  }
  return { ok: true }
}

/** The nearest other place you know of, that today's rules let you reach (for a free ride). */
export function rideDestination(state: GameState): LocationId | null {
  const regions = dayInfo(state.clock.day).rules.regions
  const options = LOCATION_IDS.filter(
    (id) =>
      id !== state.currentLocationId &&
      isLocationVisible(state, id) &&
      regions.includes(LOCATIONS[id].region) &&
      getRoute(state.currentLocationId, id),
  )
  options.sort((a, b) => getRoute(state.currentLocationId, a)!.distanceKm - getRoute(state.currentLocationId, b)!.distanceKm)
  return options[0] ?? null
}

/** A free car ride: no money, almost no energy, takes the taxi's time. */
function freeRide(state: GameState): { state: GameState; text: string } {
  const to = rideDestination(state)
  if (!to) return { state, text: '' }
  const route = getRoute(state.currentLocationId, to)!
  const leg = route.modes.taxi
  const isNew = !isLocationDiscovered(state, to)
  let next = passTime(state, leg.minutes)
  next = markDiscovered({ ...next, currentLocationId: to }, to)
  next = {
    ...next,
    visitedLocationIds: next.visitedLocationIds.includes(to) ? next.visitedLocationIds : [...next.visitedLocationIds, to],
    player: { ...next.player, stats: { ...next.player.stats, kmTraveled: next.player.stats.kmTraveled + route.distanceKm } },
    tripLog: [
      ...next.tripLog,
      {
        day: state.clock.day,
        minuteOfDay: state.clock.minuteOfDay,
        arrivalMinute: state.clock.minuteOfDay + leg.minutes,
        from: state.currentLocationId,
        to,
        mode: 'taxi',
        distanceKm: route.distanceKm,
      },
    ],
  }
  return {
    state: next,
    text: `You arrive at ${LOCATIONS[to].name} (${route.distanceKm} km).${isNew ? ` ${discoveryText(to)}` : ''}`,
  }
}

/** Applies the chosen outcome to the real state, logs the event and records its memory. */
export function resolveEvent(state: GameState, choiceId: string): GameState {
  const active = state.activeEvent
  if (!active) return state
  const event = eventById(active.eventId)
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return { ...state, notice: 'That is not one of the options.' }
  const check = checkChoice(state, choice)
  if (!check.ok) return { ...state, notice: check.reason }

  const { outcome } = choice
  let next = state
  const parts: string[] = []
  if (outcome.cost) {
    next = spendMoney(next, outcome.cost)
    parts.push(`−${rupees(outcome.cost)}`)
  }
  if (outcome.energyDelta) {
    next = changeEnergy(next, outcome.energyDelta)
    parts.push(`⚡${outcome.energyDelta > 0 ? '+' : '−'}${Math.abs(outcome.energyDelta)}`)
  }
  if (outcome.minutes) {
    next = passTime(next, outcome.minutes)
    parts.push(formatDuration(outcome.minutes))
  }
  if (outcome.giveItemId) next = addItem(next, outcome.giveItemId)
  if (outcome.removeItemId) next = removeItem(next, outcome.removeItemId)
  if (outcome.clueId) next = { ...findClue(next, outcome.clueId), notice: null }
  let rideText = ''
  if (outcome.freeRide) {
    const ride = freeRide(next)
    next = ride.state
    rideText = ride.text
  }
  if (outcome.xp) {
    next = addXp(next, outcome.xp)
    parts.push(`+${outcome.xp} XP`)
  }

  next = {
    ...next,
    activeEvent: null,
    eventLog: [
      ...next.eventLog,
      { ...active, choiceId, resolvedDay: next.clock.day, resolvedMinute: next.clock.minuteOfDay },
    ],
  }
  // The matching memory (e.g. Scooter Disaster) comes from the real moment.
  next = recordMoment(next, { type: 'event', eventId: event.id, choiceId })

  return {
    ...next,
    notice: [outcome.message, parts.length ? `(${parts.join(' · ')})` : '', rideText].filter(Boolean).join(' '),
  }
}

export function situationText(state: GameState): string {
  if (!state.activeEvent) return ''
  return eventById(state.activeEvent.eventId).situation.replaceAll('{place}', LOCATIONS[state.activeEvent.locationId].name)
}
