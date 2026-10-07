import type { LocationId, Region } from './location'

export type GamePhase = 'day-intro' | 'playing' | 'day-summary' | 'ended'

export type TripEnding = 'final-sunset' | 'trip-over'

export type DayEndReason = 'curfew' | 'player' | 'final-sunset'

/** What each day allows. Content for the day lives in data/days.ts. */
export interface DayRules {
  /** Regions you may travel to on this day. */
  regions: Region[]
  scooterRental: boolean
  /** Watching a sunset on this day ends the trip. */
  finaleSunset: boolean
}

export interface DayInfo {
  day: number
  title: string
  emoji: string
  tagline: string
  /** Shown on the intro card at the start of the day. */
  intro: string[]
  rules: DayRules
}

/** Captured at the start of each day so the summary can show what changed. */
export interface DayStartSnapshot {
  money: number
  moneySpent: number
  xp: number
  kmTraveled: number
  discoveredLocationIds: LocationId[]
  /** Where you woke up. */
  locationId: LocationId
}

export interface DaySummary {
  day: number
  endedBy: DayEndReason
  moneySpent: number
  moneyLeft: number
  xpEarned: number
  kmTraveled: number
  discovered: LocationId[]
  activityIds: string[]
  /** Spent within the daily budget (and did something): a good-decision bonus. */
  underBudget: boolean
  /** Energy you wake up with the next morning (null after the last day). */
  nextMorningEnergy: number | null
}

export interface CompletedActivity {
  activityId: string
  day: number
}

export type SkyPhase = 'morning' | 'afternoon' | 'golden' | 'sunset' | 'dusk' | 'night'
