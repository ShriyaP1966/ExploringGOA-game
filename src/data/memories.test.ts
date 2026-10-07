import { describe, expect, it } from 'vitest'
import { EVENTS } from './events'
import { LOCATIONS, LOCATION_IDS } from './locations'
import { STORY_MEMORIES } from './memories'

const ACTIVITY_IDS = new Set(LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities.map((a) => a.id)))

describe('story memory data', () => {
  it('has the trip memories, including the final sunset', () => {
    expect(STORY_MEMORIES.map((m) => m.title)).toEqual([
      'Sunset at Vagator',
      'Scooter Disaster',
      'Best Meal',
      'Hidden Beach Discovery',
      'Successful Road Trip',
      'The Final Sunset at {place}',
      "A Local's Kindness",
      'Funny Unexpected Event',
    ])
  })

  it('gives every memory a description, XP and at least one trigger', () => {
    for (const memory of STORY_MEMORIES) {
      expect(memory.description.length).toBeGreaterThan(20)
      expect(memory.xp).toBeGreaterThan(0)
      expect(memory.triggers.length).toBeGreaterThan(0)
    }
  })

  it('only triggers on things that exist in the game', () => {
    for (const trigger of STORY_MEMORIES.flatMap((m) => m.triggers)) {
      if (trigger.type === 'activity') expect(ACTIVITY_IDS.has(trigger.activityId)).toBe(true)
      if (trigger.type === 'discover') expect(LOCATIONS[trigger.locationId]).toBeDefined()
      // Events not built yet (beach vendor, rain) are checked by the EventId type; built ones must match their choices.
      if (trigger.type === 'event') {
        const event = EVENTS.find((e) => e.id === trigger.eventId)
        const choiceIds = new Set(event?.choices.map((c) => c.id))
        for (const id of trigger.choiceIds ?? []) expect(choiceIds.has(id)).toBe(true)
      }
    }
  })

  it('has at least one great meal to trigger Best Meal', () => {
    const greatMeals = LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities).filter((a) => a.greatMeal)
    expect(greatMeals.length).toBeGreaterThan(0)
    for (const meal of greatMeals) expect(meal.energy).toBeGreaterThan(0)
  })
})
