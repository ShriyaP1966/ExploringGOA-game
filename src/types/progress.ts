import type { LocationId } from './location'

export interface LevelInfo {
  level: number
  title: string
  emoji: string
  /** XP needed to reach this level. */
  minXp: number
  /** Short description of what this level gives you. */
  perk: string
}

/** Shown once when the player reaches a new level; cleared by the next action. */
export interface LevelUpNotice {
  level: number
  title: string
  perk: string
}

/** What a local offers when they decide to help. */
export type LocalHelpOffer =
  | { kind: 'palolem-clue' }
  | { kind: 'hint'; locationId: LocationId }
  | { kind: 'chai' }
