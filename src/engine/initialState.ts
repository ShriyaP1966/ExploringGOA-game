import type { GameState } from '../types'
import { STARTING_VALUES } from './config'
import { snapshotDayStart } from './days'
import { startingDiscoveredLocationIds } from './locations'
import { initialQuestProgress } from './quests'

/** A brand-new trip. The seed drives every chance roll; tests pass a fixed one. */
export function createInitialState(rngSeed = 1): GameState {
  const discovered = startingDiscoveredLocationIds()
  const state: GameState = {
    player: {
      money: STARTING_VALUES.money,
      energy: STARTING_VALUES.energy,
      xp: STARTING_VALUES.xp,
      level: STARTING_VALUES.level,
      inventory: STARTING_VALUES.items.map((itemId) => ({ itemId, quantity: 1 })),
      memories: [],
      stats: { kmTraveled: 0, moneySpent: 0, placesDiscovered: discovered.length },
    },
    clock: { day: STARTING_VALUES.day, minuteOfDay: STARTING_VALUES.minuteOfDay },
    currentLocationId: STARTING_VALUES.locationId,
    visitedLocationIds: [STARTING_VALUES.locationId],
    discoveredLocationIds: discovered,
    foundClueIds: [],
    discoveries: [],
    quests: initialQuestProgress(),
    activeEvent: null,
    eventLog: [],
    scooterRentedOnDay: null,
    phase: 'day-intro',
    dayStart: { money: 0, moneySpent: 0, xp: 0, kmTraveled: 0, discoveredLocationIds: [], locationId: STARTING_VALUES.locationId },
    daySummaries: [],
    completedActivities: [],
    ending: null,
    mapUsedOnDay: null,
    hintedLocationIds: [],
    rngSeed,
    localHelpAskedOnDay: null,
    pendingHelp: null,
    levelUp: null,
    newMemoryIds: [],
    questUpdates: [],
    tripLog: [],
    finalSunset: null,
    scoreBonuses: [],
    commandLog: [],
    lastAction: null,
    notice: null,
  }
  return { ...state, dayStart: snapshotDayStart(state) }
}
