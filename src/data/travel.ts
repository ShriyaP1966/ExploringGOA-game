import type { Route, TravelMode, TravelModeId } from '../types'

export const TRAVEL_MODES: Record<TravelModeId, TravelMode> = {
  walk: { id: 'walk', label: 'Walk', emoji: '🚶', energyPerKm: 2 },
  scooter: { id: 'scooter', label: 'Scooter', emoji: '🛵', energyPerKm: 0.4 },
  taxi: { id: 'taxi', label: 'Taxi', emoji: '🚕', energyPerKm: 0.1 },
}

/*
 * Road distances are real-world approximations. Times and fares follow these rules of thumb:
 *   walk    ~4.5 km/h, free (only allowed for short hops; see TRAVEL_RULES in engine/config.ts)
 *   scooter free per trip (no fuel needed); the real cost is the ₹400/day rental from Day 2.
 *           ~33 km/h in the north, faster on the NH66 highway south
 *   taxi    Goa's high minimum (~₹300) + ~₹35/km; a little slower than a scooter (pickup, traffic)
 * Within North Goa trips are short and cheap; reaching Palolem costs a big chunk of the budget.
 */
export const ROUTES: Route[] = [
  // North ↔ North
  {
    from: 'baga',
    to: 'anjuna',
    distanceKm: 6,
    modes: { walk: { minutes: 80, cost: 0 }, scooter: { minutes: 15, cost: 0 }, taxi: { minutes: 20, cost: 500 } },
  },
  {
    from: 'baga',
    to: 'vagator',
    distanceKm: 10,
    modes: { walk: { minutes: 130, cost: 0 }, scooter: { minutes: 25, cost: 0 }, taxi: { minutes: 30, cost: 650 } },
  },
  {
    from: 'anjuna',
    to: 'vagator',
    distanceKm: 4,
    modes: { walk: { minutes: 50, cost: 0 }, scooter: { minutes: 10, cost: 0 }, taxi: { minutes: 15, cost: 450 } },
  },

  // North ↔ Central
  {
    from: 'baga',
    to: 'fontainhas',
    distanceKm: 16,
    modes: { walk: { minutes: 210, cost: 0 }, scooter: { minutes: 35, cost: 0 }, taxi: { minutes: 40, cost: 850 } },
  },
  {
    from: 'anjuna',
    to: 'fontainhas',
    distanceKm: 19,
    modes: { walk: { minutes: 245, cost: 0 }, scooter: { minutes: 40, cost: 0 }, taxi: { minutes: 45, cost: 950 } },
  },
  {
    from: 'vagator',
    to: 'fontainhas',
    distanceKm: 21,
    modes: { walk: { minutes: 275, cost: 0 }, scooter: { minutes: 45, cost: 0 }, taxi: { minutes: 50, cost: 1050 } },
  },

  // Central ↔ South
  {
    from: 'fontainhas',
    to: 'palolem',
    distanceKm: 68,
    modes: { walk: { minutes: 885, cost: 0 }, scooter: { minutes: 115, cost: 0 }, taxi: { minutes: 120, cost: 2700 } },
  },

  // North ↔ South
  {
    from: 'baga',
    to: 'palolem',
    distanceKm: 82,
    modes: { walk: { minutes: 1065, cost: 0 }, scooter: { minutes: 135, cost: 0 }, taxi: { minutes: 140, cost: 3150 } },
  },
  {
    from: 'anjuna',
    to: 'palolem',
    distanceKm: 85,
    modes: { walk: { minutes: 1105, cost: 0 }, scooter: { minutes: 140, cost: 0 }, taxi: { minutes: 145, cost: 3300 } },
  },
  {
    from: 'vagator',
    to: 'palolem',
    distanceKm: 88,
    modes: { walk: { minutes: 1145, cost: 0 }, scooter: { minutes: 145, cost: 0 }, taxi: { minutes: 150, cost: 3400 } },
  },
]
