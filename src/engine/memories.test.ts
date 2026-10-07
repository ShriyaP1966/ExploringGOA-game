import { describe, expect, it } from 'vitest'
import type { GameState, LocationId } from '../types'
import { doActivity } from './activities'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { levelInfo } from './player'
import { removeItem } from './items'
import { findClue } from './locations'
import { hasStoryMemory, recordMoment } from './memories'
import { gameReducer } from './reducer'
import { rentScooter, travel } from './travel'

function at(locationId: LocationId, minuteOfDay: number, day = 1): GameState {
  const start = { ...createInitialState(), currentLocationId: locationId }
  return advanceTime(start, (day - 1) * 24 * 60 + minuteOfDay - start.clock.minuteOfDay)
}

const story = (state: GameState, storyId: string) => state.player.memories.find((m) => m.storyId === storyId)

describe('Sunset at Vagator', () => {
  it('is created when you watch the sunset at Vagator, with title, day, place and description', () => {
    const state = doActivity(at('vagator', 17 * 60 + 40), 'vagator-ozran-sunset')
    expect(story(state, 'sunset-at-vagator')).toMatchObject({
      title: 'Sunset at Vagator',
      day: 1,
      minuteOfDay: 17 * 60 + 40,
      locationId: 'vagator',
      description: expect.stringMatching(/red cliffs/),
      photo: true,
    })
    expect(state.player.xp).toBe(20 + 25) // activity + memory
    expect(state.player.memories).toHaveLength(1)
  })

  it('is still remembered without a camera, just not as a photo', () => {
    const state = doActivity(removeItem(at('vagator', 17 * 60 + 40), 'camera'), 'vagator-ozran-sunset')
    expect(story(state, 'sunset-at-vagator')?.photo).toBe(false)
  })

  it('is not created by other sunsets', () => {
    const state = doActivity(at('anjuna', 17 * 60 + 40), 'anjuna-cliff-sunset')
    expect(hasStoryMemory(state, 'sunset-at-vagator')).toBe(false)
  })

  it('is only created once', () => {
    let state = doActivity(at('vagator', 17 * 60 + 40), 'vagator-ozran-sunset')
    state = doActivity(advanceTime(state, 23 * 60), 'vagator-ozran-sunset')
    expect(state.player.memories.filter((m) => m.storyId === 'sunset-at-vagator')).toHaveLength(1)
  })
})

describe('Best Meal', () => {
  it('comes from a great meal, once', () => {
    let state = doActivity(at('anjuna', 12 * 60), 'anjuna-fish-thali')
    expect(story(state, 'best-meal')).toMatchObject({ title: 'Best Meal', locationId: 'anjuna' })
    expect(state.player.xp).toBe(10 + 20)

    state = { ...state, currentLocationId: 'baga' }
    state = doActivity(state, 'baga-shack-dinner')
    expect(state.player.memories.filter((m) => m.storyId === 'best-meal')).toHaveLength(1)
  })

  it('does not come from a snack', () => {
    expect(hasStoryMemory(doActivity(at('fontainhas', 10 * 60), 'fontainhas-bakery'), 'best-meal')).toBe(false)
  })

  it('also comes from discovering the food stall (food stall event)', () => {
    expect(hasStoryMemory(recordMoment(createInitialState(), { type: 'event', eventId: 'food-stall', choiceId: 'eat' }), 'best-meal')).toBe(
      true,
    )
  })
})

describe('Hidden Beach Discovery', () => {
  it('is created when Palolem is discovered, stamped at Palolem', () => {
    let state = findClue(at('baga', 9 * 60, 2), 'palolem-clue')
    state = travel(rentScooter(state), 'palolem', 'scooter')
    expect(story(state, 'hidden-beach-discovery')).toMatchObject({
      title: 'Hidden Beach Discovery',
      locationId: 'palolem',
      day: 2,
    })
  })

  it('is not created by finding the clue alone', () => {
    expect(hasStoryMemory(findClue(createInitialState(), 'palolem-clue'), 'hidden-beach-discovery')).toBe(false)
  })
})

describe('memories from events and quests', () => {
  it('Scooter Disaster after a breakdown', () => {
    const state = recordMoment(at('vagator', 14 * 60, 2), { type: 'event', eventId: 'scooter-trouble' })
    expect(story(state, 'scooter-disaster')).toMatchObject({ title: 'Scooter Disaster', locationId: 'vagator', day: 2 })
    expect(state.player.xp).toBe(20)
  })

  it('Funny Unexpected Event after the rain', () => {
    const state = recordMoment(createInitialState(), { type: 'event', eventId: 'sudden-shower' })
    expect(story(state, 'funny-unexpected-event')?.title).toBe('Funny Unexpected Event')
  })

  it('Successful Road Trip when that quest is completed', () => {
    const state = recordMoment(createInitialState(), { type: 'quest-complete', questId: 'road-trip' })
    expect(story(state, 'successful-road-trip')?.title).toBe('Successful Road Trip')
    expect(state.player.xp).toBe(40)
  })

  it('ignores moments that are not memorable', () => {
    const start = createInitialState()
    expect(recordMoment(start, { type: 'event', eventId: 'friendly-local' })).toBe(start)
    expect(recordMoment(start, { type: 'quest-complete', questId: 'some-other-quest' })).toBe(start)
  })
})

describe('the memory notification', () => {
  it('lists new memories from the last action, then clears', () => {
    let state = gameReducer(createInitialState(), { type: 'BEGIN_DAY' })
    state = gameReducer(state, { type: 'RECORD_MOMENT', moment: { type: 'event', eventId: 'sudden-shower' } })
    expect(state.newMemoryIds).toEqual([state.player.memories[0].id])
    state = gameReducer(state, { type: 'ADVANCE_TIME', minutes: 5 })
    expect(state.newMemoryIds).toEqual([])
  })

  it('can level you up', () => {
    let state = { ...createInitialState(), player: { ...createInitialState().player, xp: levelInfo(2).minXp - 10 } }
    state = recordMoment(state, { type: 'event', eventId: 'sudden-shower' })
    expect(state.levelUp?.title).toBe('Explorer')
  })
})
