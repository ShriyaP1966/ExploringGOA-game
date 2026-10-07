import { describe, expect, it } from 'vitest'
import type { GameAction, GameState, LocationId, TravelModeId } from '../types'
import { advanceTime } from './clock'
import { checkChoice, eligibleEvents, eventById, maybeTriggerEvent } from './events'
import { createInitialState } from './initialState'
import { hasStoryMemory } from './memories'
import { mapPinStatus } from './locations'
import { nextRandom } from './random'
import { gameReducer } from './reducer'

/** A seed whose first roll lands in [min, max). */
function seedRolling(min: number, max: number): number {
  for (let seed = 1; seed < 10_000; seed++) {
    const [value] = nextRandom(seed)
    if (value >= min && value < max) return seed
  }
  throw new Error('no seed found')
}
const LUCKY = seedRolling(0, 0.1) // any event fires
const UNLUCKY = seedRolling(0.95, 1) // no event fires

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const go = (to: LocationId, mode: TravelModeId = 'scooter'): GameAction => ({ type: 'TRAVEL', to, mode })
const choose = (choiceId: string): GameAction => ({ type: 'CHOOSE_EVENT_OPTION', choiceId })
const withSeed = (state: GameState, seed: number): GameState => ({ ...state, rngSeed: seed })

/** Day 2, 9:15 AM at Baga with a scooter. */
function day2WithScooter(): GameState {
  const day2 = run(createInitialState(), { type: 'BEGIN_DAY' }, { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
  return run(day2, { type: 'RENT_SCOOTER' })
}

/** Day 2 with the scooter broken down after riding Baga → Fontainhas (16 km). */
function brokenDown(): GameState {
  return run(withSeed(day2WithScooter(), LUCKY), go('fontainhas'))
}

describe('scooter breakdown: only when its conditions are true', () => {
  it('can happen after a long scooter ride', () => {
    const state = brokenDown()
    expect(state.activeEvent).toMatchObject({ eventId: 'scooter-trouble', locationId: 'fontainhas', day: 2 })
  })

  it('never happens after a short ride, even with a lucky roll', () => {
    expect(run(withSeed(day2WithScooter(), LUCKY), go('anjuna')).activeEvent).toBeNull()
  })

  it('never happens in a taxi', () => {
    expect(run(withSeed(day2WithScooter(), LUCKY), go('fontainhas', 'taxi')).activeEvent).toBeNull()
  })

  it('depends on its probability roll', () => {
    expect(run(withSeed(day2WithScooter(), UNLUCKY), go('fontainhas')).activeEvent).toBeNull()
  })

  it('is the same every time for the same seed', () => {
    expect(brokenDown().activeEvent).toEqual(brokenDown().activeEvent)
  })
})

describe('waiting for the player', () => {
  it('ignores other actions until a choice is made', () => {
    const state = brokenDown()
    expect(run(state, go('baga'))).toBe(state)
    expect(run(state, { type: 'DO_ACTIVITY', activityId: 'fontainhas-church' })).toBe(state)
    expect(run(state, { type: 'END_DAY' })).toBe(state)
  })

  it('never starts an event once the day is over', () => {
    const late = withSeed(advanceTime(day2WithScooter(), 22 * 60 - (9 * 60 + 15)), LUCKY) // exactly 10 PM
    expect(maybeTriggerEvent(late, 'trip').activeEvent).toBeNull()
  })

  it('lets the day end only after the choice, if the choice runs the clock to 10 PM', () => {
    const lateBreakdown = { ...brokenDown(), clock: { day: 2, minuteOfDay: 21 * 60 } }
    const state = run(lateBreakdown, choose('ask-local')) // 90 minutes, capped at 10 PM
    expect(state.clock.minuteOfDay).toBe(22 * 60)
    expect(state.phase).toBe('day-summary')
    expect(hasStoryMemory(state, 'scooter-disaster')).toBe(true)
  })
})

describe('breakdown choices change the real state', () => {
  it('mechanic: costs ₹600 and a little time', () => {
    const before = brokenDown()
    const state = run(before, choose('mechanic'))
    expect(state.activeEvent).toBeNull()
    expect(state.player.money).toBe(before.player.money - 600)
    expect(state.player.stats.moneySpent).toBe(before.player.stats.moneySpent + 600)
    expect(state.clock.minuteOfDay).toBe(before.clock.minuteOfDay + 30)
    expect(state.player.energy).toBe(before.player.energy - 5)
    expect(state.notice).toMatch(/mechanic/)
  })

  it('mechanic: unavailable without ₹600', () => {
    const broke = { ...brokenDown(), player: { ...brokenDown().player, money: 300 } }
    const choice = eventById('scooter-trouble').choices.find((c) => c.id === 'mechanic')!
    expect(checkChoice(broke, choice)).toEqual({ ok: false, reason: 'You need ₹600 for the mechanic.' })
    expect(run(broke, choose('mechanic')).activeEvent).not.toBeNull()
  })

  it('push: costs energy and an hour, no money', () => {
    const before = brokenDown()
    const state = run(before, choose('push'))
    expect(state.player.money).toBe(before.player.money)
    expect(state.player.energy).toBe(before.player.energy - 20)
    expect(state.clock.minuteOfDay).toBe(before.clock.minuteOfDay + 60)
  })

  it('ask a local: costs time but no money', () => {
    const before = brokenDown()
    const state = run(before, choose('ask-local'))
    expect(state.player.money).toBe(before.player.money)
    expect(state.player.energy).toBe(before.player.energy)
    expect(state.clock.minuteOfDay).toBe(before.clock.minuteOfDay + 90)
  })

  it.each(['mechanic', 'push', 'ask-local'])('%s: creates the Scooter Disaster memory and logs the event', (choiceId) => {
    const state = run(brokenDown(), choose(choiceId))
    expect(hasStoryMemory(state, 'scooter-disaster')).toBe(true)
    expect(state.eventLog).toEqual([expect.objectContaining({ eventId: 'scooter-trouble', choiceId })])
  })

  it('cools down: no second breakdown the same day', () => {
    let state = run(brokenDown(), choose('push'))
    state = run(withSeed(state, LUCKY), go('baga'))
    expect(state.activeEvent?.eventId).not.toBe('scooter-trouble')
  })
})

describe('a local offers help', () => {
  it('can follow a breakdown', () => {
    let state = run(brokenDown(), choose('push'))
    state = run(withSeed(state, LUCKY), { type: 'DO_ACTIVITY', activityId: 'fontainhas-church' })
    expect(state.activeEvent?.eventId).toBe('friendly-local')
  })

  it('can happen when money is low', () => {
    const low = { ...day2WithScooter(), player: { ...day2WithScooter().player, money: 900 } }
    const state = run(withSeed(low, LUCKY), go('anjuna'))
    expect(state.activeEvent?.eventId).toBe('friendly-local')
  })

  it('never happens with plenty of money and no breakdown', () => {
    expect(eligibleEvents(run(day2WithScooter(), go('anjuna')), 'trip').map((e) => e.id)).not.toContain('friendly-local')
  })

  function offered(): GameState {
    const low = { ...day2WithScooter(), player: { ...day2WithScooter().player, money: 900 } }
    return run(withSeed(low, LUCKY), go('anjuna'))
  }

  it('can reveal Palolem, with the matching memory', () => {
    const state = run(offered(), choose('hidden-beach'))
    expect(state.foundClueIds).toContain('palolem-clue')
    expect(mapPinStatus(state, 'palolem')).toBe('fogged')
    expect(hasStoryMemory(state, 'local-kindness')).toBe(true)
  })

  it('cannot reveal Palolem twice', () => {
    const known = { ...offered(), foundClueIds: ['palolem-clue' as const] }
    const choice = eventById('friendly-local').choices.find((c) => c.id === 'hidden-beach')!
    expect(checkChoice(known, choice).ok).toBe(false)
  })

  it('offers free chai that restores energy', () => {
    const tired = { ...offered(), player: { ...offered().player, energy: 40 } }
    expect(run(tired, choose('chai')).player.energy).toBe(60)
  })

  it('offers a free ride to the nearest place you know', () => {
    const before = offered()
    const state = run(before, choose('ride'))
    expect(state.currentLocationId).toBe('vagator') // 4 km from Anjuna
    expect(state.player.money).toBe(before.player.money)
    expect(state.discoveredLocationIds).toContain('vagator')
    expect(state.tripLog[state.tripLog.length - 1]).toMatchObject({ from: 'anjuna', to: 'vagator' })
    expect(state.notice).toMatch(/You arrive at Vagator/)
  })

  it('declining changes nothing and creates no memory', () => {
    const before = offered()
    const state = run(before, choose('decline'))
    expect(state.activeEvent).toBeNull()
    expect(state.player.money).toBe(before.player.money)
    expect(hasStoryMemory(state, 'local-kindness')).toBe(false)
  })
})

describe('at most one event at a time', () => {
  it('fires only one even when several are possible', () => {
    // Low money and a long scooter ride: both events are eligible.
    const low = { ...day2WithScooter(), player: { ...day2WithScooter().player, money: 900 } }
    const ridden = run(low, go('fontainhas'))
    const eligible = eligibleEvents({ ...ridden, activeEvent: null }, 'trip').map((e) => e.id)
    expect(eligible).toEqual(['scooter-trouble', 'friendly-local'])
    const state = run(withSeed(low, LUCKY), go('fontainhas'))
    expect(state.activeEvent?.eventId).toBe('scooter-trouble')
  })

  it('never starts a second event while one is waiting', () => {
    const state = brokenDown()
    expect(maybeTriggerEvent(withSeed(state, LUCKY), 'trip')).toEqual(withSeed(state, LUCKY))
  })
})
