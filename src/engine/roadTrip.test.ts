import { describe, expect, it } from 'vitest'
import type { GameAction, GameState, LocationId, QuestProgress, TravelModeId } from '../types'
import { createInitialState } from './initialState'
import { levelInfo } from './player'
import { hasStoryMemory } from './memories'
import { placesVisitedToday, regionsVisitedToday } from './quests'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const begin: GameAction = { type: 'BEGIN_DAY' }
const endDay: GameAction = { type: 'END_DAY' }
const rent: GameAction = { type: 'RENT_SCOOTER' }
const go = (to: LocationId, mode: TravelModeId = 'scooter'): GameAction => ({ type: 'TRAVEL', to, mode })

const roadTrip = (state: GameState): QuestProgress => state.quests.find((q) => q.questId === 'road-trip')!
const updates = (state: GameState) => state.questUpdates.map((u) => u.text).join(' ')

/** Skips Day 1 and starts Day 2 at Baga at 9:00 AM. */
function day2(): GameState {
  return run(createInitialState(), begin, endDay, { type: 'CONTINUE_AFTER_SUMMARY' }, begin)
}

describe('starting The Road Trip', () => {
  it('does not start on Day 1', () => {
    expect(roadTrip(run(createInitialState(), begin)).status).toBe('not-started')
  })

  it('starts automatically on Day 2', () => {
    const state = day2()
    expect(state.clock.day).toBe(2)
    expect(roadTrip(state)).toMatchObject({ status: 'active', attemptDay: 2 })
    expect(updates(state)).toMatch(/New quest: 🛵 The Road Trip/)
  })
})

describe('tracking the legs', () => {
  it('ticks off renting, each leg, three places and two regions', () => {
    let state = run(day2(), rent)
    expect(roadTrip(state).completedStepIds).toEqual(['rent-scooter'])

    state = run(state, go('anjuna'))
    expect(roadTrip(state).completedStepIds).toEqual(['rent-scooter', 'first-leg'])
    expect(updates(state)).toMatch(/Quest step done: Ride the first leg/)

    state = run(state, go('fontainhas'))
    expect(roadTrip(state).status).toBe('completed')
    expect(state.tripLog.map((t) => `${t.from}->${t.to}`)).toEqual(['baga->anjuna', 'anjuna->fontainhas'])
    expect(placesVisitedToday(state)).toEqual(['baga', 'anjuna', 'fontainhas'])
    expect(regionsVisitedToday(state)).toEqual(['north', 'central'])
  })

  it('only counts scooter rides as legs', () => {
    const state = run(day2(), rent, go('anjuna', 'taxi'), go('fontainhas', 'taxi'))
    expect(roadTrip(state).completedStepIds).toEqual(['rent-scooter'])
  })

  it('needs three different places: there and back again is not enough', () => {
    const state = run(day2(), rent, go('anjuna'), go('baga'))
    expect(roadTrip(state).completedStepIds).toEqual(['rent-scooter', 'first-leg', 'second-leg'])
  })

  it('needs two regions: a North Goa loop is not a road trip', () => {
    const state = run(day2(), rent, go('anjuna'), go('vagator'))
    expect(roadTrip(state).completedStepIds).toEqual(['rent-scooter', 'first-leg', 'second-leg', 'three-places'])
    expect(roadTrip(run(state, endDay)).status).toBe('failed')
  })
})

describe('completing The Road Trip', () => {
  it('gives XP and the Successful Road Trip memory', () => {
    const before = run(day2(), rent, go('anjuna'))
    const after = run(before, go('fontainhas'))
    expect(updates(after)).toMatch(/Quest complete: The Road Trip! \+80 XP, 📔 Successful Road Trip/)
    expect(hasStoryMemory(after, 'successful-road-trip')).toBe(true)
    // 80 quest + 40 memory + 25 for discovering Fontainhas
    expect(after.player.xp - before.player.xp).toBe(80 + 40 + 25)
  })
})

describe('keeping energy above 20 and money above ₹500', () => {
  it('fails as soon as energy drops to 20', () => {
    const state = run(day2(), rent, { type: 'CHANGE_ENERGY', delta: -(100 - 20) })
    expect(state.player.energy).toBe(20)
    expect(roadTrip(state).status).toBe('failed')
  })

  it('fails as soon as money drops to ₹500', () => {
    const state = run(day2(), rent, { type: 'SPEND_MONEY', amount: 4600 - 500 })
    expect(state.player.money).toBe(500)
    expect(roadTrip(state).status).toBe('failed')
    expect(updates(state)).toMatch(/Quest failed: The Road Trip/)
  })

  it('is fine at 21 energy and ₹501', () => {
    const state = run(day2(), rent, { type: 'CHANGE_ENERGY', delta: -79 }, { type: 'SPEND_MONEY', amount: 4600 - 501 })
    expect(roadTrip(state).status).toBe('active')
  })
})

describe('failing costs XP', () => {
  it('fails when you end the day without enough progress, shown on the summary', () => {
    let state = run(day2(), { type: 'ADD_XP', amount: 50 }, rent, go('anjuna'))
    const xpBefore = state.player.xp
    state = run(state, endDay)
    expect(state.phase).toBe('day-summary')
    expect(roadTrip(state)).toMatchObject({ status: 'failed', retryPending: false })
    expect(state.player.xp).toBe(xpBefore - 20)
    expect(updates(state)).toMatch(/Quest failed: The Road Trip\..*\(−20 XP\)/)
  })

  it('never costs you a level', () => {
    const explorer = levelInfo(2).minXp
    let state = run(day2(), { type: 'ADD_XP', amount: explorer + 10 }) // just past Explorer
    expect(state.player.level).toBe(2)
    state = run(state, endDay)
    expect(state.player.xp).toBe(explorer) // the −20 penalty stops at the start of the level
    expect(state.player.level).toBe(2)
    expect(updates(state)).toMatch(/\(−10 XP\)/)
  })

  it('also fails when 10 PM ends the day', () => {
    const state = run(day2(), rent, { type: 'ADVANCE_TIME', minutes: 13 * 60 })
    expect(state.phase).toBe('day-summary')
    expect(roadTrip(state).status).toBe('failed')
  })
})
