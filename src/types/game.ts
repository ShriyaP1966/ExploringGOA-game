import type { ActionResult, CommandRecord } from './command'
import type { CompletedActivity, DayStartSnapshot, DaySummary, GamePhase, TripEnding } from './day'
import type { ActiveEvent, EventRecord } from './event'
import type { FinalSunset, ScoreBonus } from './finale'
import type { ClueId, LocationId } from './location'
import type { Player } from './player'
import type { LevelUpNotice, LocalHelpOffer } from './progress'
import type { QuestProgress, QuestUpdate } from './quest'
import type { TripRecord } from './travel'

export interface GameClock {
  day: number
  /** Minutes since midnight, 0 to 1439. */
  minuteOfDay: number
}

export interface GameState {
  player: Player
  clock: GameClock
  currentLocationId: LocationId
  visitedLocationIds: LocationId[]
  /** Locations the player knows about and can travel to. */
  discoveredLocationIds: LocationId[]
  foundClueIds: ClueId[]
  discoveries: string[]
  quests: QuestProgress[]
  /** An event waiting for the player's choice; nothing else can happen until it is resolved. */
  activeEvent: ActiveEvent | null
  /** Every resolved event, in order. */
  eventLog: EventRecord[]
  /** The day the scooter is rented for, or null. A rental only covers that one day. */
  scooterRentedOnDay: number | null
  phase: GamePhase
  dayStart: DayStartSnapshot
  daySummaries: DaySummary[]
  completedActivities: CompletedActivity[]
  ending: TripEnding | null
  /** The day the tourist map was last used (it works once per day). */
  mapUsedOnDay: number | null
  /** Unexplored places the map has hinted at. */
  hintedLocationIds: LocationId[]
  /** Seed for the game's own random rolls, so every outcome is reproducible. */
  rngSeed: number
  /** The day you last asked a local for help (once per day). */
  localHelpAskedOnDay: number | null
  /** A local's offer waiting for you to accept or decline. */
  pendingHelp: LocalHelpOffer | null
  /** Set when the last action raised your level. */
  levelUp: LevelUpNotice | null
  /** Memories created by the last action (ids), for a "new memory" notification. */
  newMemoryIds: string[]
  /** Quest news from the last action (started, step done, completed, failed). */
  questUpdates: QuestUpdate[]
  /** Every trip taken, in order. */
  tripLog: TripRecord[]
  /** Where and how the final sunset was watched (set on Day 3). */
  finalSunset: FinalSunset | null
  /** Points set aside for the final adventure score. */
  scoreBonuses: ScoreBonus[]
  /** The result of the last action on its own, before quests and events reacted to it. */
  lastAction: ActionResult | null
  /** The most recent typed or spoken commands and what they did (newest last). */
  commandLog: CommandRecord[]
  /** Short feedback from the last action, e.g. why it was refused. */
  notice: string | null
}
