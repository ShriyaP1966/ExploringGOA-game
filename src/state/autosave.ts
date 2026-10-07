import { parseSave, serializeGame, type SaveFile } from '../engine/save'
import type { GameState } from '../types'

/** Where the trip is kept in the browser. Storage can be missing or full; a failure never breaks the game. */
export const SAVE_KEY = 'exploringgoa.save'

export function readSave(): SaveFile | null {
  try {
    return parseSave(window.localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}

export function writeSave(state: GameState): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, serializeGame(state, Date.now()))
    return true
  } catch {
    return false
  }
}
