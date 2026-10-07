import { describe, expect, it } from 'vitest'
import type { DaySummary, GameAction, GameState, LocationId, Memory, TripEnding } from '../types'
import { createInitialState } from './initialState'
import { bestMemory, FINAL_MESSAGE, favouriteLocation, tripRecap } from './recap'
import { gameReducer } from './reducer'
import { adventureScore, rankFor } from './score'

const memory = (id: string, locationId: LocationId, day: number, extra: Partial<Memory> = {}): Memory => ({
  id,
  title: id,
  description: '',
  day,
  minuteOfDay: 12 * 60,
  locationId,
  ...extra,
})

interface TripShape {
  days?: number
  places?: LocationId[]
  questsDone?: number
  spent?: number
  km?: number
  memories?: Memory[]
  xp?: number
  level?: number
  ending?: TripEnding | null
  activities?: string[]
  endingBonus?: number
}

/** An example finished trip, built from the real state shape with only the tracked values set. */
function trip(t: TripShape): GameState {
  const base = createInitialState(7)
  return {
    ...base,
    phase: 'ended',
    ending: t.ending === undefined ? 'trip-over' : t.ending,
    daySummaries: Array.from({ length: t.days ?? 3 }, (_, i) => ({ day: i + 1 }) as DaySummary),
    discoveredLocationIds: t.places ?? ['baga'],
    quests: base.quests.map((q, i) => (i < (t.questsDone ?? 0) ? { ...q, status: 'completed' } : q)),
    completedActivities: (t.activities ?? []).map((activityId) => ({ activityId, day: 1 })),
    scoreBonuses: t.endingBonus ? [{ id: 'final-sunset', label: 'Final sunset', points: t.endingBonus }] : [],
    player: {
      ...base.player,
      xp: t.xp ?? 0,
      level: t.level ?? 1,
      memories: t.memories ?? [],
      stats: { ...base.player.stats, moneySpent: t.spent ?? 0, kmTraveled: t.km ?? 0 },
    },
  }
}

const points = (state: GameState, id: string) => adventureScore(state).lines.find((l) => l.id === id)?.points

describe('Adventure Score', () => {
  it('a lazy trip: three days at Baga, nothing done → Tourist', () => {
    const score = adventureScore(trip({}))
    // 3 days × 100 + 1 place × 75; nothing else earns points (no activity, so no under-budget bonus).
    expect(score.total).toBe(375)
    expect(score.rank.title).toBe('Tourist')
    expect(score.nextRank).toEqual({ rank: expect.objectContaining({ title: 'Explorer' }), pointsNeeded: 1125 })
  })

  it('an average trip → Explorer', () => {
    const score = adventureScore(
      trip({
        places: ['baga', 'anjuna', 'vagator'],
        questsDone: 1,
        spent: 2400,
        km: 40,
        memories: [memory('a', 'baga', 1), memory('b', 'anjuna', 2), memory('c', 'vagator', 2)],
        xp: 160,
        level: 2,
        activities: ['baga-swim', 'anjuna-flea-market'],
        endingBonus: 200,
      }),
    )
    // 300 + 225 + 150 + 120 (₹2,400) + 80 (40 km) + 120 + 160 + 100 + 200 under budget + 200 ending
    expect(score.total).toBe(1655)
    expect(score.rank.title).toBe('Explorer')
  })

  it('a great trip → Local Legend', () => {
    const score = adventureScore(
      trip({
        places: ['baga', 'anjuna', 'vagator', 'fontainhas', 'palolem'],
        questsDone: 3,
        spent: 4200,
        km: 190,
        memories: Array.from({ length: 9 }, (_, i) => memory(`m${i}`, 'palolem', 3)),
        xp: 480,
        level: 3,
        activities: ['palolem-kayak'],
        endingBonus: 500,
      }),
    )
    // 300 + 375 + 450 + 210 + 300 (km capped) + 360 + 480 + 200 + 200 + 500
    expect(score.total).toBe(3375)
    expect(score.rank.title).toBe('Local Legend')
    expect(score.nextRank).toBeNull()
  })

  it('weights each tracked value, with caps so nothing can be farmed', () => {
    const s = trip({ spent: 99_999, km: 5000, xp: 42, level: 3 })
    expect(points(s, 'money')).toBe(250)
    expect(points(s, 'km')).toBe(300)
    expect(points(s, 'xp')).toBe(42)
    expect(points(s, 'level')).toBe(200)
  })

  it('gives the under-budget bonus only for a finished trip that did something within ₹4,800', () => {
    expect(points(trip({ spent: 4800, activities: ['baga-swim'] }), 'under-budget')).toBe(200)
    expect(points(trip({ spent: 4801, activities: ['baga-swim'] }), 'under-budget')).toBeUndefined()
    expect(points(trip({ spent: 0 }), 'under-budget')).toBeUndefined()
    expect(points(trip({ spent: 100, activities: ['baga-swim'], ending: null }), 'under-budget')).toBeUndefined()
  })

  it('has clear rank thresholds', () => {
    expect(rankFor(0).title).toBe('Tourist')
    expect(rankFor(1499).title).toBe('Tourist')
    expect(rankFor(1500).title).toBe('Explorer')
    expect(rankFor(2799).title).toBe('Explorer')
    expect(rankFor(2800).title).toBe('Local Legend')
  })

  it('is pure: same state, same score, nothing changed', () => {
    const state = trip({ spent: 1000, km: 20 })
    const copy = structuredClone(state)
    expect(adventureScore(state)).toEqual(adventureScore(state))
    expect(state).toEqual(copy)
  })

  it('the lines add up to the total', () => {
    const score = adventureScore(trip({ spent: 1234, km: 33, xp: 77, questsDone: 2 }))
    expect(score.lines.reduce((sum, l) => sum + l.points, 0)).toBe(score.total)
  })
})

describe('My Goa Summer recap', () => {
  it('picks the favourite place from memories, activities, visits and the final sunset', () => {
    const state = {
      ...trip({
        memories: [memory('a', 'anjuna', 1), memory('b', 'anjuna', 2), memory('c', 'baga', 1)],
        activities: ['anjuna-flea-market', 'baga-swim'],
      }),
    }
    expect(favouriteLocation(state)).toEqual({ locationId: 'anjuna', reason: '2 memories and 1 thing done' })
    expect(favouriteLocation(trip({}))).toBeNull()
  })

  it('picks the best memory: story moments first, by worth', () => {
    const state = trip({
      memories: [
        memory('photo', 'baga', 1, { photo: true }),
        memory('road', 'palolem', 2, { storyId: 'successful-road-trip' }),
        memory('kind', 'anjuna', 3, { storyId: 'local-kindness' }),
      ],
    })
    expect(bestMemory(state)?.id).toBe('road')
    expect(bestMemory(trip({}))).toBeNull()
  })

  it('personalises the highlights and ends with the final message', () => {
    const recap = tripRecap(
      trip({
        places: ['baga', 'palolem'],
        spent: 1500,
        km: 82,
        memories: [memory('road', 'palolem', 2, { storyId: 'successful-road-trip', title: 'Road Trip', emoji: '🛣️' })],
        activities: ['palolem-kayak'],
      }),
    )
    expect(recap.highlights).toEqual([
      'Your favourite place was 🌴 Palolem Beach: 1 memory and 1 thing done.',
      'Your best memory: 🛣️ Road Trip, on Day 2 at Palolem Beach.',
      'You found Palolem Beach, the place most tourists never see.',
      'You covered 82 km and spent ₹1,500, under your ₹4,800 budget.',
    ])
    expect(recap.finalMessage).toBe("You didn't just visit Goa, you experienced it.")
    // The place isn't repeated when the memory's title already names it.
    const named = tripRecap(trip({ memories: [memory('s', 'baga', 3, { title: 'The Final Sunset at Baga Beach' })] }))
    expect(named.highlights[1]).toBe('Your best memory: 📸 The Final Sunset at Baga Beach, on Day 3.')
    expect(FINAL_MESSAGE).toBe(recap.finalMessage)
    expect(recap.stats.map((s) => s.label)).toEqual([
      'Days played', 'Places discovered', 'Quests completed', 'Money spent', 'Kilometres travelled', 'Memories collected',
      'XP earned', 'Level reached',
    ])
  })
})

describe('the ending, played for real', () => {
  const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
  const toDay3 = () => {
    let s = run(createInitialState(3), { type: 'BEGIN_DAY' })
    for (let day = 1; day < 3; day++) s = run(s, { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
    return s
  }

  it('the Final Sunset quest completing goes straight to the recap, with the ending bonus scored', () => {
    const state = run(toDay3(), { type: 'WATCH_FINAL_SUNSET' })
    expect(state.phase).toBe('ended')
    expect(state.ending).toBe('final-sunset')
    expect(adventureScore(state).lines.find((l) => l.id === 'ending')?.points).toBe(state.finalSunset?.scoreBonus)
    expect(tripRecap(state).endingLine).toMatch(/^You watched your final sunset from Baga Beach\./)
  })

  it('Day 3 ending without a sunset also goes to the recap', () => {
    const state = run(toDay3(), { type: 'ADVANCE_TIME', minutes: 13 * 60 })
    expect(state.phase).toBe('ended')
    expect(state.ending).toBe('trip-over')
    expect(tripRecap(state).endingTitle).toBe('✈️ Time to fly home')
    expect(adventureScore(state).lines.some((l) => l.id === 'ending')).toBe(false)
  })

  it('play again fully resets the game', () => {
    const ended = run(toDay3(), { type: 'WATCH_FINAL_SUNSET' })
    const fresh = run(ended, { type: 'RESET_GAME' })
    const { rngSeed: _a, ...restFresh } = fresh
    const { rngSeed: _b, ...restNew } = createInitialState(fresh.rngSeed)
    expect(restFresh).toEqual(restNew)
    expect(fresh.phase).toBe('day-intro')
    expect(adventureScore(fresh).total).toBe(0 + 75) // a new trip: only Baga known
  })
})
