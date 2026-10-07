import { describe, expect, it } from 'vitest'
import type { EventCondition } from '../types'
import { EVENTS } from './events'
import { STORY_MEMORIES } from './memories'

function flatten(condition: EventCondition): EventCondition[] {
  if (condition.type === 'all' || condition.type === 'any') return condition.conditions.flatMap(flatten)
  if (condition.type === 'not') return flatten(condition.condition)
  return [condition]
}

describe('event data', () => {
  it.each(EVENTS)('$title is a complete, state-driven event', (event) => {
    expect(event.conditions.length).toBeGreaterThan(0)
    expect(event.probability).toBeGreaterThan(0)
    expect(event.probability).toBeLessThanOrEqual(1)
    expect(event.cooldownMinutes).toBeGreaterThan(0)
    expect(event.choices.length).toBeGreaterThanOrEqual(2)
    // Every event depends on something that just happened (a trip or an activity).
    expect(event.conditions.flatMap(flatten).some((c) => c.type === 'after')).toBe(true)
  })

  it.each(EVENTS)('$title has unique choices, and one that always works', (event) => {
    const ids = event.choices.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(event.choices.some((c) => !c.requires)).toBe(true)
  })

  it('gives choices with requirements a reason when unavailable', () => {
    for (const choice of EVENTS.flatMap((e) => e.choices)) {
      if (choice.requires) expect(choice.unavailableReason).toBeTruthy()
    }
  })

  it('has a memory for every built event', () => {
    for (const event of EVENTS) {
      const memory = STORY_MEMORIES.find((m) => m.triggers.some((t) => t.type === 'event' && t.eventId === event.id))
      expect(memory).toBeDefined()
    }
  })
})
