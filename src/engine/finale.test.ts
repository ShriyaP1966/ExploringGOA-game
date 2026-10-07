import { describe, expect, it } from 'vitest'
import type { GameAction, GameState, QuestProgress } from '../types'
import { assessFinalSunset, checkFinalSunset } from './finale'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const begin: GameAction = { type: 'BEGIN_DAY' }
const endDay: GameAction = { type: 'END_DAY' }
const next: GameAction = { type: 'CONTINUE_AFTER_SUMMARY' }
const watch: GameAction = { type: 'WATCH_FINAL_SUNSET' }
const wait = (minutes: number): GameAction => ({ type: 'ADVANCE_TIME', minutes })
const memory = (n: number): GameAction => ({ type: 'RECORD_MEMORY', memory: { title: `Moment ${n}`, description: '' } })

const finale = (state: GameState): QuestProgress => state.quests.find((q) => q.questId === 'final-sunset')!

/** Day 3, 9:00 AM at Baga (the first two days ended straight away). */
function day3(): GameState {
  return run(createInitialState(), begin, endDay, next, begin, endDay, next, begin)
}

describe('starting The Final Sunset', () => {
  it('starts on Day 3 only', () => {
    expect(finale(run(createInitialState(), begin)).status).toBe('not-started')
    expect(finale(day3())).toMatchObject({ status: 'active', attemptDay: 3 })
  })

  it('cannot be watched before the last day', () => {
    const check = checkFinalSunset(run(createInitialState(), begin))
    expect(check.ok ? '' : check.reason).toMatch(/last day/)
  })
})

describe('watching the final sunset', () => {
  it('waits for the evening, then completes the quest and ends the trip', () => {
    const before = day3()
    const state = run(before, watch)
    expect(state.finalSunset).toMatchObject({ locationId: 'baga', day: 3, minuteOfDay: 18 * 60 })
    expect(state.clock.minuteOfDay).toBe(18 * 60 + 45)
    expect(finale(state).status).toBe('completed')
    expect(state.ending).toBe('final-sunset')
    expect(state.phase).toBe('ended')
    expect(state.daySummaries[2].endedBy).toBe('final-sunset')
  })

  it('adds a final memory named after the place, XP and a score bonus', () => {
    const before = day3()
    const state = run(before, watch)
    const final = state.player.memories.find((m) => m.storyId === 'final-sunset')
    expect(final).toMatchObject({ title: 'The Final Sunset at Baga Beach', locationId: 'baga', day: 3 })
    // Baga: arrived early ✓, energy ✓, no memories, not self-discovered → 2 points → warm
    expect(state.finalSunset).toMatchObject({ points: 2, quality: 'warm', xp: 45, scoreBonus: 200 })
    expect(state.scoreBonuses).toEqual([{ id: 'final-sunset', label: 'Final sunset (warm)', points: 200 }])
    expect(state.questUpdates.map((u) => u.text).join(' ')).toMatch(
      /Quest complete: The Final Sunset! \+30 XP, 📔 The Final Sunset at Baga Beach, 🌟 warm ending \+45 XP and \+200 score/,
    )
    // base 30 + warm bonus 45 + final memory 30
    expect(state.player.xp - before.player.xp).toBe(30 + 45 + 30)
  })

  it('can only be watched once', () => {
    const watched = run(day3(), watch)
    expect(checkFinalSunset({ ...watched, phase: 'playing' }).ok).toBe(false)
  })
})

describe('the ending depends on the real game state', () => {
  it('is legendary when everything comes together', () => {
    let state = run(day3(), memory(1), memory(2), memory(3), memory(4), memory(5), memory(6))
    state = run(state, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }) // self-discovered, arrives 9:20 AM
    const assessed = assessFinalSunset(state)
    expect(assessed.factors).toEqual({
      arrivedBeforeSunset: true,
      energyLeft: true,
      memories: 6,
      selfDiscovered: true,
      outOfResources: false,
    })
    state = run(state, watch)
    expect(state.finalSunset).toMatchObject({ locationId: 'anjuna', points: 5, quality: 'legendary', scoreBonus: 500 })
  })

  it('counts three memories as one point and six as two', () => {
    const three = run(day3(), memory(1), memory(2), memory(3))
    expect(assessFinalSunset(three).points).toBe(2 + 1)
  })

  it('loses a point for arriving after sunset', () => {
    let state = run(day3(), wait(9 * 60 + 20)) // 6:20 PM at Baga
    state = run(state, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }) // arrives 6:40 PM
    expect(assessFinalSunset(state).factors.arrivedBeforeSunset).toBe(false)
    state = run(state, watch)
    expect(finale(state).status).toBe('completed')
  })

  it('loses a point for arriving exhausted', () => {
    const tired = run(day3(), { type: 'CHANGE_ENERGY', delta: -85 })
    expect(assessFinalSunset(tired).factors.energyLeft).toBe(false)
  })

  it('does not count the starting beach as self-discovered', () => {
    expect(assessFinalSunset(day3()).factors.selfDiscovered).toBe(false)
  })
})

describe('out of energy or money: a smaller ending, not a crash', () => {
  it('still lets you watch with no energy left, for a quiet ending', () => {
    let state = run(day3(), memory(1), memory(2), memory(3), memory(4), memory(5), memory(6))
    state = run(state, { type: 'CHANGE_ENERGY', delta: -100 })
    expect(state.player.energy).toBe(0)
    state = run(state, watch)
    expect(state.finalSunset).toMatchObject({ quality: 'quiet', xp: 25, scoreBonus: 100 })
    expect(state.finalSunset?.factors.outOfResources).toBe(true)
    expect(state.ending).toBe('final-sunset')
  })

  it('still lets you watch with no money left', () => {
    const broke = run(day3(), { type: 'SPEND_MONEY', amount: day3().player.money })
    expect(broke.player.money).toBe(0)
    const state = run(broke, watch)
    expect(state.finalSunset?.quality).toBe('quiet')
    expect(run(state, next).phase).toBe('ended')
  })
})

describe('missing the sunset', () => {
  it('is refused once the sun has gone, and the trip ends quietly at 10 PM', () => {
    let state = run(day3(), wait(9 * 60 + 50)) // 6:50 PM
    expect(run(state, watch).notice).toMatch(/sun has already set/)
    state = run(state, wait(4 * 60))
    expect(finale(state).status).toBe('failed')
    expect(state.ending).toBe('trip-over')
    expect(state.finalSunset).toBeNull()
  })
})

describe('a sunset activity on the last day', () => {
  it('counts as choosing that place for the final sunset', () => {
    let state = run(day3(), { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }, wait(8 * 60 + 20)) // 5:40 PM
    state = run(state, { type: 'DO_ACTIVITY', activityId: 'anjuna-cliff-sunset' })
    expect(state.finalSunset).toMatchObject({ locationId: 'anjuna', minuteOfDay: 17 * 60 + 40 })
    expect(finale(state).status).toBe('completed')
    expect(state.ending).toBe('final-sunset')
  })
})
