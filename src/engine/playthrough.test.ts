import { describe, expect, it } from 'vitest'
import { LOCATIONS } from '../data/locations'
import { parseCommand } from '../parser'
import type { EventId, GameState } from '../types'
import { formatClock } from './clock'
import { STARTING_VALUES } from './config'
import { createInitialState } from './initialState'
import { levelForXp } from './player'
import { tripRecap } from './recap'
import { gameReducer } from './reducer'
import { adventureScore } from './score'

/**
 * Whole-trip simulations: three days played only through natural voice commands (parsed and
 * mapped exactly as in the game), answering every event popup and local's offer by speaking.
 * Four kinds of player, many seeds, so chance events vary. Guards the full loop: quests can be
 * completed, events happen, stats stay consistent, money lasts, and the trip always ends.
 */

const EVENT_ANSWERS: Record<string, string[]> = {
  'scooter-trouble': ["I'll ask someone nearby, I don't want to spend money"],
  'friendly-local': ['tell me about places tourists never find', 'chai sounds lovely', 'no thanks'],
  'sudden-shower': ['buy a raincoat', 'wait it out'],
  'food-stall': ['eat at the stall', 'just a taste'],
}

function sim(seed: number, plan: (say: (t: string) => void, until: (t: string, ok: (s: GameState) => boolean, max?: number) => void, get: () => GameState) => void) {
  let s = createInitialState(seed)
  const log: string[] = []
  const eventsSeen: string[] = []
  const tag = () => `[D${s.clock.day} ${formatClock(s.clock.minuteOfDay).padStart(8)} ${LOCATIONS[s.currentLocationId].name.slice(0, 10).padEnd(10)} ₹${String(s.player.money).padStart(5)} ⚡${String(s.player.energy).padStart(3)} XP${s.player.xp} ${s.phase}]`
  const raw = (text: string) => {
    const before = tag()
    s = gameReducer(s, {
      type: 'COMMAND',
      command: parseCommand(text, {
        currentLocationId: s.currentLocationId,
        pendingQuestion: s.activeEvent !== null || s.pendingHelp !== null,
        hasScooterToday: s.scooterRentedOnDay === s.clock.day,
      }),
    })
    const r = s.commandLog[s.commandLog.length - 1]
    log.push(`${before} > "${text}" → ${r.outcome}: ${r.result.slice(0, 170)}${s.questUpdates.length ? `\n      quests: ${s.questUpdates.map((u) => u.text.slice(0, 90)).join(' | ')}` : ''}`)
  }
  const say = (text: string) => {
    raw(text)
    for (let guard = 0; guard < 4 && (s.activeEvent || s.pendingHelp); guard++) {
      if (s.activeEvent) {
        const id = s.activeEvent.eventId
        eventsSeen.push(id)
        log.push(`      ⚡ EVENT ${id}`)
        const options = EVENT_ANSWERS[id]
        for (const answer of options) {
          raw(answer)
          if (!s.activeEvent) break
        }
      } else if (s.pendingHelp) raw('yes please')
    }
  }
  const until = (text: string, ok: (st: GameState) => boolean, max = 6) => {
    for (let i = 0; i < max && !ok(s); i++) say(text)
  }
  plan(say, until, () => s)
  return { s, log, eventsSeen }
}

/** A thoughtful player: follows the quests, mixes walking, scooter and taxis, eats and rests. */
const thoughtful: Parameters<typeof sim>[1] = (say, until, get) => {
  // Day 1: Baga → Anjuna → Vagator for the Lost Sunset.
  say('start')
  say('ask the shack owner about sunsets')
  say('I wanna go swimming')
  say('find me cheap food nearby')
  say('yes')
  say('shop at the flea market')
  say('how much is a taxi to vagator')
  say('take me to vagator')
  say('climb to chapora fort')
  say('wait for the sunset')
  say('watch the sunset')
  say('how much money do I have')
  say('end the day')
  say('continue')
  // Day 2: the road trip by scooter, north to central and back.
  say('start')
  say('rent a scooter')
  say('use my tourist map')
  say('take me to panjim by scooter')
  say('take photos of the painted houses')
  say('have bebinca at the bakery')
  say('ride to anjuna by scooter')
  say('take me to baga by scooter')
  say('go parasailing')
  say('ask a local')
  say('show my quests')
  say('end the day')
  say('continue')
  // Day 3: the far south if we found it, and the final sunset.
  say('start')
  say('rent a scooter')
  const south = get().foundClueIds.includes('palolem-clue') || get().discoveredLocationIds.includes('palolem')
  say(south ? 'take me to palolem by scooter' : 'take me to vagator by scooter')
  if (south) {
    say('kayak to butterfly beach')
    say('lie in a hammock')
  }
  say('watch the sunset')
  until('continue', (s) => s.phase === 'ended', 2)
}

/** A spender: taxis everywhere, the priciest activities and meals. */
const spender: Parameters<typeof sim>[1] = (say, until) => {
  say('start')
  say('go parasailing')
  say('eat the seafood dinner here')
  say('take a taxi to anjuna')
  say('buy a beach festival ticket')
  say('shop at the flea market')
  say('take a taxi to vagator')
  say('watch the sunset')
  say('end the day')
  say('continue')
  say('start')
  say('take a taxi to panjim')
  say('take the river cruise')
  say('take a taxi to anjuna')
  say('eat a fish thali')
  say('take a taxi to baga')
  say('end the day')
  say('continue')
  say('start')
  say('how much money do I have')
  say('take a taxi to vagator')
  say('watch the sunset')
  until('continue', (s) => s.phase === 'ended', 2)
}

/** A frugal walker: free activities, walking only, no scooter. */
const frugal: Parameters<typeof sim>[1] = (say, until) => {
  say('start')
  say('ask the shack owner about sunsets')
  say('look for shells on the beach')
  say('walk to anjuna')
  say('walk to vagator')
  say('wait for the sunset')
  say('watch the sunset')
  say('end the day')
  say('continue')
  say('start')
  say('walk to anjuna')
  say('ask a local')
  say('end the day')
  say('continue')
  say('start')
  say('walk to vagator')
  say('watch the sunset')
  until('continue', (s) => s.phase === 'ended', 2)
}

/** A casual player: follows the quests but always takes taxis, and eats real meals. */
const casual: Parameters<typeof sim>[1] = (say, until, get) => {
  say('start')
  say('ask the shack owner about sunsets')
  say('go swimming')
  say('take a taxi to anjuna')
  say('eat a fish thali here')
  say('shop at the flea market')
  say('take a taxi to vagator')
  say('wait for the sunset')
  say('watch the sunset')
  say('end the day')
  say('continue')
  say('start')
  say('rent a scooter')
  say('use my tourist map')
  say('take me to panjim by scooter')
  say('have bebinca at the bakery')
  say('take me to anjuna by scooter')
  say('take me to baga by scooter')
  say('eat the seafood dinner here')
  say('end the day')
  say('continue')
  say('start')
  say('how much money do I have')
  const south = get().foundClueIds.includes('palolem-clue') || get().discoveredLocationIds.includes('palolem')
  say(south ? 'take a taxi to palolem' : 'take a taxi to vagator')
  say('watch the sunset')
  until('continue', (s) => s.phase === 'ended', 2)
}


const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1)
type Plan = Parameters<typeof sim>[1]
const runs = new Map<Plan, ReturnType<typeof sim>[]>()
const play = (plan: Plan) => runs.get(plan) ?? (runs.set(plan, SEEDS.map((seed) => sim(seed, plan))), runs.get(plan)!)

/** Every tracked stat agrees with the records it summarises. */
function expectConsistent(s: GameState) {
  const p = s.player
  expect(p.stats.kmTraveled).toBe(s.tripLog.reduce((sum, t) => sum + t.distanceKm, 0))
  expect(p.stats.moneySpent).toBe(STARTING_VALUES.money - p.money)
  expect(p.stats.placesDiscovered).toBe(s.discoveredLocationIds.length)
  expect(p.level).toBe(levelForXp(p.xp))
  expect(s.daySummaries.reduce((a, d) => a + d.moneySpent, 0)).toBe(p.stats.moneySpent)
  expect(s.daySummaries.reduce((a, d) => a + d.kmTraveled, 0)).toBe(p.stats.kmTraveled)
}

describe('a thoughtful player', () => {
  it('completes all three quests and reaches the final sunset on every seed', { timeout: 30_000 }, () => {
    for (const { s } of play(thoughtful)) {
      expect(s.quests.map((q) => q.status)).toEqual(['completed', 'completed', 'completed'])
      expect(s).toMatchObject({ phase: 'ended', ending: 'final-sunset' })
      expectConsistent(s)
    }
  })

  it('meets every random event across the runs, and all four in a single trip', { timeout: 30_000 }, () => {
    const seen = play(thoughtful).map((r) => new Set(r.eventsSeen))
    const all: EventId[] = ['scooter-trouble', 'friendly-local', 'sudden-shower', 'food-stall']
    for (const id of all) expect(seen.some((set) => set.has(id))).toBe(true)
    expect(seen.some((set) => all.every((id) => set.has(id)))).toBe(true)
  })

  it('discovers places, collects memories, and earns a top score with a personal recap', { timeout: 30_000 }, () => {
    for (const { s } of play(thoughtful)) {
      expect(s.discoveredLocationIds.length).toBeGreaterThanOrEqual(4)
      expect(s.player.memories.length).toBeGreaterThanOrEqual(8)
      const score = adventureScore(s)
      expect(score.rank.title).toBe('Local Legend')
      const recap = tripRecap(s)
      expect(recap.endingTitle).not.toBe('✈️ Time to fly home')
      expect(recap.stats.find((st) => st.id === 'quests')?.value).toBe('3 of 3')
    }
    // Following the local's or the map's clue leads to the hidden gem.
    expect(play(thoughtful).some(({ s }) => s.discoveredLocationIds.includes('palolem'))).toBe(true)
  })

  it('reaches Explorer on Day 1 and Local Legend no earlier than Day 2', { timeout: 30_000 }, () => {
    for (const { s } of play(thoughtful)) {
      expect(s.daySummaries[0].xpEarned).toBeLessThan(450)
      expect(s.player.level).toBe(3)
    }
  })
})

describe('balance: money lasts', () => {
  it('a casual player who always takes taxis still has money on Day 3 and finishes every quest', { timeout: 30_000 }, () => {
    for (const { s } of play(casual)) {
      expect(s.daySummaries[1].moneyLeft).toBeGreaterThanOrEqual(1500)
      expect(s.quests.every((q) => q.status === 'completed')).toBe(true)
      expectConsistent(s)
    }
  })

  it('a big spender can run out, but the trip still ends with a final sunset', { timeout: 30_000 }, () => {
    for (const { s } of play(spender)) {
      expect(s).toMatchObject({ phase: 'ended', ending: 'final-sunset' })
      expectConsistent(s)
    }
  })

  it('a frugal walker spends nothing and still finishes', { timeout: 30_000 }, () => {
    for (const { s } of play(frugal)) {
      expect(s.phase).toBe('ended')
      expect(s.player.money).toBe(STARTING_VALUES.money)
      expectConsistent(s)
    }
  })
})
