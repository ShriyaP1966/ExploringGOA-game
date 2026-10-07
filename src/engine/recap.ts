import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import { STORY_MEMORIES } from '../data/memories'
import type { EndingQuality, GameState, LocationId, Memory, TripRecap, TripStat } from '../types'
import { GAME_CONFIG } from './config'
import { qualityText } from './finale'
import { levelInfo } from './player'
import { daysPlayed, finishedUnderBudget, questsCompleted, tripBudget } from './score'
import { rupees } from './utils'

export const FINAL_MESSAGE = "You didn't just visit Goa, you experienced it."

const ENDING_TITLE: Record<EndingQuality, string> = {
  legendary: '🌟 A legendary last sunset',
  golden: '✨ A golden goodbye',
  warm: '🧡 A warm farewell',
  quiet: '🌙 A quiet goodbye',
}

/** Where an activity takes place. */
function activityLocation(activityId: string): LocationId | null {
  return LOCATION_IDS.find((id) => LOCATIONS[id].activities.some((a) => a.id === activityId)) ?? null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The place that meant the most: memories count double, then things done there, then arrivals;
 * the final sunset spot gets a boost. Ties go to the place you were at later in the trip.
 */
export function favouriteLocation(state: GameState): TripRecap['favourite'] {
  const tally = new Map<LocationId, { memories: number; activities: number; visits: number; sunset: boolean; last: number }>()
  const entry = (id: LocationId) => {
    const e = tally.get(id) ?? { memories: 0, activities: 0, visits: 0, sunset: false, last: -1 }
    tally.set(id, e)
    return e
  }
  const when = (day: number, minute: number) => day * 10_000 + minute
  for (const m of state.player.memories) {
    const e = entry(m.locationId)
    e.memories++
    e.last = Math.max(e.last, when(m.day, m.minuteOfDay))
  }
  for (const a of state.completedActivities) {
    const at = activityLocation(a.activityId)
    if (at) entry(at).activities++
  }
  for (const t of state.tripLog) {
    const e = entry(t.to)
    e.visits++
    e.last = Math.max(e.last, when(t.day, t.arrivalMinute))
  }
  if (state.finalSunset) entry(state.finalSunset.locationId).sunset = true

  const weight = (e: { memories: number; activities: number; visits: number; sunset: boolean }) =>
    e.memories * 2 + e.activities + e.visits * 0.5 + (e.sunset ? 3 : 0)
  const ranked = [...tally.entries()]
    .filter(([, e]) => weight(e) > 0)
    .sort(([, a], [, b]) => weight(b) - weight(a) || b.last - a.last)
  if (ranked.length === 0) return null

  const [locationId, e] = ranked[0]
  const parts = [
    e.memories > 0 ? `${e.memories} ${e.memories === 1 ? 'memory' : 'memories'}` : '',
    e.activities > 0 ? plural(e.activities, 'thing') + ' done' : '',
    e.visits > 1 ? `${e.visits} visits` : '',
    e.sunset ? 'your final sunset' : '',
  ].filter(Boolean)
  return { locationId, reason: parts.length > 0 ? listed(parts) : 'where your trip happened' }
}

function listed(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The trip's best memory: story moments outrank everyday ones (by how much they are worth),
 * a photo beats no photo, and among equals the later one wins.
 */
export function bestMemory(state: GameState): Memory | null {
  const worth = (m: Memory) => (m.storyId ? 100 + (STORY_MEMORIES.find((s) => s.id === m.storyId)?.xp ?? 0) : 0) + (m.photo ? 5 : 0)
  let best: Memory | null = null
  for (const m of state.player.memories) if (!best || worth(m) >= worth(best)) best = m
  return best
}

export function tripStats(state: GameState): TripStat[] {
  const { player } = state
  const level = levelInfo(player.level)
  return [
    { id: 'days', emoji: '📅', label: 'Days played', value: `${daysPlayed(state)} of ${GAME_CONFIG.tripDays}` },
    { id: 'places', emoji: '📍', label: 'Places discovered', value: `${state.discoveredLocationIds.length} of ${LOCATION_IDS.length}` },
    { id: 'quests', emoji: '📜', label: 'Quests completed', value: `${questsCompleted(state)} of ${state.quests.length}` },
    { id: 'money', emoji: '💸', label: 'Money spent', value: rupees(player.stats.moneySpent) },
    { id: 'km', emoji: '🛣️', label: 'Kilometres travelled', value: `${player.stats.kmTraveled} km` },
    { id: 'memories', emoji: '📔', label: 'Memories collected', value: String(player.memories.length) },
    { id: 'xp', emoji: '✨', label: 'XP earned', value: String(player.xp) },
    { id: 'level', emoji: level.emoji, label: 'Level reached', value: level.title },
  ]
}

/** Everything the My Goa Summer screen shows, personalised from the real trip. Pure. */
export function tripRecap(state: GameState): TripRecap {
  const sunset = state.ending === 'final-sunset' ? state.finalSunset : null
  const favourite = favouriteLocation(state)
  const best = bestMemory(state)
  const { moneySpent, kmTraveled } = state.player.stats
  const name = (id: LocationId) => `${LOCATIONS[id].emoji} ${LOCATIONS[id].name}`

  const highlights: string[] = []
  if (favourite) highlights.push(`Your favourite place was ${name(favourite.locationId)}: ${favourite.reason}.`)
  if (best) {
    const place = LOCATIONS[best.locationId].name
    const where = best.title.includes(place) ? '' : ` at ${place}`
    highlights.push(`Your best memory: ${best.emoji ?? '📸'} ${best.title}, on Day ${best.day}${where}.`)
  }
  // Hidden gems: places that only appear once you find their clue.
  for (const id of state.discoveredLocationIds.filter((id) => LOCATIONS[id].revealedByClue)) {
    highlights.push(`You found ${LOCATIONS[id].name}, the place most tourists never see.`)
  }
  if (kmTraveled > 0 || moneySpent > 0) {
    const budget = finishedUnderBudget(state) ? `, under your ${rupees(tripBudget())} budget` : ''
    highlights.push(`You covered ${kmTraveled} km and spent ${rupees(moneySpent)}${budget}.`)
  } else {
    highlights.push('You stayed put and spent nothing: Baga had you from the start.')
  }

  return {
    endingTitle: sunset ? ENDING_TITLE[sunset.quality] : '✈️ Time to fly home',
    endingLine: sunset
      ? `You watched your final sunset from ${LOCATIONS[sunset.locationId].name}. ${qualityText(sunset.quality)}`
      : 'The trip ran out before you caught a final sunset, but every day was yours.',
    stats: tripStats(state),
    favourite,
    bestMemory: best,
    highlights,
    memories: state.player.memories,
    finalMessage: FINAL_MESSAGE,
  }
}
