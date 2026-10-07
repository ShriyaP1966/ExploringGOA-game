import { describe, expect, it } from 'vitest'
import { STARTING_VALUES, TRAVEL_RULES } from '../engine/config'
import { getTravelLeg } from '../engine/locations'
import type { LocationId, TravelModeId } from '../types'
import { LOCATIONS, LOCATION_IDS } from './locations'
import { ROUTES } from './travel'

const BUDGET = STARTING_VALUES.money

describe('travel table', () => {
  it('has exactly one route for every pair of locations', () => {
    const keys = ROUTES.map((r) => [r.from, r.to].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe((LOCATION_IDS.length * (LOCATION_IDS.length - 1)) / 2)
  })

  it('makes walking and scooter rides free per trip, and taxis paid', () => {
    for (const { modes } of ROUTES) {
      expect(modes.walk.cost).toBe(0)
      // Scooters need no fuel; their cost is the daily rental fee.
      expect(modes.scooter.cost).toBe(0)
      expect(modes.taxi.cost).toBeGreaterThanOrEqual(300)
    }
  })

  it('makes only the short North Goa hops walkable', () => {
    const walkable = ROUTES.filter((r) => r.distanceKm <= TRAVEL_RULES.walkMaxKm).map((r) => `${r.from}-${r.to}`)
    expect(walkable).toEqual(['baga-anjuna', 'anjuna-vagator'])
  })

  it('makes walking much slower than riding', () => {
    for (const { modes } of ROUTES) {
      expect(modes.scooter.minutes).toBeLessThan(modes.walk.minutes / 3)
      expect(modes.taxi.minutes).toBeLessThan(modes.walk.minutes / 3)
    }
  })

  it('never makes a longer trip cheaper or faster', () => {
    const sorted = [...ROUTES].sort((a, b) => a.distanceKm - b.distanceKm)
    for (const mode of ['walk', 'scooter', 'taxi'] as TravelModeId[]) {
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].modes[mode].cost).toBeGreaterThanOrEqual(sorted[i - 1].modes[mode].cost)
        expect(sorted[i].modes[mode].minutes).toBeGreaterThanOrEqual(sorted[i - 1].modes[mode].minutes)
      }
    }
  })

  it('makes crossing regions cost more than any trip within a region', () => {
    const sameRegion = ROUTES.filter((r) => LOCATIONS[r.from].region === LOCATIONS[r.to].region)
    const crossRegion = ROUTES.filter((r) => LOCATIONS[r.from].region !== LOCATIONS[r.to].region)
    const maxLocalTaxi = Math.max(...sameRegion.map((r) => r.modes.taxi.cost))
    const maxLocalRide = Math.max(...sameRegion.map((r) => r.modes.scooter.minutes))
    for (const r of crossRegion) {
      expect(r.modes.taxi.cost).toBeGreaterThan(maxLocalTaxi)
      expect(r.modes.scooter.minutes).toBeGreaterThan(maxLocalRide)
    }
  })

  it('keeps nearby North Goa hops short by scooter', () => {
    const northRoutes = ROUTES.filter(
      (route) => LOCATIONS[route.from].region === 'north' && LOCATIONS[route.to].region === 'north',
    )
    for (const r of northRoutes) {
      expect(r.modes.scooter.minutes).toBeLessThanOrEqual(30)
    }
  })
})

describe('₹5,000 budget balance', () => {
  // The natural north-to-south tour that visits all five locations once.
  const TOUR: LocationId[] = ['baga', 'anjuna', 'vagator', 'fontainhas', 'palolem']
  const tourCost = (mode: TravelModeId) =>
    TOUR.slice(1).reduce((sum, to, i) => sum + getTravelLeg(TOUR[i], to, mode)!.cost, 0)
  const paidActivities = LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities).filter((a) => a.cost > 0)
  const allPaidActivitiesCost = paidActivities.reduce((sum, a) => sum + a.cost, 0)
  const priciestActivity = Math.max(...paidActivities.map((a) => a.cost))

  // Day 1 walk Baga → Anjuna → Vagator; rent a scooter on Days 2 and 3 for the rest.
  const scooterTraveller = tourCost('scooter') + 2 * TRAVEL_RULES.scooterDayFee

  it('lets day 1 be explored on foot', () => {
    expect(getTravelLeg('baga', 'anjuna', 'walk')!.minutes).toBeLessThanOrEqual(90)
    expect(getTravelLeg('anjuna', 'vagator', 'walk')!.minutes).toBeLessThanOrEqual(60)
  })

  it('lets a scooter traveller reach every location for a small share of the budget', () => {
    expect(scooterTraveller).toBeLessThanOrEqual(BUDGET * 0.2)
  })

  it('does not allow doing everything: some choices must be made', () => {
    expect(scooterTraveller + allPaidActivitiesCost).toBeGreaterThan(BUDGET)
  })

  it('is enough for nearly everything if you skip the priciest splurge', () => {
    expect(scooterTraveller + allPaidActivitiesCost - priciestActivity).toBeLessThanOrEqual(BUDGET)
  })

  it('makes a taxi-only trip to Palolem eat most of the budget', () => {
    expect(tourCost('taxi')).toBeGreaterThanOrEqual(BUDGET * 0.8)
    expect(tourCost('taxi')).toBeLessThan(BUDGET)
  })

  it('makes a one-way taxi south cost more than half the budget', () => {
    expect(getTravelLeg('baga', 'palolem', 'taxi')!.cost).toBeGreaterThan(BUDGET / 2)
  })
})
