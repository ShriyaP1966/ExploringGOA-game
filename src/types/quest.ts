import type { ItemId } from './item'
import type { ClueId, LocationId } from './location'
import type { TravelModeId } from './travel'

/** A yes/no question about the game state, used for quest requirements, steps and failure. */
export type QuestCondition =
  | { type: 'day-is'; day: number }
  | { type: 'time-at-least'; minute: number }
  /** Strictly later than this minute of the day. */
  | { type: 'time-after'; minute: number }
  /** At or before this minute of the day. */
  | { type: 'time-before'; minute: number }
  | { type: 'at-location'; locationId: LocationId }
  | { type: 'has-clue'; clueId: ClueId }
  | { type: 'energy-at-least'; amount: number }
  | { type: 'money-at-least'; amount: number }
  | { type: 'scooter-rented-today' }
  /** Trips completed today (optionally by one travel mode). */
  | { type: 'trips-today'; atLeast: number; mode?: TravelModeId }
  /** Different places you have been today, including where you woke up. */
  | { type: 'places-visited-today'; atLeast: number }
  | { type: 'regions-visited-today'; atLeast: number }
  /** True only during the final check as the day closes. */
  | { type: 'day-ending' }
  | { type: 'final-sunset-watched' }
  | { type: 'activity-done-today'; activityId: string }
  | { type: 'step-incomplete'; stepId: string }
  /** Today is the day the current attempt started. */
  | { type: 'on-attempt-day' }
  /** The day the current attempt started is over. */
  | { type: 'after-attempt-day' }
  | { type: 'all'; conditions: QuestCondition[] }
  | { type: 'any'; conditions: QuestCondition[] }

export interface QuestStep {
  id: string
  description: string
  completeWhen: QuestCondition
  /** Must be done again when the quest is retried (e.g. time-limited steps). */
  resetOnRetry?: boolean
}

export interface QuestReward {
  xp: number
  itemIds: ItemId[]
  /** Add the final sunset's quality bonus (XP and score). */
  finalSunsetBonus?: boolean
  /** Completing the quest ends the trip. */
  endsTrip?: boolean
}

/** One go at a quest. The first attempt starts when the quest's requirements are met; later ones are retries. */
export interface QuestAttempt {
  label: string
  /** When this attempt becomes active (for retries; the first attempt uses the quest's requirements). */
  availableWhen?: QuestCondition
  /** A pending retry that can no longer open: the quest fails for good. */
  expiresWhen?: QuestCondition
  reward: QuestReward
  /** What happens if this attempt fails (shown to the player). */
  consequence: string
  /** XP lost if this attempt fails (never costs you a level). */
  xpPenalty?: number
}

export interface Quest {
  id: string
  title: string
  emoji: string
  objective: string
  /** All must hold for the quest to start. */
  requirements: QuestCondition[]
  /** Completed strictly in order. */
  steps: QuestStep[]
  /** Must stay true the whole time the quest is active; checked before the steps. */
  constraint?: QuestCondition
  /** Checked while the quest is active, after the steps. */
  failWhen: QuestCondition
  /** Show today's trips (legs) in the quest log. */
  tracksTrips?: boolean
  /** First attempt, then retries in order. */
  attempts: QuestAttempt[]
}

export type QuestStatus = 'not-started' | 'active' | 'completed' | 'failed'

export interface QuestProgress {
  questId: string
  status: QuestStatus
  /** Index into Quest.attempts. */
  attempt: number
  /** The day the current attempt started. */
  attemptDay: number | null
  completedStepIds: string[]
  /** Failed, but a later attempt is waiting to open. */
  retryPending: boolean
}

/** A quest notification from the last action. */
export interface QuestUpdate {
  questId: string
  kind: 'started' | 'step' | 'completed' | 'failed' | 'retry'
  text: string
}
