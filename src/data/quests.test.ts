import { describe, expect, it } from 'vitest'
import type { QuestCondition } from '../types'
import { ITEMS } from './items'
import { LOCATIONS, LOCATION_IDS } from './locations'
import { QUESTS } from './quests'

const ACTIVITY_IDS = new Set(LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities.map((a) => a.id)))
const CLUE_SOURCES = new Set(LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities.map((a) => a.givesClueId)))

function flatten(condition: QuestCondition): QuestCondition[] {
  return condition.type === 'all' || condition.type === 'any'
    ? condition.conditions.flatMap(flatten)
    : [condition]
}

describe('quest data', () => {
  it.each(QUESTS)('$title only refers to things that exist', (quest) => {
    const stepIds = new Set(quest.steps.map((s) => s.id))
    const conditions = [
      ...quest.requirements,
      ...quest.steps.map((s) => s.completeWhen),
      quest.failWhen,
      ...quest.attempts.flatMap((a) => (a.availableWhen ? [a.availableWhen] : [])),
    ].flatMap(flatten)

    for (const c of conditions) {
      if (c.type === 'activity-done-today') expect(ACTIVITY_IDS.has(c.activityId)).toBe(true)
      if (c.type === 'at-location') expect(LOCATIONS[c.locationId]).toBeDefined()
      if (c.type === 'step-incomplete') expect(stepIds.has(c.stepId)).toBe(true)
    }
    for (const item of quest.attempts.flatMap((a) => a.reward.itemIds)) expect(ITEMS[item]).toBeDefined()
  })

  it('makes every clue a quest needs obtainable', () => {
    const clues = QUESTS.flatMap((q) => q.steps.map((s) => s.completeWhen)).flatMap(flatten)
    for (const c of clues) if (c.type === 'has-clue') expect(CLUE_SOURCES.has(c.clueId)).toBe(true)
  })

  it('makes every retry worth less than the attempt before it', () => {
    for (const quest of QUESTS) {
      for (let i = 1; i < quest.attempts.length; i++) {
        expect(quest.attempts[i].reward.xp).toBeLessThan(quest.attempts[i - 1].reward.xp)
        expect(quest.attempts[i].availableWhen).toBeDefined()
      }
    }
  })
})
