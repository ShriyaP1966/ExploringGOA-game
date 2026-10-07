import { LOCATIONS } from '../data/locations'
import { STORY_MEMORIES } from '../data/memories'
import type { GameState, MemoryTrigger, Moment, StoryMemory } from '../types'
import { recordMemory } from './player'

/** Does something that just happened match what a story memory is waiting for? */
export function triggerMatches(trigger: MemoryTrigger, moment: Moment): boolean {
  switch (trigger.type) {
    case 'activity':
      return moment.type === 'activity' && moment.activity.id === trigger.activityId
    case 'great-meal':
      return moment.type === 'activity' && Boolean(moment.activity.greatMeal)
    case 'discover':
      return moment.type === 'discover' && moment.locationId === trigger.locationId
    case 'event':
      return (
        moment.type === 'event' &&
        moment.eventId === trigger.eventId &&
        (!trigger.choiceIds || (moment.choiceId !== undefined && trigger.choiceIds.includes(moment.choiceId)))
      )
    case 'quest-complete':
      return moment.type === 'quest-complete' && moment.questId === trigger.questId
  }
}

export function hasStoryMemory(state: GameState, storyId: string): boolean {
  return state.player.memories.some((m) => m.storyId === storyId)
}

export function storyMemoriesFor(moment: Moment): StoryMemory[] {
  return STORY_MEMORIES.filter((story) => story.triggers.some((trigger) => triggerMatches(trigger, moment)))
}

/**
 * Turns a real moment into memories: every story memory it triggers that you don't have yet is
 * recorded here and now (day, time, place), as a photo if you carry the camera, and earns its XP.
 */
export function recordMoment(state: GameState, moment: Moment): GameState {
  const photo = state.player.inventory.some((entry) => entry.itemId === 'camera')
  const place = LOCATIONS[state.currentLocationId].name
  const fill = (text: string) => text.replaceAll('{place}', place)
  return storyMemoriesFor(moment)
    .filter((story) => !hasStoryMemory(state, story.id))
    .reduce(
      (next, story) =>
        recordMemory(
          next,
          { title: fill(story.title), description: fill(story.description), emoji: story.emoji, storyId: story.id, photo },
          story.xp,
        ),
      state,
    )
}
