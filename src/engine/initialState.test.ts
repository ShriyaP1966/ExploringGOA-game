import { describe, expect, it } from 'vitest'
import { createInitialState } from './initialState'

describe('createInitialState', () => {
  it('starts the trip with the agreed values', () => {
    const state = createInitialState()
    expect(state.player.money).toBe(5000)
    expect(state.player.energy).toBe(100)
    expect(state.player.level).toBe(1)
    expect(state.player.xp).toBe(0)
    expect(state.player.inventory).toEqual([
      { itemId: 'camera', quantity: 1 },
      { itemId: 'tourist-map', quantity: 1 },
      { itemId: 'sunglasses', quantity: 1 },
    ])
    expect(state.player.memories).toEqual([])
    expect(state.player.stats).toEqual({ kmTraveled: 0, moneySpent: 0, placesDiscovered: 1 })
    expect(state.clock).toEqual({ day: 1, minuteOfDay: 9 * 60 })
    expect(state.notice).toBeNull()
  })

  it('arrives at Baga, the only discovered location', () => {
    const state = createInitialState()
    expect(state.currentLocationId).toBe('baga')
    expect(state.visitedLocationIds).toEqual(['baga'])
    expect(state.discoveredLocationIds).toEqual(['baga'])
    expect(state.foundClueIds).toEqual([])
  })

  it('returns a fresh object each time', () => {
    expect(createInitialState()).not.toBe(createInitialState())
    expect(createInitialState().player.inventory).not.toBe(createInitialState().player.inventory)
  })
})
