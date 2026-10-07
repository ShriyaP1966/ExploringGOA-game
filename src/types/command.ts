import type { GameClock } from './game'
import type { LocationId } from './location'
import type { TravelModeId } from './travel'

/** What the player wants to do. */
export type CommandIntent =
  /** Go to a place: "take me to Anjuna", "take me somewhere quiet". */
  | 'travel'
  /** Find or suggest a place: "I want a quiet beach". */
  | 'find-place'
  /** Find something to eat: "find me cheap food". */
  | 'find-food'
  | 'rent-scooter'
  /** Rest or relax where you are. */
  | 'rest'
  /** How much something costs, or the cheapest way. */
  | 'ask-cost'
  /** Do something here: swim, shop, take photos, watch the sunset. */
  | 'activity'
  /** Ask a local for help or information. */
  | 'ask-local'
  /** Money, energy, time, place. */
  | 'status'
  | 'show-quests'
  | 'show-inventory'
  /** Use something you carry: "use my tourist map". */
  | 'use-item'
  | 'end-day'
  | 'cancel'
  | 'yes'
  | 'no'
  | 'help'
  /** Not confident enough to act. */
  | 'unknown'

export interface IntentScore {
  intent: CommandIntent
  score: number
}

/**
 * What the parser may know about the game (read-only), so the same words can mean different things:
 * "yes" matters when a question is waiting, "swim" fits better at a beach.
 */
export interface ParseContext {
  currentLocationId?: LocationId
  /** An event or a local's offer is waiting for an answer. */
  pendingQuestion?: boolean
  hasScooterToday?: boolean
}

export type Mood = 'beautiful' | 'quiet' | 'relaxing' | 'lively' | 'authentic'

export type ActivityKind = 'eat' | 'swim' | 'shop' | 'photo' | 'sunset'

export type PlaceType = 'beach' | 'town' | 'fort' | 'market'

/** Something the player wants to avoid or insists on. */
export type Constraint =
  | { kind: 'avoid-crowds' }
  | { kind: 'avoid-mood'; mood: Mood }
  | { kind: 'avoid-activity'; activity: ActivityKind }
  /** Do not want to spend any money. */
  | { kind: 'free' }
  | { kind: 'cheap' }
  | { kind: 'nearby' }
  /** The player is tired: prefer low effort. */
  | { kind: 'tired' }
  | { kind: 'place-type'; placeType: PlaceType }
  /** Be done or arrive before a time of day (minutes since midnight). */
  | { kind: 'before'; minute: number; label: string }

export interface Budget {
  /** The most they want to spend on this, in rupees (0 = nothing). */
  maxSpend: number | null
  /** "around 500" rather than a hard limit. */
  approximate: boolean
  /** Money they say they have left, in rupees. */
  moneyLeft: number | null
}

/** The parser's output. It describes what the player asked for and never changes state itself. */
export interface ParsedCommand {
  /** Exactly what was typed or dictated. */
  raw: string
  /** Lower case, contractions expanded, numbers as digits, punctuation removed. */
  normalized: string
  intent: CommandIntent
  /** The best-scoring intents, highest first (even when the result is unknown). */
  alternatives: IntentScore[]
  destination: LocationId | null
  travelMode: TravelModeId | null
  budget: Budget | null
  moods: Mood[]
  activities: ActivityKind[]
  constraints: Constraint[]
  /** 0 to 1: how sure the parser is. */
  confidence: number
  /** Which parser produced this, so the panel can say so. */
  parser: string
}

export interface ValueChange<T> {
  from: T
  to: T
}

/** What a command really changed, worked out by comparing the state before and after. */
export interface CommandChanges {
  location: ValueChange<LocationId> | null
  money: ValueChange<number> | null
  energy: ValueChange<number> | null
  time: ValueChange<GameClock> | null
  /** Quest news, e.g. "The Lost Sunset: step done". */
  quests: string[]
  /** New places, clues and memories. */
  discoveries: string[]
}

/** Something the game offered, so "yes" or "take me there" can follow up on it. */
export type Suggestion =
  /** Go there (the recommended way), then optionally do something (e.g. the meal). */
  | { kind: 'travel'; locationId: LocationId; mode?: TravelModeId; thenActivityId?: string }
  | { kind: 'activity'; activityId: string }

/** What one game action did: whether the engine allowed it, and why (its own message). */
export interface ActionResult {
  action: string
  ok: boolean
  reason: string
}

/** What a command turned out to be. */
export type CommandOutcome = 'success' | 'refused' | 'answered' | 'not-understood'

/** One entry in the voice panel's history. */
export interface CommandRecord {
  id: number
  parsed: ParsedCommand
  outcome: CommandOutcome
  /** The game actions the command was mapped to (types only), in order. */
  actions: string[]
  /** How many game actions the command turned into. */
  actionCount: number
  /** What the game suggested, if anything. */
  suggestion: Suggestion | null
  /** Notes on how the game read the request, e.g. trusting your real money over what you said. */
  notes: string[]
  /** The human-readable reason: the result, the refusal, or the answer. */
  result: string
  changes: CommandChanges
  /** When the command was given. */
  at: GameClock
}
