import type { EventId } from './event'
import type { Activity, LocationId } from './location'

export interface Memory {
  id: string
  title: string
  description: string
  day: number
  minuteOfDay: number
  locationId: LocationId
  emoji?: string
  /** The activity whose photo this is, if any. */
  activityId?: string
  /** The story memory (data/memories.ts) this came from, if any. */
  storyId?: string
  /** Taken with the camera. */
  photo?: boolean
}

/** What a caller supplies; the engine stamps the id, time and place. */
export interface MemoryInput {
  title: string
  description: string
  emoji?: string
  activityId?: string
  storyId?: string
  photo?: boolean
}

/** Something that happened in the game which may become a memory. */
export type Moment =
  | { type: 'activity'; activity: Activity }
  | { type: 'discover'; locationId: LocationId }
  | { type: 'event'; eventId: EventId; choiceId?: string }
  | { type: 'quest-complete'; questId: string }

/** What a story memory waits for. */
export type MemoryTrigger =
  | { type: 'activity'; activityId: string }
  /** Any activity flagged as a great meal. */
  | { type: 'great-meal' }
  | { type: 'discover'; locationId: LocationId }
  /** An event, optionally only for some of its choices. */
  | { type: 'event'; eventId: EventId; choiceIds?: string[] }
  | { type: 'quest-complete'; questId: string }

/**
 * A memory the trip can produce, created automatically the first time one of its triggers happens.
 * `{place}` in the title or description becomes the name of where it happened.
 */
export interface StoryMemory {
  id: string
  title: string
  emoji: string
  description: string
  xp: number
  triggers: MemoryTrigger[]
}
