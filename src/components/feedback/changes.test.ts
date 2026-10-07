import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../engine/initialState'
import { levelInfo } from '../../engine/player'
import { gameReducer } from '../../engine/reducer'
import type { GameAction, GameState } from '../../types'
import { formatDelta, isRewind, statDeltas, toastsFor } from './changes'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const day1 = () => run(createInitialState(4), { type: 'BEGIN_DAY' })

describe('floating numbers', () => {
  it('reports money, energy and XP changes from a real action', () => {
    const before = day1()
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' })
    const deltas = statDeltas(before, after)
    expect(deltas.find((d) => d.stat === 'money')?.amount).toBeLessThan(0)
    expect(deltas.find((d) => d.stat === 'energy')?.amount).toBeLessThan(0)
    expect(deltas.find((d) => d.stat === 'xp')?.amount).toBeGreaterThan(0) // discovering Anjuna
  })

  it('formats signed numbers the way the HUD shows them', () => {
    expect(formatDelta({ stat: 'money', amount: -1200 })).toBe('−₹1,200')
    expect(formatDelta({ stat: 'money', amount: 500 })).toBe('+₹500')
    expect(formatDelta({ stat: 'energy', amount: -20 })).toBe('−20')
    expect(formatDelta({ stat: 'xp', amount: 25 })).toBe('+25 XP')
  })

  it('stays quiet when nothing changed, and on a new trip', () => {
    const state = day1()
    expect(statDeltas(state, state)).toEqual([])
    const spent = run(state, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }, { type: 'ADVANCE_TIME', minutes: 120 })
    const fresh = run(spent, { type: 'RESET_GAME' })
    expect(isRewind(spent, fresh)).toBe(true)
    expect(statDeltas(spent, fresh)).toEqual([])
    expect(toastsFor(spent, fresh)).toEqual([])
  })
})

describe('toasts', () => {
  it('announces a discovery and the XP it earned', () => {
    const before = day1()
    const toasts = toastsFor(before, run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' }))
    expect(toasts.map((t) => t.kind)).toEqual(['discovery', 'xp'])
    expect(toasts[0]).toMatchObject({ title: 'New place discovered', text: '🛍️ Anjuna' })
  })

  it('announces quest news and memories', () => {
    const before = day1()
    const after = run(before, { type: 'DO_ACTIVITY', activityId: 'baga-ask-shack-owner' })
    const kinds = toastsFor(before, after).map((t) => t.kind)
    expect(kinds).toContain('quest')
    // A quest starting on Day 1 is news too.
    const started = toastsFor(createInitialState(4), day1()).find((t) => t.kind === 'quest' && t.title === 'New quest')
    expect(started?.text).toMatch(/^🌅 The Lost Sunset\. /) // without repeating "New quest:
  })

  it('celebrates a level-up', () => {
    const before = day1()
    const toasts = toastsFor(before, run(before, { type: 'ADD_XP', amount: levelInfo(2).minXp }))
    expect(toasts.find((t) => t.kind === 'level')?.title).toBe('Level up! You are now an Explorer')
  })

  it('announces a new memory', () => {
    const before = run(day1(), { type: 'TRAVEL', to: 'vagator', mode: 'taxi' })
    const after = run(before, { type: 'DO_ACTIVITY', activityId: 'vagator-chapora-climb' })
    expect(toastsFor(before, after).find((t) => t.kind === 'memory')?.text).toMatch(/Chapora Fort/)
  })

  it('does not repeat news on a later action that brings none', () => {
    const before = day1()
    const after = run(before, { type: 'TRAVEL', to: 'anjuna', mode: 'taxi' })
    const nothing = { ...after, commandLog: [...after.commandLog] }
    expect(toastsFor(after, nothing)).toEqual([])
  })
})
