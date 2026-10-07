import type { ParsedCommand } from './command'
import type { GameState } from './game'
import type { EventId } from './event'
import type { ItemId } from './item'
import type { ClueId, LocationId } from './location'
import type { MemoryInput, Moment } from './memory'
import type { TravelModeId } from './travel'

export type GameAction =
  | { type: 'SPEND_MONEY'; amount: number }
  | { type: 'CHANGE_ENERGY'; delta: number }
  | { type: 'ADVANCE_TIME'; minutes: number }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'ADD_ITEM'; itemId: ItemId; quantity?: number }
  | { type: 'RECORD_MEMORY'; memory: MemoryInput }
  /** Something happened (an event, a finished quest…) that may create a memory. */
  | { type: 'RECORD_MOMENT'; moment: Moment }
  | { type: 'DISCOVER_LOCATION'; locationId: LocationId }
  | { type: 'FIND_CLUE'; clueId: ClueId }
  | { type: 'TRAVEL'; to: LocationId; mode: TravelModeId }
  | { type: 'RENT_SCOOTER' }
  | { type: 'DO_ACTIVITY'; activityId: string }
  | { type: 'USE_ITEM'; itemId: ItemId }
  /** Day 3: watch your final sunset where you are. */
  | { type: 'WATCH_FINAL_SUNSET' }
  /** Answer the event that is waiting. */
  | { type: 'CHOOSE_EVENT_OPTION'; choiceId: string }
  /** Developer tool: start an event regardless of its conditions. */
  | { type: 'FORCE_EVENT'; eventId: EventId }
  | { type: 'ASK_LOCAL' }
  /** Rest where you are for a while. */
  | { type: 'REST' }
  | { type: 'ACCEPT_HELP' }
  | { type: 'DECLINE_HELP' }
  | { type: 'END_DAY' }
  | { type: 'BEGIN_DAY' }
  | { type: 'CONTINUE_AFTER_SUMMARY' }
  | { type: 'RESET_GAME' }
  /** Continue a saved trip (already checked by engine/save.ts parseSave). */
  | { type: 'LOAD_GAME'; state: GameState }
  /** Developer tool: add money (the real game has no income). */
  | { type: 'RECEIVE_MONEY'; amount: number }
  /** A typed or spoken command, already parsed. The engine decides which game actions it becomes. */
  | { type: 'COMMAND'; command: ParsedCommand }
