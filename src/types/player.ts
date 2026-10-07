import type { InventoryEntry } from './item'
import type { Memory } from './memory'

export interface PlayerStats {
  kmTraveled: number
  moneySpent: number
  /** How many places you know (Baga counts from the start). */
  placesDiscovered: number
}

export interface Player {
  /** Rupees. Never below 0. */
  money: number
  /** 0 to 100. */
  energy: number
  xp: number
  level: number
  inventory: InventoryEntry[]
  memories: Memory[]
  stats: PlayerStats
}
