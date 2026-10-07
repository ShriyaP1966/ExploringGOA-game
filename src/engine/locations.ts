import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import { ROUTES } from '../data/travel'
import type { ClueId, GameState, LocationId, Route, TravelLeg, TravelModeId } from '../types'
import { XP_REWARDS } from './config'
import { recordMoment } from './memories'
import { addXp } from './player'

export function startingDiscoveredLocationIds(): LocationId[] {
  return LOCATION_IDS.filter((id) => LOCATIONS[id].startsDiscovered)
}

/** Routes are stored once per pair and work in both directions. */
export function getRoute(from: LocationId, to: LocationId): Route | undefined {
  if (from === to) return undefined
  return ROUTES.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from))
}

export function getTravelLeg(from: LocationId, to: LocationId, mode: TravelModeId): TravelLeg | undefined {
  return getRoute(from, to)?.modes[mode]
}

export function isLocationDiscovered(state: GameState, id: LocationId): boolean {
  return state.discoveredLocationIds.includes(id)
}

/**
 * Whether the location shows up at all (e.g. on the map). Clue-locked locations stay
 * completely hidden until their clue is found or they are discovered another way.
 */
export function isLocationVisible(state: GameState, id: LocationId): boolean {
  const clue = LOCATIONS[id].revealedByClue
  return !clue || state.foundClueIds.includes(clue) || isLocationDiscovered(state, id)
}

export function visibleLocationIds(state: GameState): LocationId[] {
  return LOCATION_IDS.filter((id) => isLocationVisible(state, id))
}

/** How a location appears on the map: not at all, as a fogged "?", as a named pin, or as where you are. */
export type MapPinStatus = 'hidden' | 'fogged' | 'discovered' | 'current'

export function mapPinStatus(state: GameState, id: LocationId): MapPinStatus {
  if (!isLocationVisible(state, id)) return 'hidden'
  if (id === state.currentLocationId) return 'current'
  return isLocationDiscovered(state, id) ? 'discovered' : 'fogged'
}

/** XP for discovering a place: more for a clue-locked hidden gem. */
export function discoveryXp(id: LocationId): number {
  return LOCATIONS[id].revealedByClue ? XP_REWARDS.hiddenGemDiscovery : XP_REWARDS.discovery
}

/** The one place discovery happens: adds the place, counts it and awards XP. Callers write the notice. */
export function markDiscovered(state: GameState, id: LocationId): GameState {
  if (isLocationDiscovered(state, id)) return state
  const next: GameState = {
    ...state,
    discoveredLocationIds: [...state.discoveredLocationIds, id],
    player: {
      ...state.player,
      stats: { ...state.player.stats, placesDiscovered: state.player.stats.placesDiscovered + 1 },
    },
  }
  // Discovering some places is itself memorable (e.g. the hidden beach).
  return recordMoment(addXp(next, discoveryXp(id)), { type: 'discover', locationId: id })
}

export function discoveryText(id: LocationId): string {
  return `🗺️ New place discovered: ${LOCATIONS[id].name}! +${discoveryXp(id)} XP`
}

export function discoverLocation(state: GameState, id: LocationId): GameState {
  if (isLocationDiscovered(state, id)) return state
  return { ...markDiscovered(state, id), notice: discoveryText(id) }
}

export function findClue(state: GameState, clueId: ClueId): GameState {
  if (state.foundClueIds.includes(clueId)) return state
  return { ...state, foundClueIds: [...state.foundClueIds, clueId], notice: 'You found a clue! Check the map.' }
}
