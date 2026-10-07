import { describe, expect, it } from 'vitest'
import type { GameAction, GameState, QuestProgress } from '../types'
import { createInitialState } from './initialState'
import { itemQuantity } from './items'
import { hasStoryMemory } from './memories'
import { checkCondition, initialQuestProgress } from './quests'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const begin: GameAction = { type: 'BEGIN_DAY' }
const ask: GameAction = { type: 'DO_ACTIVITY', activityId: 'baga-ask-shack-owner' }
const walk = (to: 'anjuna' | 'vagator' | 'baga'): GameAction => ({ type: 'TRAVEL', to, mode: 'walk' })
const taxi = (to: 'anjuna' | 'vagator' | 'baga'): GameAction => ({ type: 'TRAVEL', to, mode: 'taxi' })
const watchSunset: GameAction = { type: 'DO_ACTIVITY', activityId: 'vagator-ozran-sunset' }
/** Waits until the given time today. */
const until = (state: GameState, minute: number): GameState =>
  run(state, { type: 'ADVANCE_TIME', minutes: minute - state.clock.minuteOfDay })

const quest = (state: GameState): QuestProgress => state.quests.find((q) => q.questId === 'lost-sunset')!
const updates = (state: GameState) => state.questUpdates.map((u) => u.text).join(' ')

/** Day 1: ask, then walk Baga → Anjuna → Vagator (arrives 11:20 AM with ⚡80). */
function atVagatorInTime(): GameState {
  return run(createInitialState(), begin, ask, walk('anjuna'), walk('vagator'))
}

describe('starting The Lost Sunset', () => {
  it('does not start before the day begins', () => {
    expect(quest(createInitialState()).status).toBe('not-started')
  })

  it('starts automatically on Day 1', () => {
    const state = run(createInitialState(), begin)
    expect(quest(state)).toMatchObject({ status: 'active', attempt: 0, attemptDay: 1, completedStepIds: [] })
    expect(updates(state)).toMatch(/New quest: 🌅 The Lost Sunset/)
  })
})

describe('steps', () => {
  it('asking the shack owner gives a clue pointing to Vagator', () => {
    const state = run(createInitialState(), begin, ask)
    expect(state.foundClueIds).toContain('sunset-clue')
    expect(state.hintedLocationIds).toContain('vagator')
    expect(quest(state).completedStepIds).toEqual(['ask-shack-owner'])
    expect(updates(state)).toMatch(/Quest step done: Ask the shack owner/)
  })

  it('reaching Vagator in time with enough energy completes the next step', () => {
    const state = atVagatorInTime()
    expect(state.clock.minuteOfDay).toBe(11 * 60 + 20)
    expect(quest(state).completedStepIds).toEqual(['ask-shack-owner', 'reach-vagator'])
  })

  it('steps must be done in order: no clue, no progress', () => {
    const state = run(createInitialState(), begin, walk('anjuna'), walk('vagator'))
    expect(quest(state).completedStepIds).toEqual([])
  })
})

describe('completing the quest', () => {
  it('gives XP, a shell and the Sunset at Vagator memory', () => {
    let state = until(atVagatorInTime(), 17 * 60 + 40)
    const xpBefore = state.player.xp
    state = run(state, watchSunset)

    expect(quest(state).status).toBe('completed')
    expect(updates(state)).toMatch(/Quest complete: The Lost Sunset! \+60 XP, 🐚 Shell, 📔 Sunset at Vagator/)
    expect(itemQuantity(state, 'shell')).toBe(1)
    expect(hasStoryMemory(state, 'sunset-at-vagator')).toBe(true)
    expect(state.player.memories.filter((m) => m.storyId === 'sunset-at-vagator')).toHaveLength(1)
    // sunset activity 20 + memory 25 + quest reward 60
    expect(state.player.xp - xpBefore).toBe(20 + 25 + 60)
  })

  it('stays completed afterwards', () => {
    let state = run(until(atVagatorInTime(), 17 * 60 + 40), watchSunset)
    state = until(state, 21 * 60)
    expect(quest(state).status).toBe('completed')
  })
})

describe('failing', () => {
  it('fails if the sun sets before you arrive, with a retry promised', () => {
    let state = until(run(createInitialState(), begin, ask), 18 * 60 + 10)
    state = run(state, taxi('vagator')) // arrives 6:40 PM
    expect(quest(state)).toMatchObject({ status: 'failed', retryPending: true })
    expect(updates(state)).toMatch(/Quest failed: The Lost Sunset\. Less XP: .*Day 2 evening/)
  })

  it('fails if you arrive without enough energy left', () => {
    let state = run(createInitialState(), begin, ask, { type: 'CHANGE_ENERGY', delta: -70 }, walk('anjuna'), walk('vagator'))
    expect(state.player.energy).toBeLessThan(20)
    expect(quest(state).completedStepIds).toEqual(['ask-shack-owner'])
    state = until(state, 18 * 60 + 31)
    expect(quest(state).status).toBe('failed')
  })

  it('fails as soon as you end the day without watching, shown on the day summary', () => {
    const state = run(createInitialState(), begin, ask, { type: 'END_DAY' })
    expect(state.phase).toBe('day-summary')
    expect(quest(state)).toMatchObject({ status: 'failed', retryPending: true })
    expect(updates(state)).toMatch(/Quest failed: The Lost Sunset/)
  })
})

describe('the Day 2 retry', () => {
  function failedDayOne(): GameState {
    const late = run(until(run(createInitialState(), begin, ask), 18 * 60 + 10), taxi('vagator'))
    return run(late, { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, begin)
  }

  it('waits until Day 2 evening', () => {
    const morning = failedDayOne()
    expect(quest(morning)).toMatchObject({ status: 'failed', retryPending: true })
    const evening = until(morning, 16 * 60)
    expect(quest(evening)).toMatchObject({ status: 'active', attempt: 1, attemptDay: 2 })
    expect(updates(evening)).toMatch(/Second chance.*\+25 XP/)
  })

  it('keeps the clue step but resets the timed steps', () => {
    // You slept at Vagator, so arriving is instant: reach-vagator completes again on the retry day.
    const evening = until(failedDayOne(), 16 * 60)
    expect(quest(evening).completedStepIds).toEqual(['ask-shack-owner', 'reach-vagator'])
  })

  it('gives the smaller reward when completed', () => {
    let state = until(failedDayOne(), 17 * 60 + 40)
    state = run(state, watchSunset)
    expect(quest(state).status).toBe('completed')
    expect(updates(state)).toMatch(/Quest complete: The Lost Sunset! \+25 XP/)
  })

  it('expires if Day 2 ends before the second chance opens', () => {
    const state = run(failedDayOne(), { type: 'END_DAY' })
    expect(quest(state)).toMatchObject({ status: 'failed', retryPending: false })
    expect(updates(state)).toMatch(/chance for The Lost Sunset has passed/)
  })

  it('fails for good if the second chance is missed too', () => {
    let state = until(failedDayOne(), 16 * 60)
    state = run(state, taxi('baga'))
    // You reached Vagator again at 4 PM (you woke up there), so it fails once the light is gone at 6:45.
    state = until(state, 18 * 60 + 35)
    expect(quest(state).status).toBe('active')
    state = until(state, 18 * 60 + 50)
    expect(quest(state)).toMatchObject({ status: 'failed', retryPending: false, attempt: 1 })
    expect(updates(state)).toMatch(/sunset is lost for this trip/)
  })
})

describe('checkCondition', () => {
  const progress = { ...initialQuestProgress()[0], attemptDay: 1 }
  const state = createInitialState()

  it('combines conditions with all / any', () => {
    expect(
      checkCondition(state, { type: 'all', conditions: [{ type: 'day-is', day: 1 }, { type: 'at-location', locationId: 'baga' }] }, progress),
    ).toBe(true)
    expect(
      checkCondition(state, { type: 'any', conditions: [{ type: 'day-is', day: 2 }, { type: 'energy-at-least', amount: 200 }] }, progress),
    ).toBe(false)
  })

  it('compares times inclusively for "before" and strictly for "after"', () => {
    expect(checkCondition(state, { type: 'time-before', minute: 9 * 60 }, progress)).toBe(true)
    expect(checkCondition(state, { type: 'time-after', minute: 9 * 60 }, progress)).toBe(false)
  })

  it('knows the attempt day', () => {
    expect(checkCondition(state, { type: 'on-attempt-day' }, progress)).toBe(true)
    expect(checkCondition(state, { type: 'after-attempt-day' }, progress)).toBe(false)
  })
})
