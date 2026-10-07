import { describe, expect, it } from 'vitest'
import { parseCommand } from '../parser'
import type { CommandRecord, GameAction, GameState } from '../types'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { recommend } from './recommend'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const say = (state: GameState, text: string) =>
  gameReducer(state, { type: 'COMMAND', command: parseCommand(text, { currentLocationId: state.currentLocationId }) })
const last = (state: GameState): CommandRecord => state.commandLog[state.commandLog.length - 1]
const NO_CHANGES = { location: null, money: null, energy: null, time: null, quests: [], discoveries: [] }

const day1 = () => run(createInitialState(), { type: 'BEGIN_DAY' })
const day2 = () => run(day1(), { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
const withMoney = (s: GameState, money: number): GameState => ({ ...s, player: { ...s.player, money } })
const withEnergy = (s: GameState, energy: number): GameState => ({ ...s, player: { ...s.player, energy } })

describe('"I want a beautiful beach that isn\'t too crowded"', () => {
  it('favours scenic, low-crowd beaches', () => {
    const { best, alternatives } = recommend(day1(), parseCommand("I want a beautiful beach that isn't too crowded"))
    expect(best?.locationId).toBe('vagator') // beauty 5, crowds 3, a beach
    expect(best?.why).toEqual(expect.arrayContaining(['beauty 5/5', 'not too crowded (3/5)', 'a beach']))
    expect(alternatives.map((a) => a.locationId)).toContain('anjuna')
  })

  it('recommends, explains why, and asks for a yes without moving', () => {
    const state = say(day1(), "I want a beautiful beach that isn't too crowded")
    expect(last(state)).toMatchObject({ outcome: 'answered', changes: NO_CHANGES })
    expect(last(state).result).toMatch(/^I'd go to 🏰 Vagator & Chapora Fort: beauty 5\/5.*Getting there: 🚕 taxi 30 min, ₹650.*Say "yes" to go\.$/)
    expect(state.currentLocationId).toBe('baga')
  })

  it('goes there, the recommended way, on "yes"', () => {
    const state = say(say(day1(), "I want a beautiful beach that isn't too crowded"), 'yes')
    expect(last(state)).toMatchObject({ outcome: 'success', actions: ['TRAVEL'] })
    expect(state.currentLocationId).toBe('vagator')
    expect(state.tripLog[0].mode).toBe('taxi')
  })
})

describe('"find me cheap food nearby"', () => {
  it('picks the nearest affordable meal, not just the nearest meal', () => {
    // Baga's shack dinner (₹600, right here) is not cheap; Anjuna's fish thali (₹350) is a free walk away.
    const { best } = recommend(day1(), parseCommand('find me cheap food nearby'), 'food')
    expect(best).toMatchObject({ locationId: 'anjuna', totalCost: 350 })
    expect(best?.activity?.id).toBe('anjuna-fish-thali')
    expect(best?.travel?.mode).toBe('walk')
  })

  it('never offers something that is not a meal', () => {
    const { best, alternatives } = recommend(day1(), parseCommand('find me cheap food nearby'), 'food')
    for (const option of [best, ...alternatives]) expect(option?.activity?.meal).toBe(true)
  })

  it('"yes" goes there and eats', () => {
    const state = say(say(day1(), 'find me cheap food nearby'), 'yes')
    expect(last(state)).toMatchObject({ outcome: 'success', actions: ['TRAVEL', 'DO_ACTIVITY'] })
    expect(state.currentLocationId).toBe('anjuna')
    expect(state.player.money).toBe(5000 - 350)
  })

  it('without "cheap", food right here wins', () => {
    const state = say(day1(), 'find me food')
    expect(last(state).result).toMatch(/^Right here at Baga Beach: 🦐 Seafood dinner at a beach shack, ₹600/)
    expect(last(state).suggestion).toEqual({ kind: 'activity', activityId: 'baga-shack-dinner' })
  })
})

describe('"I\'m tired take me somewhere relaxing"', () => {
  it('favours relaxing places that cost little energy', () => {
    const { best } = recommend(day2(), parseCommand("I'm tired take me somewhere relaxing"))
    expect(best?.locationId).toBe('fontainhas') // relaxing 4/5, the most relaxing place you can reach
    expect(best?.travel?.mode).toBe('taxi') // the low-effort way
    expect(best?.energyCost).toBeLessThanOrEqual(5)
    expect(best?.why).toContain('relaxing 4/5')
  })

  it('with little energy, picks a low-effort way and rules out what would need too much', () => {
    const { best, ruledOut } = recommend(withEnergy(day1(), 10), parseCommand('somewhere beautiful'))
    // Walking to Anjuna (⚡12) is too much, so the taxi (⚡1) is chosen instead.
    expect(best).toMatchObject({ locationId: 'anjuna' })
    expect(best?.travel?.mode).toBe('taxi')
    expect(ruledOut).toContainEqual({ locationId: 'vagator', reason: 'needs ⚡21, you have ⚡10' })
  })
})

describe('"I have eight hundred rupees left find somewhere beautiful that costs less than two hundred"', () => {
  const request = 'I have eight hundred rupees left find somewhere beautiful that costs less than two hundred'

  it('obeys the budget: anything over ₹200 is ruled out', () => {
    const { best, ruledOut } = recommend(day1(), parseCommand(request))
    expect(best?.locationId).toBe('anjuna')
    expect(best?.totalCost).toBeLessThanOrEqual(200)
    expect(ruledOut).toContainEqual({ locationId: 'vagator', reason: '₹650 is over your ₹200 limit' })
  })

  it('picks the most beautiful place once it fits the budget (scooter rented, ride free)', () => {
    const rented = run(day2(), { type: 'RENT_SCOOTER' })
    expect(recommend(rented, parseCommand(request)).best).toMatchObject({ locationId: 'vagator', totalCost: 0 })
  })

  it('trusts the real money, and says so in what the game understood', () => {
    const state = say(day1(), request)
    expect(last(state).notes).toEqual([
      "You said you have ₹800 left, but you really have ₹5,000: I'm going by your real money.",
    ])
  })

  it('also when the player claims more than they have', () => {
    const poor = withMoney(day1(), 300)
    const parsed = parseCommand('I have 5000 rupees left, find somewhere beautiful')
    // The travel rules themselves check the real money.
    expect(recommend(poor, parsed).ruledOut).toContainEqual({
      locationId: 'vagator',
      reason: 'Not enough money: the taxi costs ₹650, you have ₹300.',
    })
    expect(last(say(poor, 'I have 5000 rupees left, find somewhere beautiful')).notes[0]).toMatch(/really have ₹300/)
  })

  it('adds no note when the amount matches', () => {
    expect(last(say(day1(), 'I have 5000 rupees left, find somewhere beautiful')).notes).toEqual([])
  })
})

describe('time of day', () => {
  it('in the afternoon, favours making the sunset', () => {
    const afternoon = advanceTime(day2(), 7 * 60) // 4 PM
    expect(recommend(afternoon, parseCommand('somewhere beautiful')).best?.why).toContain('in time for sunset')
  })

  it('in the morning, sunset is not a reason yet', () => {
    expect(recommend(day2(), parseCommand('somewhere beautiful')).best?.why).not.toContain('in time for sunset')
  })

  it('late in the evening, closer places win', () => {
    const late = advanceTime(day2(), 10 * 60 + 30) // 7:30 PM
    const { best } = recommend(late, parseCommand('somewhere relaxing'))
    expect(best?.distanceKm).toBeLessThanOrEqual(10)
  })
})

describe('"what\'s the cheapest way there?"', () => {
  it('compares walking, scooter and taxi without moving', () => {
    const asked = say(say(day1(), 'find somewhere beautiful'), "what's the cheapest way there")
    const record = last(asked)
    expect(record).toMatchObject({ outcome: 'answered', changes: NO_CHANGES })
    expect(record.result).toMatch(/^To Anjuna \(6 km\): 🚶 Walk: 1 h 20 min · free · ⚡12/)
    expect(record.result).toMatch(/🛵 Scooter: .*\(not possible now\)/)
    expect(record.result).toMatch(/🚕 Taxi: 20 min · ₹500 · ⚡1/)
    expect(record.result).toMatch(/Cheapest you can do now: walk \(free\)\. Say "yes" to go that way\./)
    expect(asked.currentLocationId).toBe('baga')
  })

  it('counts the scooter rental in the comparison when you would still have to rent', () => {
    const asked = say(day2(), 'what is the cheapest way to panjim')
    expect(last(asked).result).toMatch(/🛵 Scooter: 35 min · ₹400 rental \(ride free\) \(rent one first\)/)
  })

  it('"yes" then goes the cheapest way', () => {
    const state = say(say(say(day1(), 'find somewhere beautiful'), "what's the cheapest way there"), 'yes')
    expect(state.currentLocationId).toBe('anjuna')
    expect(state.tripLog[0].mode).toBe('walk')
  })
})

describe('when nothing fits', () => {
  it('says so, with the reasons', () => {
    const state = say(withEnergy(day1(), 3), 'find somewhere beautiful')
    expect(last(state).result).toMatch(/^Nothing you can reach fits that right now \(.*needs ⚡/)
  })
})
