import type { LocationId } from './location'

export type EndingQuality = 'legendary' | 'golden' | 'warm' | 'quiet'

/** What the ending quality is based on, read from the real game state at the moment of the sunset. */
export interface FinalSunsetFactors {
  arrivedBeforeSunset: boolean
  energyLeft: boolean
  memories: number
  /** The place was discovered by travelling there (not where the trip started). */
  selfDiscovered: boolean
  /** No energy or no money left: the trip winds down with a smaller ending. */
  outOfResources: boolean
}

export interface FinalSunset {
  locationId: LocationId
  day: number
  minuteOfDay: number
  factors: FinalSunsetFactors
  points: number
  quality: EndingQuality
  xp: number
  scoreBonus: number
}

/** Points set aside for the final adventure score. */
export interface ScoreBonus {
  id: string
  label: string
  points: number
}
