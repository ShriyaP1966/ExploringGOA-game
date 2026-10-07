import { describe, expect, it } from 'vitest'
import type { GameAction, GameState } from '../types'
import { skyPhase } from './clock'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state)
}

const begin: GameAction = { type: 'BEGIN_DAY' }
const next: GameAction = { type: 'CONTINUE_AFTER_SUMMARY' }
const endDay: GameAction = { type: 'END_DAY' }
const wait = (minutes: number): GameAction => ({ type: 'ADVANCE_TIME', minutes })

/** Plays into the morning of the given day by ending each earlier day straight away. */
function morningOf(day: number): GameState {
  let state = run(createInitialState(), begin)
  for (let d = 1; d < day; d++) state = run(state, endDay, next, begin)
  return state
}

describe('phases', () => {
  it('starts on the Day 1 intro, where gameplay is ignored', () => {
    const start = createInitialState()
    expect(start.phase).toBe('day-intro')
    expect(run(start, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })).toBe(start)
    expect(run(start, begin).phase).toBe('playing')
  })

  it('ignores gameplay while the summary is showing', () => {
    const summary = run(createInitialState(), begin, endDay)
    expect(summary.phase).toBe('day-summary')
    expect(run(summary, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })).toBe(summary)
  })
})

describe('time limits', () => {
  it('never lets time run past 10 PM, and ends the day when it gets there', () => {
    const state = run(createInitialState(), begin, wait(20 * 60))
    expect(state.clock).toEqual({ day: 1, minuteOfDay: 22 * 60 })
    expect(state.phase).toBe('day-summary')
    expect(state.daySummaries[0].endedBy).toBe('curfew')
  })

  it('keeps playing until exactly 10 PM', () => {
    const state = run(createInitialState(), begin, wait(12 * 60 + 59))
    expect(state.phase).toBe('playing')
  })
})

describe('day summary', () => {
  it('reports what was spent, discovered, earned and travelled today', () => {
    const state = run(
      createInitialState(),
      begin,
      { type: 'TRAVEL', to: 'anjuna', mode: 'walk' },
      { type: 'DO_ACTIVITY', activityId: 'anjuna-fish-thali' },
      { type: 'TRAVEL', to: 'baga', mode: 'taxi' },
      endDay,
    )
    expect(state.daySummaries).toEqual([
      {
        day: 1,
        endedBy: 'player',
        moneySpent: 350 + 500,
        moneyLeft: 5000 - 850,
        xpEarned: 10 + 20 + 25 + 20, // thali + Best Meal memory + discovering Anjuna + staying under budget
        kmTraveled: 12,
        discovered: ['anjuna'],
        activityIds: ['anjuna-fish-thali'],
        underBudget: true,
        nextMorningEnergy: 100,
      },
    ])
  })

  it('only counts today, not earlier days', () => {
    let state = run(createInitialState(), begin, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }, endDay, next, begin)
    state = run(state, endDay)
    expect(state.daySummaries[1]).toMatchObject({ day: 2, moneySpent: 0, kmTraveled: 0, discovered: [] })
  })
})

describe('next morning', () => {
  it('starts the next day at 9 AM with partially restored energy', () => {
    let state = run(createInitialState(), begin, { type: 'CHANGE_ENERGY', delta: -90 }, wait(12 * 60)) // 10% energy, 9 PM
    state = run(state, endDay)
    expect(state.daySummaries[0].nextMorningEnergy).toBe(10 + 60)
    state = run(state, next)
    expect(state.phase).toBe('day-intro')
    expect(state.clock).toEqual({ day: 2, minuteOfDay: 9 * 60 })
    expect(state.player.energy).toBe(70)
  })

  it('restores more energy after an early night', () => {
    const state = run(createInitialState(), begin, { type: 'CHANGE_ENERGY', delta: -90 }, endDay, next)
    expect(state.player.energy).toBe(10 + 75)
  })

  it('makes yesterday’s scooter rental expire', () => {
    let state = morningOf(2)
    state = run(state, { type: 'RENT_SCOOTER' }, endDay, next, begin)
    expect(state.clock.day).toBe(3)
    expect(state.scooterRentedOnDay).toBe(2)
    expect(run(state, { type: 'TRAVEL', to: 'anjuna', mode: 'scooter' }).currentLocationId).toBe('baga')
  })
})

describe('what each day allows', () => {
  it('Day 1: North Goa only, no scooters', () => {
    const state = morningOf(1)
    expect(run(state, { type: 'TRAVEL', to: 'fontainhas', mode: 'taxi' }).notice).toMatch(/North Goa.*Day 2/)
    expect(run(state, { type: 'RENT_SCOOTER' }).notice).toMatch(/from Day 2/)
    expect(run(state, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }).currentLocationId).toBe('anjuna')
  })

  it('Day 2: scooters rent (taking 15 min) and other regions open', () => {
    let state = run(morningOf(2), { type: 'RENT_SCOOTER' })
    expect(state.scooterRentedOnDay).toBe(2)
    expect(state.clock.minuteOfDay).toBe(9 * 60 + 15)
    state = run(state, { type: 'TRAVEL', to: 'fontainhas', mode: 'scooter' })
    expect(state.currentLocationId).toBe('fontainhas')
  })

  it('a sunset before Day 3 is just a nice evening', () => {
    // 9:00 + 20 min taxi + 8 h 20 min = 5:40 PM, inside the sunset window
    let state = run(morningOf(2), { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }, wait(8 * 60 + 20))
    state = run(state, { type: 'DO_ACTIVITY', activityId: 'anjuna-cliff-sunset' })
    expect(state.completedActivities).toEqual([{ activityId: 'anjuna-cliff-sunset', day: 2 }])
    expect(state.phase).toBe('playing')
    expect(state.ending).toBeNull()
  })

  it('Day 3: watching the sunset triggers the ending', () => {
    let state = run(morningOf(3), { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }, wait(8 * 60 + 20))
    state = run(state, { type: 'DO_ACTIVITY', activityId: 'anjuna-cliff-sunset' })
    expect(state.ending).toBe('final-sunset')
    // Straight to the My Goa Summer recap; the day's summary is still recorded.
    expect(state.phase).toBe('ended')
    expect(state.daySummaries[2]).toMatchObject({ day: 3, endedBy: 'final-sunset', nextMorningEnergy: null })
  })

  it('Day 3: reaching 10 PM without a sunset ends the trip differently', () => {
    const state = run(morningOf(3), wait(13 * 60), next)
    expect(state.ending).toBe('trip-over')
    expect(state.phase).toBe('ended')
  })
})

describe('skyPhase', () => {
  it.each([
    [9 * 60, 'morning'],
    [13 * 60, 'afternoon'],
    [17 * 60 + 30, 'golden'],
    [18 * 60 + 30, 'sunset'],
    [19 * 60 + 30, 'dusk'],
    [21 * 60, 'night'],
  ])('%i minutes is %s', (minute, phase) => {
    expect(skyPhase(minute)).toBe(phase)
  })
})
