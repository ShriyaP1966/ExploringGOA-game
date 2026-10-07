import { ITEMS } from '../data/items'
import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type { GameState, ItemId, LocationId } from '../types'
import { advanceTime } from './clock'
import { DAY_END_MINUTE, HEAT_RULES, MAP_RULES } from './config'
import { findClue, getRoute, isLocationDiscovered, isLocationVisible } from './locations'

export type ItemCheck = { ok: true } | { ok: false; reason: string }

export function itemQuantity(state: GameState, itemId: ItemId): number {
  return state.player.inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0
}

export function hasItem(state: GameState, itemId: ItemId): boolean {
  return itemQuantity(state, itemId) > 0
}

/** Removes items; the entry disappears when none are left. Does nothing if you don't have enough. */
export function removeItem(state: GameState, itemId: ItemId, quantity = 1): GameState {
  if (itemQuantity(state, itemId) < quantity) return state
  const inventory = state.player.inventory
    .map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0)
  return { ...state, player: { ...state.player, inventory } }
}

export function isMiddayHeat(minuteOfDay: number): boolean {
  return minuteOfDay >= HEAT_RULES.from && minuteOfDay < HEAT_RULES.until
}

/** Extra energy lost to midday heat for something done outdoors right now. Sunglasses reduce it. */
export function heatPenalty(state: GameState): number {
  if (!isMiddayHeat(state.clock.minuteOfDay)) return 0
  return hasItem(state, 'sunglasses') ? HEAT_RULES.withSunglasses : HEAT_RULES.extraEnergy
}

/** "north", "south-east"… from one place to another on the map. */
export function directionWord(from: LocationId, to: LocationId): string {
  const a = LOCATIONS[from].mapPosition
  const b = LOCATIONS[to].mapPosition
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ns = Math.abs(dy) > 3 ? (dy < 0 ? 'north' : 'south') : ''
  const ew = Math.abs(dx) > 3 && Math.abs(dx) > Math.abs(dy) / 2 ? (dx < 0 ? 'west' : 'east') : ''
  return [ns, ew].filter(Boolean).join('-') || 'nearby'
}

/** The nearest unexplored place you could know about, preferring ones the map has not hinted yet. */
export function nextHintTarget(state: GameState): LocationId | null {
  const candidates = LOCATION_IDS.filter((id) => isLocationVisible(state, id) && !isLocationDiscovered(state, id))
  const distance = (id: LocationId) => getRoute(state.currentLocationId, id)?.distanceKm ?? Infinity
  const byDistance = [...candidates].sort((a, b) => distance(a) - distance(b))
  return byDistance.find((id) => !state.hintedLocationIds.includes(id)) ?? byDistance[0] ?? null
}

/** From Day 2, the map's back page reveals the hidden beach if nobody has told you about it yet. */
export function mapRevealsHiddenGem(state: GameState): boolean {
  return state.clock.day >= MAP_RULES.revealsHiddenGemFromDay && !state.foundClueIds.includes('palolem-clue')
}

export function checkUseItem(state: GameState, itemId: ItemId): ItemCheck {
  const item = ITEMS[itemId]
  if (!item || !hasItem(state, itemId)) return { ok: false, reason: "You don't have that." }
  if (!item.usable) return { ok: false, reason: `Your ${item.name.toLowerCase()} works on its own: ${item.effect}` }

  if (itemId === 'tourist-map') {
    if (state.mapUsedOnDay === state.clock.day) {
      return { ok: false, reason: "You've already studied the map today. Check it again tomorrow." }
    }
    if (!mapRevealsHiddenGem(state) && !nextHintTarget(state)) {
      return { ok: false, reason: 'Your map has nothing new to show: you have been everywhere it marks.' }
    }
    if (state.clock.minuteOfDay + MAP_RULES.minutes > DAY_END_MINUTE) return { ok: false, reason: 'It is too dark to read the map.' }
  }
  return { ok: true }
}

export function activateItem(state: GameState, itemId: ItemId): GameState {
  const check = checkUseItem(state, itemId)
  if (!check.ok) return { ...state, notice: check.reason }

  // The tourist map is currently the only usable item.
  const next = advanceTime(state, MAP_RULES.minutes)
  if (mapRevealsHiddenGem(state)) {
    return {
      ...findClue(next, 'palolem-clue'),
      mapUsedOnDay: state.clock.day,
      notice:
        '🗺️ On the back of your map someone has pencilled a circle on a quiet bay far to the south: “best beach in Goa”. A new place appears on your map!',
    }
  }

  const target = nextHintTarget(state)!
  const route = getRoute(state.currentLocationId, target)
  return {
    ...next,
    mapUsedOnDay: state.clock.day,
    hintedLocationIds: state.hintedLocationIds.includes(target)
      ? state.hintedLocationIds
      : [...state.hintedLocationIds, target],
    notice: `🗺️ Your map marks a spot about ${route?.distanceKm ?? '?'} km ${directionWord(state.currentLocationId, target)}: ${LOCATIONS[target].mapHint}`,
  }
}
