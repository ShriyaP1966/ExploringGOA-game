import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type { Activity, ActivityKind, GameState, LocationId, ParsedCommand, TravelModeId } from '../types'
import { quoteActivity } from './activities'
import { dayRules } from './days'
import { getRoute, isLocationDiscovered, isLocationVisible } from './locations'
import { checkScooterRental, hasScooterToday, quoteTravel, type TravelCheck } from './travel'
import { RECOMMEND_RULES, TRAVEL_RULES } from './config'
import { rupees } from './utils'

/**
 * Read-only helpers that pick sensible options for a request ("somewhere relaxing", "cheap food").
 * They use the engine's own checks, but never change state; the engine re-checks every action.
 */

/** The player's own spending limit, if they gave one ("under 200", "free", "cheap"). */
export function spendingLimit(parsed: ParsedCommand): number | null {
  if (parsed.constraints.some((c) => c.kind === 'free')) return 0
  return parsed.budget?.maxSpend ?? null
}

const wantsCheap = (p: ParsedCommand) =>
  spendingLimit(p) !== null || p.constraints.some((c) => c.kind === 'cheap' || c.kind === 'free')
const isTired = (p: ParsedCommand) => p.constraints.some((c) => c.kind === 'tired')

export interface TravelChoice {
  mode: TravelModeId
  check: TravelCheck
  /** Allowed by the rules, but more than the player said they'd spend. */
  overBudget: boolean
}

/**
 * Which way to travel: the mode they asked for, or the best allowed one for what they said
 * (cheap → walk first, tired → taxi first). If nothing is allowed, the mode whose refusal will
 * explain the real problem (money, energy, time) rather than a technicality.
 */
export function chooseTravelMode(state: GameState, to: LocationId, parsed: ParsedCommand): TravelChoice {
  const limit = spendingLimit(parsed)
  const within = (check: TravelCheck) => !check.ok || limit === null || check.quote.cost <= limit
  if (parsed.travelMode) {
    const check = quoteTravel(state, to, parsed.travelMode)
    return { mode: parsed.travelMode, check, overBudget: !within(check) }
  }

  const order: TravelModeId[] = wantsCheap(parsed)
    ? ['walk', 'scooter', 'taxi']
    : isTired(parsed)
      ? ['taxi', 'scooter', 'walk']
      : ['scooter', 'walk', 'taxi']
  const checks = order.map((mode) => ({ mode, check: quoteTravel(state, to, mode) }))
  const allowed = checks.filter((c) => c.check.ok)
  const fits = allowed.find((c) => within(c.check))
  if (fits) return { ...fits, overBudget: false }
  if (allowed.length > 0) return { ...allowed[0], overBudget: true }

  // Nothing allowed: report the mode that is possible in principle, so the reason is the real one.
  const distance = getRoute(state.currentLocationId, to)?.distanceKm ?? Infinity
  const scooterPossible = hasScooterToday(state) || checkScooterRental(state).ok
  const fallback: TravelModeId = distance <= TRAVEL_RULES.walkMaxKm ? 'walk' : scooterPossible ? 'scooter' : 'taxi'
  return { mode: fallback, check: quoteTravel(state, to, fallback), overBudget: false }
}

/** Does a location activity fit what the player asked for ("swim", "photos", "eat")? */
export function activityFits(activity: Activity, kind: ActivityKind): boolean {
  switch (kind) {
    case 'eat':
      return Boolean(activity.meal)
    case 'swim':
      return activity.id.includes('swim') || activity.id.includes('kayak')
    case 'shop':
      return activity.id.includes('flea') || activity.id.includes('ticket')
    case 'photo':
      // A real photo activity; other moments become photos anyway when you carry the camera.
      return activity.id.includes('photo') || Boolean(activity.keywords?.includes('photos'))
    case 'sunset':
      return Boolean(activity.isSunset)
  }
}

/** The best matching activity here: one that is allowed and within budget, else the first match (so its refusal explains why). */
export function pickActivityHere(state: GameState, parsed: ParsedCommand, kinds: ActivityKind[]): Activity | null {
  const limit = spendingLimit(parsed)
  const matching = LOCATIONS[state.currentLocationId].activities.filter((a) => kinds.some((k) => activityFits(a, k)))
  if (matching.length === 0) return null
  const sorted = wantsCheap(parsed) ? [...matching].sort((a, b) => a.cost - b.cost) : matching
  return (
    sorted.find((a) => quoteActivity(state, a.id).ok && (limit === null || a.cost <= limit)) ??
    sorted.find((a) => quoteActivity(state, a.id).ok) ??
    sorted[0]
  )
}

/** Activities named by their own words ("parasailing", "shells"): here, and at other places you can see. */
export function namedActivities(state: GameState, parsed: ParsedCommand): { here: Activity[]; elsewhere: { locationId: LocationId; activity: Activity }[] } {
  const text = ` ${parsed.normalized} `
  const named = (a: Activity) => (a.keywords ?? []).some((k) => text.includes(` ${k} `))
  const here = LOCATIONS[state.currentLocationId].activities.filter(named)
  const elsewhere = LOCATION_IDS.filter((id) => id !== state.currentLocationId && isLocationVisible(state, id)).flatMap((locationId) =>
    LOCATIONS[locationId].activities.filter(named).map((activity) => ({ locationId, activity })),
  )
  return { here, elsewhere }
}

/** The nearest place you know of that offers a kind of activity. */
export function nearestWith(state: GameState, kinds: ActivityKind[]): LocationId | null {
  const options = LOCATION_IDS.filter(
    (id) =>
      id !== state.currentLocationId &&
      isLocationVisible(state, id) &&
      LOCATIONS[id].activities.some((a) => kinds.some((k) => activityFits(a, k))),
  )
  options.sort(
    (a, b) => (getRoute(state.currentLocationId, a)?.distanceKm ?? 999) - (getRoute(state.currentLocationId, b)?.distanceKm ?? 999),
  )
  return options[0] ?? null
}

export type RecommendPurpose = 'place' | 'food'

export interface Recommendation {
  locationId: LocationId
  /** How to get there (null when it is right here). */
  travel: TravelChoice | null
  /** The thing to do there that fits the request (the meal, the sunset…), if any. */
  activity: Activity | null
  /** Travel plus activity, in rupees. */
  totalCost: number
  /** Travel plus activity energy. */
  energyCost: number
  distanceKm: number
  /** When you'd get there (minutes since midnight). */
  arrivalMinute: number
  score: number
  /** Short reasons, e.g. "beauty 5/5", "a beach", "₹0 total". */
  why: string[]
}

export interface RecommendResult {
  best: Recommendation | null
  /** Other good options, best first. */
  alternatives: Recommendation[]
  /** Places ruled out, with the reason (over budget, too tired, not open today…). */
  ruledOut: { locationId: LocationId; reason: string }[]
}

const SUNSET_ARRIVE_BY = 18 * 60 + 30

/** What the request is "about" at a place, for its cost: the meal, a matching activity, or a free mood activity. */
function headlineActivity(
  place: LocationId,
  parsed: ParsedCommand,
  purpose: RecommendPurpose,
  arrival: number,
): Activity | null {
  const open = (a: Activity) => a.availableUntil === undefined || arrival <= a.availableUntil
  const all = LOCATIONS[place].activities.filter(open)
  const byCost = (list: Activity[]) => [...list].sort((a, b) => a.cost - b.cost)
  const cheap = parsed.constraints.some((c) => c.kind === 'cheap' || c.kind === 'free') || spendingLimit(parsed) !== null

  if (purpose === 'food') {
    const meals = all.filter((a) => activityFits(a, 'eat'))
    if (meals.length === 0) return null
    // Cheapest when they want cheap; otherwise the most memorable (or most filling) meal.
    return cheap ? byCost(meals)[0] : ([...meals].sort((a, b) => Number(b.greatMeal ?? 0) - Number(a.greatMeal ?? 0) || b.energy - a.energy)[0])
  }
  const kinds = parsed.activities.filter((k) => k !== 'eat')
  if (kinds.length > 0) return byCost(all.filter((a) => kinds.some((k) => activityFits(a, k))))[0] ?? null
  if (parsed.moods.includes('relaxing') || parsed.constraints.some((c) => c.kind === 'tired')) {
    return byCost(all.filter((a) => a.energy > 0))[0] ?? null
  }
  if (parsed.moods.includes('beautiful')) return byCost(all.filter((a) => a.isSunset || a.memory))[0] ?? null
  return null
}

/**
 * Scores every place against what the player asked for: mood (beauty, crowds, relaxation), budget
 * (travel plus activity, within their real money and any limit they set), energy, distance and the
 * time of day. Read-only: it uses the engine's own checks and never changes state.
 */
export function recommend(state: GameState, parsed: ParsedCommand, purpose: RecommendPurpose = 'place'): RecommendResult {
  const regions = dayRules(state).regions
  const now = state.clock.minuteOfDay
  const money = state.player.money // always the real money, whatever the player said
  const energy = state.player.energy
  const limit = spendingLimit(parsed)
  const limitWithSlack = limit !== null && parsed.budget?.approximate ? Math.round(limit * (1 + RECOMMEND_RULES.approximateSlack)) : limit
  const cheap = parsed.constraints.some((c) => c.kind === 'cheap' || c.kind === 'free') || limit !== null
  const tired = parsed.constraints.some((c) => c.kind === 'tired') || energy < 40
  const nearby = parsed.constraints.some((c) => c.kind === 'nearby')
  const placeTypes = parsed.constraints.flatMap((c) => (c.kind === 'place-type' ? [c.placeType] : []))
  const avoidCrowds = parsed.constraints.some((c) => c.kind === 'avoid-crowds' || (c.kind === 'avoid-mood' && c.mood === 'lively'))
  const sunsetSoon = now >= RECOMMEND_RULES.sunsetSoonFrom && now < SUNSET_ARRIVE_BY

  // Food can be right here; a place to go is somewhere else.
  const candidates = LOCATION_IDS.filter(
    (id) =>
      isLocationVisible(state, id) &&
      regions.includes(LOCATIONS[id].region) &&
      (id === state.currentLocationId ? purpose === 'food' : Boolean(getRoute(state.currentLocationId, id))),
  )

  const options: Recommendation[] = []
  const ruledOut: RecommendResult['ruledOut'] = []

  for (const id of candidates) {
    const place = LOCATIONS[id]
    const here = id === state.currentLocationId
    const route = here ? null : getRoute(state.currentLocationId, id)!
    const travel = here ? null : chooseTravelMode(state, id, parsed)
    if (travel && !travel.check.ok) {
      ruledOut.push({ locationId: id, reason: travel.check.reason })
      continue
    }
    const leg = travel?.check.ok ? travel.check.quote : null
    const arrival = now + (leg?.minutes ?? 0)
    const activity = headlineActivity(id, parsed, purpose, arrival)
    if (purpose === 'food' && !activity) continue // no meal there
    const totalCost = (leg?.cost ?? 0) + (activity?.cost ?? 0)
    const energyCost = (leg?.energy ?? 0) + Math.max(0, -(activity?.energy ?? 0))
    const distanceKm = route?.distanceKm ?? 0

    // Hard limits: real money, the player's own limit, energy, and the day's end.
    if (totalCost > money) {
      ruledOut.push({ locationId: id, reason: `${rupees(totalCost)} is more than the ${rupees(money)} you have` })
      continue
    }
    if (limitWithSlack !== null && totalCost > limitWithSlack) {
      ruledOut.push({ locationId: id, reason: `${rupees(totalCost)} is over your ${rupees(limit!)} limit` })
      continue
    }
    if (energyCost > energy) {
      ruledOut.push({ locationId: id, reason: `needs ⚡${energyCost}, you have ⚡${energy}` })
      continue
    }

    const why: string[] = []
    let score = place.beauty * 0.3

    // Mood, from the place's own ratings.
    if (parsed.moods.includes('beautiful')) {
      score += 2 * place.beauty
      why.push(`beauty ${place.beauty}/5`)
    }
    if (parsed.moods.includes('quiet') || parsed.moods.includes('authentic')) {
      score += 2 * (6 - place.crowd)
      why.push(`quiet (crowds ${place.crowd}/5)`)
    }
    if (parsed.moods.includes('relaxing') || (tired && purpose === 'place')) {
      score += 3 * place.relaxation
      why.push(`relaxing ${place.relaxation}/5`)
    }
    if (parsed.moods.includes('lively')) {
      score += 2 * place.crowd
      why.push(`lively (crowds ${place.crowd}/5)`)
    }
    if (avoidCrowds) {
      score += 2 * (6 - place.crowd)
      if (place.crowd <= 3 && !why.some((w) => w.startsWith('quiet'))) why.push(`not too crowded (${place.crowd}/5)`)
    }
    for (const type of placeTypes) {
      if (place.kinds.includes(type)) {
        score += 6
        why.push(`a ${type}`)
      } else score -= 6
    }

    // Money: cheap requests weigh cost heavily; cheap food means a cheap meal if there is one.
    score -= totalCost / (cheap ? 50 : 250)
    if (purpose === 'food' && cheap && activity && activity.cost > RECOMMEND_RULES.cheapMealMax) score -= 10

    // Energy and distance: tired → low effort; nearby → close; late evening → closer still.
    score -= energyCost / (tired ? 4 : 10)
    // Food is wanted soon: closer matters more, and eating right here is easiest.
    score -= distanceKm / (nearby ? 3 : purpose === 'food' ? 5 : 15)
    if (here) score += 1
    if (now >= RECOMMEND_RULES.lateFrom) score -= distanceKm / 5

    // Time of day: heading somewhere beautiful in the afternoon? Make the sunset.
    if (
      purpose === 'place' &&
      sunsetSoon &&
      place.activities.some((a) => a.isSunset) &&
      arrival <= SUNSET_ARRIVE_BY &&
      (parsed.moods.includes('beautiful') || parsed.moods.includes('relaxing'))
    ) {
      score += 3
      why.push('in time for sunset')
    }
    if (activity && activity.energy > 0 && tired) {
      score += 2
      why.push(`${activity.name.toLowerCase()} to recharge`)
    }
    if (!isLocationDiscovered(state, id)) score += 0.5 // a nudge to explore

    if (here) why.push('right here')
    else why.push(`${distanceKm} km`)
    why.push(totalCost === 0 ? 'free' : `${rupees(totalCost)} in all`)
    if (energyCost <= 5) why.push(`only ⚡${energyCost}`)

    options.push({ locationId: id, travel, activity, totalCost, energyCost, distanceKm, arrivalMinute: arrival, score, why })
  }

  options.sort((a, b) => b.score - a.score)
  return { best: options[0] ?? null, alternatives: options.slice(1, 3), ruledOut }
}

/** A meal here that fits the request: cheapest if they want cheap, else the best. */
export function pickMealHere(state: GameState, parsed: ParsedCommand): Activity | null {
  return pickActivityHere(state, parsed, ['eat'])
}
