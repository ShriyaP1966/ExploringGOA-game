import { describe, expect, it } from 'vitest'
import { parseCommand } from '../parser'
import type { CommandRecord, GameAction, GameState } from '../types'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

/** Speaks a command through the real path: parser → action mapper → engine. */
function say(state: GameState, text: string): GameState {
  const context = {
    currentLocationId: state.currentLocationId,
    pendingQuestion: state.activeEvent !== null || state.pendingHelp !== null,
  }
  return gameReducer(state, { type: 'COMMAND', command: parseCommand(text, context) })
}
const last = (state: GameState): CommandRecord => state.commandLog[state.commandLog.length - 1]
const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const NO_CHANGES = { location: null, money: null, energy: null, time: null, quests: [], discoveries: [] }

const day1 = () => run(createInitialState(), { type: 'BEGIN_DAY' })
const day2 = () =>
  run(createInitialState(), { type: 'BEGIN_DAY' }, { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
const day3 = () => run(day2(), { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
const withMoney = (state: GameState, money: number): GameState => ({ ...state, player: { ...state.player, money } })
const withEnergy = (state: GameState, energy: number): GameState => ({ ...state, player: { ...state.player, energy } })

/** Asserts the command was refused with a matching reason and that nothing in the game changed. */
function expectRefused(before: GameState, after: GameState, reason: RegExp) {
  const record = last(after)
  expect(record.outcome).toBe('refused')
  expect(record.result).toMatch(reason)
  expect(record.changes).toEqual(NO_CHANGES)
  expect(after.player).toEqual(before.player)
  expect(after.clock).toEqual(before.clock)
  expect(after.currentLocationId).toBe(before.currentLocationId)
  // The refusal is also shown as the game's notice, so it is never silent.
  expect(after.notice).toBe(record.result)
}

describe('a command cannot bypass the rules', () => {
  it('money: travelling without enough money is refused, with the price and what you have', () => {
    const before = withMoney(day1(), 100)
    const after = say(before, 'take a taxi to anjuna')
    expectRefused(before, after, /Not enough money: the taxi costs ₹500, you have ₹100/)
  })

  it('money: with no mode named, the refusal still names the real problem', () => {
    // Walking is too far and scooters aren't available on Day 1, so the taxi's price is the real obstacle.
    const before = withMoney(day1(), 100)
    expectRefused(before, say(before, 'take me to vagator'), /Not enough money: the taxi costs ₹650/)
  })

  it('scooter rental: refused on Day 1, with the reason and when it opens', () => {
    const before = day1()
    const after = say(before, 'rent a scooter')
    expectRefused(before, after, /need a day to check your licence\. You can rent one from Day 2/)
    expect(after.scooterRentedOnDay).toBeNull()
  })

  it('scooter rental: refused without the fee', () => {
    // Day 3: on Day 2 the Road Trip would also fail with so little money, which is a different story.
    const before = withMoney(day3(), 300)
    expectRefused(before, say(before, 'rent a scooter'), /Not enough money to rent a scooter: it costs ₹400/)
  })

  it('a refusal stays a refusal even when quests react, and their reaction is still reported', () => {
    // Day 2 with ₹300: the rental is refused, and the Road Trip fails its "money above ₹500" rule.
    const before = withMoney(day2(), 300)
    const after = say(before, 'rent a scooter')
    const record = last(after)
    expect(record.outcome).toBe('refused')
    expect(record.result).toMatch(/Not enough money to rent a scooter/)
    expect(after.scooterRentedOnDay).toBeNull()
    expect(record.changes.quests).toContain('🛵 The Road Trip: failed')
  })

  it('the day: Day 1 is North Goa only', () => {
    const before = day1()
    expectRefused(before, say(before, 'take a taxi to panjim'), /Day 1 is for settling in around North Goa.*Day 2/)
  })

  it('distance: no walking to faraway places', () => {
    const before = day1()
    expectRefused(before, say(before, 'walk to vagator'), /Too far to walk: .* 10 km away \(6 km at most\)/)
  })

  it('energy: too tired to walk', () => {
    const before = withEnergy(day1(), 5)
    expectRefused(before, say(before, 'walk to anjuna'), /Too tired: this trip needs ⚡12 energy and you have ⚡5/)
  })

  it('time: no trips that end after 10 PM', () => {
    // Day 3 at 9:50 PM: no quest reacts to the late hour, so only the time rule is tested.
    const before = advanceTime(day3(), 12 * 60 + 50)
    expectRefused(before, say(before, 'take a taxi to anjuna'), /Not enough time left today/)
  })

  it('discovery: a hidden place cannot be reached by naming it', () => {
    const before = day2()
    const after = say(before, 'take me to palolem')
    expectRefused(before, after, /You don't know of any place like that yet/)
    expect(after.discoveredLocationIds).not.toContain('palolem')
  })

  it('pending events: nothing else happens until you choose', () => {
    const before = run(day1(), { type: 'FORCE_EVENT', eventId: 'sudden-shower' })
    const after = say(before, 'take me to anjuna')
    expectRefused(before, after, /Sorry, I couldn't match that to what's happening \(🌧️ Unexpected rain\)\. You can say/)
    expect(after.activeEvent).not.toBeNull()
  })

  it('the day must have started', () => {
    const before = createInitialState()
    expectRefused(before, say(before, 'take me to anjuna'), /Day 1 hasn't started yet/)
  })

  it('activities: only what is on offer here', () => {
    const before = { ...day2(), currentLocationId: 'fontainhas' as const }
    expectRefused(before, say(before, 'I want to go swimming'), /nothing like that at Fontainhas, Panaji\. Try/)
  })

  it('activities: not without the money', () => {
    const before = withMoney({ ...day1(), currentLocationId: 'anjuna' as const }, 100)
    expectRefused(before, say(before, 'shopping at the flea market'), /Not enough money: this costs ₹250/)
  })

  it('your own budget: a trip over the limit you set is refused', () => {
    const before = day1()
    expectRefused(before, say(before, 'take a taxi to anjuna for under 100 rupees'), /costs more than your ₹100 limit \(taxi: ₹500\)/)
  })

  it('resting: no need when full of energy', () => {
    const before = day1()
    expectRefused(before, say(before, 'I need a rest'), /full of energy/)
  })
})

describe('allowed commands really happen, with what changed', () => {
  it('travel: picks a sensible way to go and reports the real changes', () => {
    const after = say(day1(), 'take me to anjuna')
    const record = last(after)
    expect(record).toMatchObject({ outcome: 'success', actions: ['TRAVEL'] })
    expect(record.result).toMatch(/Walked to Anjuna/)
    expect(record.changes.location).toEqual({ from: 'baga', to: 'anjuna' })
    expect(record.changes.discoveries).toEqual(['🗺️ Discovered Anjuna'])
    expect(after.currentLocationId).toBe('anjuna')
  })

  it('travel: "without spending money" walks rather than paying', () => {
    const after = say(day1(), "take me to anjuna, I don't want to spend money")
    expect(after.player.money).toBe(5000)
    expect(after.currentLocationId).toBe('anjuna')
  })

  it('renting a scooter on Day 2 charges the fee', () => {
    const after = say(day2(), 'rent a scooter')
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['RENT_SCOOTER'] })
    expect(last(after).changes.money).toEqual({ from: 5000, to: 4600 })
  })

  it('travel to "somewhere relaxing" recommends a place, says why, and goes on "yes"', () => {
    let state = say(day2(), "I'm tired take me somewhere relaxing")
    const record = last(state)
    expect(record.outcome).toBe('answered')
    expect(record.result).toMatch(/^I'd go to .+: .*relaxing.* Say "yes" to go\./)
    expect(state.currentLocationId).toBe('baga')
    state = say(state, 'yes')
    expect(last(state).outcome).toBe('success')
    expect(state.currentLocationId).not.toBe('baga')
  })

  it('finding a place only answers; "take me there" then goes', () => {
    let state = say(day2(), 'find me a quiet place')
    expect(last(state)).toMatchObject({ outcome: 'answered', changes: NO_CHANGES })
    const suggested = last(state).suggestion
    expect(suggested?.kind).toBe('travel')
    state = say(state, 'take me there')
    expect(last(state).outcome).toBe('success')
    expect(state.currentLocationId).toBe(suggested?.kind === 'travel' ? suggested.locationId : null)
  })

  it('finding food suggests a meal here; "yes" eats it', () => {
    let state = say(day1(), 'find me food')
    expect(last(state).outcome).toBe('answered')
    expect(last(state).suggestion).toEqual({ kind: 'activity', activityId: 'baga-shack-dinner' })
    state = say(state, 'yes')
    expect(last(state)).toMatchObject({ outcome: 'success', actions: ['DO_ACTIVITY'] })
    expect(last(state).changes.money).toEqual({ from: 5000, to: 4400 })
  })

  it('event choices can be spoken', () => {
    const before = run(day1(), { type: 'FORCE_EVENT', eventId: 'sudden-shower' })
    const after = say(before, 'wait it out in a bar')
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['CHOOSE_EVENT_OPTION'] })
    expect(after.activeEvent).toBeNull()
    expect(after.eventLog[0].choiceId).toBe('wait')
  })

  it('event choices still follow their rules', () => {
    const before = withMoney(run(day1(), { type: 'FORCE_EVENT', eventId: 'sudden-shower' }), 50)
    const after = say(before, 'buy a raincoat')
    expect(last(after).outcome).toBe('refused')
    expect(after.activeEvent).not.toBeNull()
  })

  it('starting the day and continuing can be spoken', () => {
    let state = say(createInitialState(), "let's start")
    expect(state.phase).toBe('playing')
    state = say(state, 'end the day')
    expect(state.phase).toBe('day-summary')
    state = say(state, 'continue')
    expect(state.phase).toBe('day-intro')
  })

  it('asking a local, resting and the final sunset go through the engine', () => {
    expect(last(say(day1(), 'ask a local')).actions).toEqual(['ASK_LOCAL'])
    expect(last(say(withEnergy(day1(), 50), 'I need a rest')).changes.energy).toEqual({ from: 50, to: 65 })
  })
})

describe('questions are answered without changing anything', () => {
  it.each([
    ['how much money do I have', /₹5,000/],
    ['show my quests', /The Lost Sunset/],
    ["what's in my bag", /Camera/],
    ['how much is a taxi to anjuna', /To Anjuna \(6 km\):.*🚕 Taxi: 20 min · ₹500/],
    ['help', /Getting around: .*Right now you could say/],
  ])('"%s"', (text, expected) => {
    const before = day1()
    const after = say(before, text)
    expect(last(after)).toMatchObject({ outcome: 'answered', changes: NO_CHANGES })
    expect(last(after).result).toMatch(expected)
    expect(after.player).toEqual(before.player)
    expect(after.clock).toEqual(before.clock)
  })
})

describe('the parser never changes state', () => {
  it('parsing is pure: same input, same output, and the context is not touched', () => {
    const context = Object.freeze({ currentLocationId: 'baga' as const, pendingQuestion: false })
    expect(parseCommand('take me to anjuna', context)).toEqual(parseCommand('take me to anjuna', context))
  })

  it('a command that is not understood changes nothing but the history and the on-screen messages', () => {
    const before = day1()
    const after = say(before, 'hello goa')
    expect(last(after).outcome).toBe('not-understood')
    const game = ({ commandLog: _l, notice: _n, questUpdates: _q, levelUp: _u, newMemoryIds: _m, ...rest }: GameState) => rest
    expect(game(after)).toEqual(game(before))
  })

  it('clears the last action’s notifications, so nothing stale stays on screen', () => {
    const fed = say(say(day1(), 'find me food'), 'yes') // eating creates the Best Meal memory
    expect(fed.newMemoryIds).toHaveLength(1)
    const after = say(fed, 'how much money do I have')
    expect(after.newMemoryIds).toEqual([])
    expect(after.questUpdates).toEqual([])
    expect(after.levelUp).toBeNull()
  })

  it('every command records an outcome, a reason and what changed', () => {
    let state = day1()
    for (const text of ['take me to anjuna', 'rent a scooter', 'banana', 'how much money do I have', 'go swimming']) {
      state = say(state, text)
      const record = last(state)
      expect(['success', 'refused', 'answered', 'not-understood']).toContain(record.outcome)
      expect(record.result.length).toBeGreaterThan(3)
      expect(record.changes).toBeDefined()
    }
  })
})
