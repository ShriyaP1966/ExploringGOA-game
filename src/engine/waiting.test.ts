import { describe, expect, it } from 'vitest'
import { parseCommand } from '../parser'
import type { CommandRecord, GameAction, GameState, LocationId } from '../types'
import { FINALE_RULES } from './config'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const say = (state: GameState, text: string) =>
  gameReducer(state, { type: 'COMMAND', command: parseCommand(text, { currentLocationId: state.currentLocationId }) })
const last = (state: GameState): CommandRecord => state.commandLog[state.commandLog.length - 1]
const h = (hour: number, minute = 0) => hour * 60 + minute

/** Playing on a given day, at a place and time (reached through the normal day cycle). */
function at(day: number, place: LocationId, minute: number, money?: number): GameState {
  let s = run(createInitialState(3), { type: 'BEGIN_DAY' })
  for (let d = 1; d < day; d++) s = run(s, { type: 'END_DAY' }, { type: 'CONTINUE_AFTER_SUMMARY' }, { type: 'BEGIN_DAY' })
  s = { ...s, currentLocationId: place, discoveredLocationIds: [...new Set([...s.discoveredLocationIds, place])] }
  s = run(s, { type: 'ADVANCE_TIME', minutes: minute - s.clock.minuteOfDay })
  return money === undefined ? s : { ...s, player: { ...s.player, money } }
}

describe('waiting', () => {
  it('"wait for the sunset" lets time pass until the evening, without needing to be tired', () => {
    const before = at(1, 'vagator', h(14))
    const after = say(before, 'wait for the sunset')
    expect(after.clock.minuteOfDay).toBe(FINALE_RULES.waitUntil)
    expect(after.player.energy).toBe(before.player.energy)
    expect(last(after)).toMatchObject({ outcome: 'success', result: 'You wait until 6:00 PM.' })
  })

  it('"wait a bit" waits an hour, and never past the end of the day', () => {
    expect(say(at(1, 'baga', h(11)), 'wait a bit').clock.minuteOfDay).toBe(h(12))
    expect(say(at(1, 'baga', h(21, 30)), 'wait here').clock.minuteOfDay).toBe(h(21, 59))
  })

  it('asking for an activity that opens later today waits for it, then does it', () => {
    const after = say(at(1, 'vagator', h(14)), 'watch the sunset')
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['ADVANCE_TIME', 'DO_ACTIVITY'] })
    expect(last(after).result).toMatch(/^You wait until 5:30 PM\. 🌅 Sunset over Ozran Beach/)
    expect(after.completedActivities.some((a) => a.activityId === 'vagator-ozran-sunset')).toBe(true)
  })

  it('does not wait for something you still could not do then, and says the real reason', () => {
    const after = say(at(2, 'fontainhas', h(10), 150), 'take the river cruise')
    expect(last(after)).toMatchObject({ outcome: 'refused' })
    expect(last(after).result).toMatch(/Not enough money/)
    expect(after.clock.minuteOfDay).toBe(h(10))
  })
})

describe('the final sunset can always happen', () => {
  it('when broke, at a place whose sunset activity costs money, the free final sunset is used', () => {
    const after = say(at(3, 'fontainhas', h(9, 30), 150), 'watch the sunset')
    expect(after).toMatchObject({ phase: 'ended', ending: 'final-sunset' })
    expect(after.finalSunset?.locationId).toBe('fontainhas')
  })

  it('in the morning, at a place with a free sunset spot, it waits for the evening', () => {
    const after = say(at(3, 'vagator', h(10)), 'watch the sunset')
    expect(after).toMatchObject({ phase: 'ended', ending: 'final-sunset' })
  })

  it('"watch my final sunset here" always means the finale', () => {
    expect(say(at(3, 'anjuna', h(15)), 'watch my final sunset here').ending).toBe('final-sunset')
  })
})

describe('using items by voice', () => {
  it('"use my tourist map" uses it, through the same rules as the inventory button', () => {
    const before = at(2, 'vagator', h(9, 30))
    const after = say(before, 'use my tourist map')
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['USE_ITEM'] })
    expect(after.mapUsedOnDay).toBe(2)
    expect(last(say(after, 'check the map')).outcome).toBe('refused') // once a day
  })

  it('explains items that work by themselves, and items you do not have', () => {
    const state = at(1, 'baga', h(10))
    expect(last(say(state, 'use my camera')).result).toMatch(/^📷 Camera: .*works by itself/)
    expect(last(say(state, 'use the raincoat'))).toMatchObject({ outcome: 'refused', result: "You don't have a raincoat." })
  })
})

describe('result messages', () => {
  it('say what happened instead of a bare "Done."', () => {
    const ended = say(at(1, 'baga', h(15)), 'end the day')
    expect(last(ended).result).toMatch(/Day 1 is over/)
    const morning = say(ended, 'continue')
    expect(last(morning).result).toMatch(/Good morning! Day 2/)
  })
})
