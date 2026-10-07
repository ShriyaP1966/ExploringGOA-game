import { LOCATION_IDS } from '../data/locations'
import type { GamePhase, GameState } from '../types'
import { GAME_CONFIG } from './config'
import { createInitialState } from './initialState'

/** Bump when the saved shape changes in a way old saves can't be read as. */
export const SAVE_VERSION = 1

export interface SaveFile {
  version: number
  /** When it was saved (ms since 1970), for the Continue button. */
  savedAt: number
  state: GameState
}

const PHASES: GamePhase[] = ['day-intro', 'playing', 'day-summary', 'ended']

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The game as text, ready to store. */
export function serializeGame(state: GameState, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state }
  return JSON.stringify(file)
}

/**
 * Reads a stored save. Anything damaged, from another version or impossible (an unknown place,
 * money below zero…) gives null, so a bad save can never break the game: it is simply not offered.
 * Fields added since the save was made get their starting values.
 */
export function parseSave(text: string | null): SaveFile | null {
  if (!text) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(raw) || raw.version !== SAVE_VERSION || !isNumber(raw.savedAt) || !isObject(raw.state)) return null

  const s = raw.state
  const player = s.player
  const clock = s.clock
  const valid =
    isObject(player) &&
    isNumber(player.money) &&
    player.money >= 0 &&
    isNumber(player.energy) &&
    isNumber(player.xp) &&
    isNumber(player.level) &&
    Array.isArray(player.inventory) &&
    Array.isArray(player.memories) &&
    isObject(player.stats) &&
    isObject(clock) &&
    isNumber(clock.day) &&
    clock.day >= 1 &&
    clock.day <= GAME_CONFIG.tripDays &&
    isNumber(clock.minuteOfDay) &&
    PHASES.includes(s.phase as GamePhase) &&
    LOCATION_IDS.includes(s.currentLocationId as never) &&
    Array.isArray(s.discoveredLocationIds) &&
    Array.isArray(s.quests) &&
    isNumber(s.rngSeed)
  if (!valid) return null

  const fresh = createInitialState(s.rngSeed as number)
  const state = { ...fresh, ...(s as Partial<GameState>) } as GameState
  return { version: SAVE_VERSION, savedAt: raw.savedAt, state }
}

/** A loaded game picks up where it was, without replaying the last action's banners. */
export function restoreGame(saved: GameState): GameState {
  return { ...saved, notice: null, levelUp: null, newMemoryIds: [], questUpdates: [] }
}
