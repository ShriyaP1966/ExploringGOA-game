import { describe, expect, it } from 'vitest'
import { createInitialState } from './initialState'
import {
  discoverLocation,
  findClue,
  getRoute,
  getTravelLeg,
  isLocationDiscovered,
  isLocationVisible,
  mapPinStatus,
  startingDiscoveredLocationIds,
  visibleLocationIds,
} from './locations'

describe('getRoute', () => {
  it('finds a route in either direction', () => {
    const there = getRoute('baga', 'palolem')
    expect(there?.distanceKm).toBe(82)
    expect(getRoute('palolem', 'baga')).toBe(there)
  })

  it('has no route from a place to itself', () => {
    expect(getRoute('baga', 'baga')).toBeUndefined()
  })
})

describe('getTravelLeg', () => {
  it('returns the time and cost for a travel mode', () => {
    expect(getTravelLeg('anjuna', 'baga', 'taxi')).toEqual({ minutes: 20, cost: 500 })
    expect(getTravelLeg('anjuna', 'baga', 'scooter')).toEqual({ minutes: 15, cost: 0 })
    expect(getTravelLeg('baga', 'anjuna', 'walk')).toEqual({ minutes: 80, cost: 0 })
  })
})

describe('discovery and visibility', () => {
  it('discovers only Baga at the start', () => {
    expect(startingDiscoveredLocationIds()).toEqual(['baga'])
    const state = createInitialState()
    expect(isLocationDiscovered(state, 'baga')).toBe(true)
    expect(isLocationDiscovered(state, 'anjuna')).toBe(false)
  })

  it('shows undiscovered places on the map but keeps Palolem completely hidden', () => {
    const state = createInitialState()
    expect(visibleLocationIds(state)).toEqual(['baga', 'anjuna', 'vagator', 'fontainhas'])
    expect(isLocationVisible(state, 'palolem')).toBe(false)
  })

  it('reveals Palolem once its clue is found', () => {
    const state = { ...createInitialState(), foundClueIds: ['palolem-clue' as const] }
    expect(isLocationVisible(state, 'palolem')).toBe(true)
  })
})

describe('mapPinStatus', () => {
  it('marks where you are, fogs undiscovered places and hides Palolem', () => {
    const state = createInitialState()
    expect(mapPinStatus(state, 'baga')).toBe('current')
    expect(mapPinStatus(state, 'anjuna')).toBe('fogged')
    expect(mapPinStatus(state, 'fontainhas')).toBe('fogged')
    expect(mapPinStatus(state, 'palolem')).toBe('hidden')
  })

  it('shows a discovered place that is not the current one as discovered', () => {
    const state = discoverLocation(createInitialState(), 'anjuna')
    expect(mapPinStatus(state, 'anjuna')).toBe('discovered')
  })

  it('takes Palolem from hidden to fogged to discovered', () => {
    let state = createInitialState()
    expect(mapPinStatus(state, 'palolem')).toBe('hidden')
    state = findClue(state, 'palolem-clue')
    expect(mapPinStatus(state, 'palolem')).toBe('fogged')
    state = discoverLocation(state, 'palolem')
    expect(mapPinStatus(state, 'palolem')).toBe('discovered')
  })
})

describe('discoverLocation', () => {
  it('adds the location once, with a notice', () => {
    const state = discoverLocation(createInitialState(), 'vagator')
    expect(state.discoveredLocationIds).toEqual(['baga', 'vagator'])
    expect(state.notice).toMatch(/Vagator/)
    expect(discoverLocation(state, 'vagator')).toBe(state)
  })
})

describe('findClue', () => {
  it('records the clue once', () => {
    const state = findClue(createInitialState(), 'palolem-clue')
    expect(state.foundClueIds).toEqual(['palolem-clue'])
    expect(findClue(state, 'palolem-clue')).toBe(state)
  })
})
