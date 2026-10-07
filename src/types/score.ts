import type { LocationId } from './location'
import type { Memory } from './memory'

export type AdventureRank = 'tourist' | 'explorer' | 'local-legend'

/** One line of the score: a real tracked value and the points it earned. */
export interface ScoreLine {
  id: string
  emoji: string
  label: string
  /** The tracked value, e.g. 4 places or 120 km. */
  value: number
  points: number
}

export interface RankInfo {
  rank: AdventureRank
  title: string
  emoji: string
  minScore: number
}

export interface AdventureScore {
  lines: ScoreLine[]
  total: number
  rank: RankInfo
  /** The next rank up and how many more points it needs (null at the top). */
  nextRank: { rank: RankInfo; pointsNeeded: number } | null
}

export interface TripStat {
  id: string
  emoji: string
  label: string
  value: string
}

/** Everything the final My Goa Summer screen shows, read from the real trip. */
export interface TripRecap {
  endingTitle: string
  endingLine: string
  stats: TripStat[]
  favourite: { locationId: LocationId; reason: string } | null
  bestMemory: Memory | null
  /** Personal sentences about this trip. */
  highlights: string[]
  memories: Memory[]
  finalMessage: string
}
