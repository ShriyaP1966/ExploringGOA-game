import { describe, expect, it } from 'vitest'
import type { EventId, EventRecord, GameState, LocationId, TravelModeId } from '../types'
import { maybeTriggerEvent } from './events'
import { createInitialState } from './initialState'
import { hasItem } from './items'
import { hasStoryMemory } from './memories'
import { nextRandom } from './random'
import { gameReducer } from './reducer'

/** A seed whose first roll is below every event's probability: any eligible event fires. */
function seedRolling(min: number, max: number): number {
  for (let seed = 1; seed < 10_000; seed++) {
    const [value] = nextRandom(seed)
    if (value >= min && value < max) return seed
  }
  throw new Error('no seed found')
}
const ALWAYS = seedRolling(0, 0.05)
const NEVER = seedRolling(0.97, 1)

interface Scenario {
  location: LocationId
  /** Minutes since midnight. */
  time: number
  energy?: number
  money?: number
  day?: number
  /** A trip that just ended here, or null if an activity just finished. */
  trip?: { mode: TravelModeId; km: number } | null
  eventLog?: EventRecord[]
  seed?: number
}

/** Builds an exact, playing game state for one moment, straight from the scenario. */
function scenario(s: Scenario): GameState {
  const base = createInitialState(s.seed ?? ALWAYS)
  const day = s.day ?? 2
  return {
    ...base,
    phase: 'playing',
    clock: { day, minuteOfDay: s.time },
    currentLocationId: s.location,
    discoveredLocationIds: ['baga', 'anjuna', 'vagator', 'fontainhas'],
    player: { ...base.player, energy: s.energy ?? 80, money: s.money ?? 4000 },
    eventLog: s.eventLog ?? [],
    tripLog: s.trip
      ? [
          {
            day,
            minuteOfDay: s.time - 30,
            arrivalMinute: s.time,
            from: s.location === 'baga' ? 'anjuna' : 'baga',
            to: s.location,
            mode: s.trip.mode,
            distanceKm: s.trip.km,
          },
        ]
      : [],
  }
}

/** Which event (if any) fires after the scenario's trip or activity. */
function fired(s: Scenario): EventId | null {
  const state = scenario(s)
  return maybeTriggerEvent(state, s.trip ? 'trip' : 'activity').activeEvent?.eventId ?? null
}

const breakdownRecord = (day: number, minute: number): EventRecord => ({
  eventId: 'scooter-trouble',
  choiceId: 'push',
  day,
  minuteOfDay: minute - 60,
  locationId: 'fontainhas',
  resolvedDay: day,
  resolvedMinute: minute,
})

describe('all four events can trigger when their conditions are true', () => {
  it.each<[EventId, Scenario]>([
    ['scooter-trouble', { location: 'fontainhas', time: 10 * 60, trip: { mode: 'scooter', km: 16 } }],
    ['friendly-local', { location: 'anjuna', time: 10 * 60, money: 900 }],
    ['friendly-local', { location: 'fontainhas', time: 12 * 60, eventLog: [breakdownRecord(2, 11 * 60)] }],
    ['sudden-shower', { location: 'baga', time: 14 * 60 }],
    ['sudden-shower', { location: 'palolem', time: 13 * 60, trip: { mode: 'taxi', km: 68 } }],
    ['food-stall', { location: 'fontainhas', time: 12 * 60, energy: 25 }],
    ['food-stall', { location: 'anjuna', time: 10 * 60, energy: 30, trip: { mode: 'walk', km: 6 } }],
  ])('%s', (eventId, s) => {
    expect(fired(s)).toBe(eventId)
  })

  it('still respects the probability: an unlucky roll fires nothing', () => {
    expect(fired({ location: 'baga', time: 14 * 60, seed: NEVER })).toBeNull()
  })
})

describe('no event fires when one of its conditions is false', () => {
  it.each<[string, Scenario]>([
    // Scooter breakdown: needs a scooter trip of 15 km or more.
    ['breakdown: after an activity, not a trip', { location: 'fontainhas', time: 10 * 60 }],
    ['breakdown: a taxi, not a scooter', { location: 'fontainhas', time: 10 * 60, trip: { mode: 'taxi', km: 16 } }],
    ['breakdown: a short ride', { location: 'anjuna', time: 10 * 60, trip: { mode: 'scooter', km: 6 } }],
    // A local offers help: needs low money or a recent breakdown, during the day.
    ['local: plenty of money and no breakdown', { location: 'fontainhas', time: 15 * 60, money: 4000 }],
    ['local: low money but too late', { location: 'fontainhas', time: 20 * 60 + 30, money: 900 }],
    ['local: breakdown over 4 hours ago', { location: 'fontainhas', time: 15 * 60 + 30, eventLog: [breakdownRecord(2, 11 * 60)] }],
    ['local: breakdown yesterday', { location: 'fontainhas', time: 15 * 60, eventLog: [breakdownRecord(1, 11 * 60)] }],
    // Unexpected rain: afternoon, outdoors.
    ['rain: in the morning', { location: 'baga', time: 11 * 60 }],
    ['rain: in the evening', { location: 'baga', time: 17 * 60 + 30 }],
    ['rain: in town, not outdoors', { location: 'fontainhas', time: 15 * 60 }],
    // Food stall: near a town, getting tired or lunchtime, daytime.
    ['food: energy not low, not lunchtime', { location: 'fontainhas', time: 16 * 60, energy: 60 }],
    ['food: low energy but not near a town', { location: 'vagator', time: 12 * 60, energy: 25 }],
    ['food: low energy in town but too late', { location: 'fontainhas', time: 21 * 60 + 30, energy: 25 }],
  ])('%s', (_name, s) => {
    expect(fired(s)).toBeNull()
  })

  it('no event fires again while it is cooling down', () => {
    const rainedToday: EventRecord = {
      eventId: 'sudden-shower',
      choiceId: 'wait',
      day: 2,
      minuteOfDay: 13 * 60,
      locationId: 'baga',
      resolvedDay: 2,
      resolvedMinute: 14 * 60,
    }
    expect(fired({ location: 'anjuna', time: 15 * 60, eventLog: [rainedToday] })).toBeNull()
  })

  it('no event fires while another is waiting, or outside play', () => {
    const rainy = scenario({ location: 'baga', time: 14 * 60 })
    const waiting = { ...rainy, activeEvent: { eventId: 'food-stall' as const, day: 2, minuteOfDay: 14 * 60, locationId: 'baga' as const } }
    expect(maybeTriggerEvent(waiting, 'activity').activeEvent?.eventId).toBe('food-stall')
    expect(maybeTriggerEvent({ ...rainy, phase: 'day-summary' }, 'activity').activeEvent).toBeNull()
  })
})

describe('sweep: events fire exactly when the rules say they may', () => {
  // The rules from the design, restated independently of the engine.
  const OUTDOORS: LocationId[] = ['baga', 'anjuna', 'vagator', 'palolem']
  const TOWNS: LocationId[] = ['anjuna', 'fontainhas']
  const rules: Record<EventId, (s: Required<Omit<Scenario, 'eventLog' | 'seed' | 'day'>>) => boolean> = {
    'scooter-trouble': (s) => s.trip !== null && s.trip.mode === 'scooter' && s.trip.km >= 15,
    'friendly-local': (s) => s.money <= 1000 && s.time >= 9 * 60 && s.time <= 20 * 60,
    'sudden-shower': (s) => OUTDOORS.includes(s.location) && s.time >= 13 * 60 && s.time <= 17 * 60,
    'food-stall': (s) =>
      TOWNS.includes(s.location) && (s.energy <= 50 || (s.time >= 12 * 60 && s.time <= 14 * 60)) && s.time >= 9 * 60 && s.time <= 21 * 60,
  }
  const ORDER: EventId[] = ['scooter-trouble', 'friendly-local', 'sudden-shower', 'food-stall']

  const locations: LocationId[] = ['baga', 'anjuna', 'vagator', 'fontainhas', 'palolem']
  const times = [9 * 60, 11 * 60, 13 * 60, 14 * 60 + 30, 17 * 60, 17 * 60 + 30, 20 * 60 + 30, 21 * 60 + 30]
  const energies = [10, 30, 31, 90]
  const moneys = [100, 1000, 1001, 4000]
  const trips: ({ mode: TravelModeId; km: number } | null)[] = [
    null,
    { mode: 'scooter', km: 15 },
    { mode: 'scooter', km: 14 },
    { mode: 'taxi', km: 20 },
    { mode: 'walk', km: 4 },
  ]

  it('checks every combination', () => {
    const seen = new Set<EventId>()
    let cases = 0
    for (const location of locations)
      for (const time of times)
        for (const energy of energies)
          for (const money of moneys)
            for (const trip of trips) {
              const s = { location, time, energy, money, trip }
              const expected = ORDER.find((id) => rules[id](s)) ?? null
              const actual = fired(s)
              // Never fires when its conditions are false, and (with a sure roll) always fires when true.
              if (actual) expect(rules[actual](s), `${actual} fired for ${JSON.stringify(s)}`).toBe(true)
              expect(actual, JSON.stringify(s)).toBe(expected)
              if (actual) seen.add(actual)
              cases++
            }
    expect(cases).toBe(5 * 8 * 4 * 4 * 5)
    expect([...seen].sort()).toEqual([...ORDER].sort())
  })
})

describe('the new events change the real state and give their memories', () => {
  const rain = () => ({ ...scenario({ location: 'baga', time: 14 * 60 }), activeEvent: { eventId: 'sudden-shower' as const, day: 2, minuteOfDay: 14 * 60, locationId: 'baga' as const } })
  const stall = (money = 4000) => ({
    ...scenario({ location: 'fontainhas', time: 12 * 60, energy: 25, money }),
    activeEvent: { eventId: 'food-stall' as const, day: 2, minuteOfDay: 12 * 60, locationId: 'fontainhas' as const },
  })
  const choose = (state: GameState, choiceId: string) => gameReducer(state, { type: 'CHOOSE_EVENT_OPTION', choiceId })

  it('rain, wait it out: an hour, no energy lost', () => {
    const state = choose(rain(), 'wait')
    expect(state.clock.minuteOfDay).toBe(15 * 60)
    expect(state.player.energy).toBe(80)
    expect(hasStoryMemory(state, 'funny-unexpected-event')).toBe(true)
  })

  it('rain, buy a raincoat: ₹200 and you keep it', () => {
    const state = choose(rain(), 'buy-raincoat')
    expect(state.player.money).toBe(3800)
    expect(hasItem(state, 'raincoat')).toBe(true)
    expect(hasStoryMemory(state, 'funny-unexpected-event')).toBe(true)
  })

  it('rain, wear your raincoat: only possible if you own one, and costs nothing', () => {
    expect(choose(rain(), 'wear-raincoat').activeEvent).not.toBeNull()
    const owner = { ...rain(), player: { ...rain().player, inventory: [{ itemId: 'raincoat', quantity: 1 }] } }
    const state = choose(owner, 'wear-raincoat')
    expect(state.player.energy).toBe(80)
    expect(state.clock.minuteOfDay).toBe(14 * 60 + 5)
    // You can't buy a second one.
    expect(choose(owner, 'buy-raincoat').activeEvent).not.toBeNull()
  })

  it('rain, carry on: lose energy', () => {
    const state = choose(rain(), 'continue')
    expect(state.player.energy).toBe(65)
    expect(hasStoryMemory(state, 'funny-unexpected-event')).toBe(true)
  })

  it('food stall, eat: a cheap great meal that restores energy and gives Best Meal', () => {
    const state = choose(stall(), 'eat')
    expect(state.player.money).toBe(3880)
    expect(state.player.energy).toBe(55)
    expect(hasStoryMemory(state, 'best-meal')).toBe(true)
  })

  it('food stall, eat: not possible without ₹120, but the free taste still is', () => {
    expect(choose(stall(100), 'eat').activeEvent).not.toBeNull()
    const state = choose(stall(100), 'taste')
    expect(state.player.energy).toBe(33)
    expect(state.player.money).toBe(100)
    expect(hasStoryMemory(state, 'best-meal')).toBe(false)
  })

  it('food stall, keep walking: nothing changes and no memory', () => {
    const state = choose(stall(), 'decline')
    expect(state.player.energy).toBe(25)
    expect(hasStoryMemory(state, 'best-meal')).toBe(false)
  })
})
