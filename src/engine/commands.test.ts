import { describe, expect, it } from 'vitest'
import { parseCommand } from '../parser'
import type { GameAction, GameState } from '../types'
import { changedForReal, describeChanges, gateReason, recordCommand } from './commands'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const playing = () => run(createInitialState(), { type: 'BEGIN_DAY' })
const parsed = parseCommand('test')

describe('describeChanges: what really changed', () => {
  it('reports location, energy, time and discoveries after a trip', () => {
    const before = playing()
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })
    expect(describeChanges(before, after)).toEqual({
      location: { from: 'baga', to: 'anjuna' },
      money: null,
      energy: { from: 100, to: 88 },
      time: { from: { day: 1, minuteOfDay: 540 }, to: { day: 1, minuteOfDay: 620 } },
      quests: [],
      discoveries: ['🗺️ Discovered Anjuna'],
    })
  })

  it('reports money spent', () => {
    const before = playing()
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' })
    expect(describeChanges(before, after).money).toEqual({ from: 5000, to: 4500 })
  })

  it('reports quest steps, clues and memories', () => {
    const before = playing()
    const after = run(before, { type: 'DO_ACTIVITY', activityId: 'baga-ask-shack-owner' })
    const changes = describeChanges(before, after)
    expect(changes.quests).toEqual(['🌅 The Lost Sunset: ✓ Ask the shack owner at Baga where to find the best sunset in Goa'])
    expect(changes.discoveries).toEqual(['🧭 Found a new clue'])
  })

  it('reports quest status changes', () => {
    const before = run(playing(), { type: 'DO_ACTIVITY', activityId: 'baga-ask-shack-owner' })
    const after = run(before, { type: 'ADVANCE_TIME', minutes: 10 * 60 }) // past sunset
    expect(describeChanges(before, after).quests).toContain('🌅 The Lost Sunset: failed, retry pending')
  })
})

describe('changedForReal', () => {
  it('is false when only the message changed (a refused action)', () => {
    const before = playing()
    const after = run(before, { type: 'TRAVEL', to: 'vagator', mode: 'walk' }) // too far
    expect(after.notice).toMatch(/Too far/)
    expect(changedForReal(before, after)).toBe(false)
  })

  it('is true when the game really changed', () => {
    const before = playing()
    expect(changedForReal(before, run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' }))).toBe(true)
  })
})

describe('gateReason: why an action was ignored', () => {
  it('explains each screen and a waiting event', () => {
    expect(gateReason(createInitialState())).toMatch(/hasn't started/)
    expect(gateReason(run(playing(), { type: 'END_DAY' }))).toMatch(/day is over/)
    expect(gateReason(run(playing(), { type: 'FORCE_EVENT', eventId: 'sudden-shower' }))).toMatch(/choose what to do first/)
    expect(gateReason(playing())).toBeNull()
  })
})

describe('recordCommand: success or refusal, a reason, and what changed', () => {
  it('records a successful action with the game’s own message and the real changes', () => {
    const before = playing()
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })
    const record = recordCommand(before, after, parsed, { kind: 'actions', actions: [{ type: 'TRAVEL', to: 'anjuna', mode: 'walk' }] })
      .commandLog[0]
    expect(record).toMatchObject({ outcome: 'success', actions: ['TRAVEL'], actionCount: 1 })
    expect(record.result).toMatch(/Walked to Anjuna/)
    expect(record.changes.location).toEqual({ from: 'baga', to: 'anjuna' })
  })

  it('records a refused action with the engine’s reason and no changes', () => {
    const before = playing()
    const after = run(before, { type: 'TRAVEL', to: 'vagator', mode: 'walk' })
    const state = recordCommand(before, after, parsed, { kind: 'actions', actions: [{ type: 'TRAVEL', to: 'vagator', mode: 'walk' }] })
    const record = state.commandLog[0]
    expect(record.outcome).toBe('refused')
    expect(record.result).toMatch(/Too far to walk/)
    expect(record.changes).toEqual({ location: null, money: null, energy: null, time: null, quests: [], discoveries: [] })
    expect(state.notice).toBe(record.result)
  })

  it('explains an action the reducer ignored without a message', () => {
    const before = createInitialState() // day not started
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })
    const record = recordCommand(before, after, parsed, { kind: 'actions', actions: [{ type: 'TRAVEL', to: 'anjuna', mode: 'walk' }] })
      .commandLog[0]
    expect(record).toMatchObject({ outcome: 'refused', result: "Day 1 hasn't started yet." })
  })

  it('records answers, refusals and misunderstandings', () => {
    const s = playing()
    expect(recordCommand(s, s, parsed, { kind: 'answer', text: 'Hi' }).commandLog[0]).toMatchObject({ outcome: 'answered', result: 'Hi' })
    expect(recordCommand(s, s, parsed, { kind: 'refuse', reason: 'No' }).commandLog[0]).toMatchObject({ outcome: 'refused', result: 'No' })
    expect(recordCommand(s, s, parsed, { kind: 'not-understood', reason: '?' }).commandLog[0].outcome).toBe('not-understood')
  })

  it('keeps only the five most recent commands', () => {
    let state = playing()
    for (let i = 0; i < 7; i++) state = recordCommand(state, state, parseCommand(`c${i}`), { kind: 'answer', text: `${i}` })
    expect(state.commandLog.map((c) => c.result)).toEqual(['2', '3', '4', '5', '6'])
    expect(state.commandLog.map((c) => c.id)).toEqual([3, 4, 5, 6, 7])
  })
})
