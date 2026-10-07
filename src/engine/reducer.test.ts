import { describe, expect, it } from 'vitest'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

/** A fresh game past the Day 1 intro, ready to play. */
function playing() {
  return gameReducer(createInitialState(), { type: 'BEGIN_DAY' })
}

describe('gameReducer', () => {
  it('routes every action to its rule', () => {
    let state = playing()
    state = gameReducer(state, { type: 'SPEND_MONEY', amount: 500 })
    state = gameReducer(state, { type: 'CHANGE_ENERGY', delta: -20 })
    state = gameReducer(state, { type: 'ADVANCE_TIME', minutes: 60 })
    state = gameReducer(state, { type: 'ADD_XP', amount: 50 })
    state = gameReducer(state, { type: 'ADD_ITEM', itemId: 'shell' })
    state = gameReducer(state, { type: 'RECORD_MEMORY', memory: { title: 'Fish thali', description: '' } })

    expect(state.player.money).toBe(4500)
    expect(state.player.stats.moneySpent).toBe(500)
    expect(state.player.energy).toBe(80)
    expect(state.clock.minuteOfDay).toBe(600)
    expect(state.player.xp).toBe(50 + 10) // + memory XP
    expect(state.player.inventory).toContainEqual({ itemId: 'shell', quantity: 1 })
    expect(state.player.memories).toHaveLength(1)
  })

  it('does not mutate the previous state', () => {
    const before = playing()
    const snapshot = structuredClone(before)
    gameReducer(before, { type: 'TRAVEL', to: 'anjuna', mode: 'walk' })
    gameReducer(before, { type: 'END_DAY' })
    gameReducer(before, { type: 'SPEND_MONEY', amount: 100 })
    gameReducer(before, { type: 'ADD_ITEM', itemId: 'shell' })
    gameReducer(before, { type: 'RECORD_MEMORY', memory: { title: 'Beach', description: '' } })
    expect(before).toEqual(snapshot)
  })

  it('clears the previous notice on the next action', () => {
    const refused = gameReducer(playing(), { type: 'SPEND_MONEY', amount: 99999 })
    expect(refused.notice).not.toBeNull()
    const next = gameReducer(refused, { type: 'CHANGE_ENERGY', delta: -5 })
    expect(next.notice).toBeNull()
  })

  it('routes discovery and clue actions', () => {
    let state = gameReducer(playing(), { type: 'FIND_CLUE', clueId: 'palolem-clue' })
    state = gameReducer(state, { type: 'DISCOVER_LOCATION', locationId: 'palolem' })
    expect(state.foundClueIds).toEqual(['palolem-clue'])
    expect(state.discoveredLocationIds).toContain('palolem')
  })

  it('resets to a fresh game', () => {
    const played = gameReducer(playing(), { type: 'SPEND_MONEY', amount: 1000 })
    const reset = gameReducer(played, { type: 'RESET_GAME' })
    expect({ ...reset, rngSeed: 0 }).toEqual({ ...createInitialState(), rngSeed: 0 })
    expect(reset.rngSeed).not.toBe(played.rngSeed)
  })
})
