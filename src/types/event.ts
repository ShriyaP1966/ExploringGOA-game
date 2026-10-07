import type { ItemId } from './item'
import type { ClueId, LocationId } from './location'
import type { QuestStatus } from './quest'
import type { TravelModeId } from './travel'

export type EventId = 'food-stall' | 'sudden-shower' | 'friendly-local' | 'scooter-trouble'

/** What just happened that may set off an event. */
export type EventTrigger = 'trip' | 'activity'

/** A yes/no question about the real game state. An event can only fire when all of its conditions are true. */
export type EventCondition =
  | { type: 'after'; trigger: EventTrigger }
  | { type: 'trip-mode'; mode: TravelModeId }
  | { type: 'trip-distance-at-least'; km: number }
  | { type: 'location-in'; locationIds: LocationId[] }
  | { type: 'money-at-most'; amount: number }
  | { type: 'money-at-least'; amount: number }
  | { type: 'energy-at-most'; amount: number }
  | { type: 'energy-at-least'; amount: number }
  /** Time of day, inclusive (minutes since midnight). */
  | { type: 'time-between'; from: number; to: number }
  | { type: 'day-in'; days: number[] }
  | { type: 'quest-status'; questId: string; status: QuestStatus }
  | { type: 'has-item'; itemId: ItemId }
  | { type: 'lacks-clue'; clueId: ClueId }
  /** This event was resolved earlier today, at most this many minutes ago. */
  | { type: 'event-recently'; eventId: EventId; withinMinutes: number }
  | { type: 'all'; conditions: EventCondition[] }
  | { type: 'any'; conditions: EventCondition[] }
  | { type: 'not'; condition: EventCondition }

export interface EventOutcome {
  message: string
  /** Rupees paid (positive number). */
  cost?: number
  energyDelta?: number
  minutes?: number
  xp?: number
  giveItemId?: ItemId
  removeItemId?: ItemId
  /** Something you learn, e.g. the way to the hidden beach. */
  clueId?: ClueId
  /** A free ride to the nearest other place you know of. */
  freeRide?: boolean
}

export interface EventChoice {
  id: string
  label: string
  /** Words the parser can match to pick this choice. */
  keywords: string[]
  /** The choice is only offered when this holds (e.g. enough money). */
  requires?: EventCondition
  /** Shown when the requirement isn't met. */
  unavailableReason?: string
  outcome: EventOutcome
}

export interface RandomEvent {
  id: EventId
  title: string
  emoji: string
  /** The situation, shown in the popup. `{place}` becomes where you are. */
  situation: string
  /** All must be true for the event to be able to fire. */
  conditions: EventCondition[]
  /** Chance it fires when its conditions are true (0 to 1). */
  probability: number
  /** Minimum game minutes between two occurrences. */
  cooldownMinutes: number
  choices: EventChoice[]
}

/** An event waiting for the player's choice. */
export interface ActiveEvent {
  eventId: EventId
  day: number
  minuteOfDay: number
  locationId: LocationId
}

/** A resolved event, kept for cooldowns, follow-up events and the recap. */
export interface EventRecord extends ActiveEvent {
  choiceId: string
  resolvedDay: number
  resolvedMinute: number
}
