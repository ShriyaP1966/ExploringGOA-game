import type { LocationId } from './location'

export type TravelModeId = 'walk' | 'scooter' | 'taxi'

export interface TravelMode {
  id: TravelModeId
  label: string
  emoji: string
  /** Energy used per kilometre travelled. */
  energyPerKm: number
}

export interface TravelLeg {
  minutes: number
  /** Rupees. */
  cost: number
}

/** One completed trip, kept for quests (legs of a road trip) and the recap. */
export interface TripRecord {
  day: number
  /** Departure time (minutes since midnight). */
  minuteOfDay: number
  /** Arrival time (minutes since midnight). */
  arrivalMinute: number
  from: LocationId
  to: LocationId
  mode: TravelModeId
  distanceKm: number
}

/** A route works in both directions. */
export interface Route {
  from: LocationId
  to: LocationId
  distanceKm: number
  modes: Record<TravelModeId, TravelLeg>
}
