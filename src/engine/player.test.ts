import { describe, expect, it } from 'vitest'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { addItem, addXp, changeEnergy, levelForXp, levelInfo, recordMemory, spendMoney, xpProgress } from './player'

/** Level thresholds come from the level data, so these tests follow any rebalancing. */
const EXPLORER = levelInfo(2).minXp
const LEGEND = levelInfo(3).minXp

describe('spendMoney', () => {
  it('subtracts money and tracks total spent', () => {
    const state = spendMoney(spendMoney(createInitialState(), 1200), 300)
    expect(state.player.money).toBe(3500)
    expect(state.player.stats.moneySpent).toBe(1500)
  })

  it('allows spending exactly everything', () => {
    expect(spendMoney(createInitialState(), 5000).player.money).toBe(0)
  })

  it('never lets money go below 0 and explains why', () => {
    const state = spendMoney(createInitialState(), 5001)
    expect(state.player.money).toBe(5000)
    expect(state.player.stats.moneySpent).toBe(0)
    expect(state.notice).toMatch(/not enough money/i)
  })

  it('ignores zero, negative and non-finite amounts', () => {
    const start = createInitialState()
    expect(spendMoney(start, 0)).toBe(start)
    expect(spendMoney(start, -500)).toBe(start)
    expect(spendMoney(start, Number.POSITIVE_INFINITY)).toBe(start)
  })
})

describe('changeEnergy', () => {
  it('uses and restores energy', () => {
    const tired = changeEnergy(createInitialState(), -30)
    expect(tired.player.energy).toBe(70)
    expect(changeEnergy(tired, 10).player.energy).toBe(80)
  })

  it('never goes above 100', () => {
    expect(changeEnergy(createInitialState(), 50).player.energy).toBe(100)
  })

  it('never goes below 0', () => {
    expect(changeEnergy(createInitialState(), -250).player.energy).toBe(0)
  })

  it('ignores non-finite deltas', () => {
    const start = createInitialState()
    expect(changeEnergy(start, Number.NaN)).toBe(start)
  })
})

describe('XP and levels', () => {
  it.each([
    [0, 1],
    [EXPLORER - 1, 1],
    [EXPLORER, 2],
    [LEGEND - 1, 2],
    [LEGEND, 3],
    [9999, 3],
  ])('%i XP is level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level)
  })

  it('adds XP and levels up with a notice', () => {
    const state = addXp(createInitialState(), EXPLORER + 20)
    expect(state.player.xp).toBe(EXPLORER + 20)
    expect(state.player.level).toBe(2)
    expect(state.levelUp).toEqual({ level: 2, title: 'Explorer', perk: expect.stringMatching(/scooter/i) })
  })

  it('caps the level at 3', () => {
    expect(addXp(createInitialState(), 5000).player.level).toBe(3)
  })

  it('ignores zero or negative XP', () => {
    const start = createInitialState()
    expect(addXp(start, 0)).toBe(start)
    expect(addXp(start, -10)).toBe(start)
  })

  it('reports progress toward the next level', () => {
    expect(xpProgress(40)).toEqual({ level: 1, isMaxLevel: false, intoLevel: 40, levelSpan: EXPLORER })
    expect(xpProgress(EXPLORER + 30)).toEqual({ level: 2, isMaxLevel: false, intoLevel: 30, levelSpan: LEGEND - EXPLORER })
    expect(xpProgress(LEGEND + 50)).toEqual({ level: 3, isMaxLevel: true, intoLevel: 50, levelSpan: 0 })
  })
})

describe('addItem', () => {
  it('adds a new item after the starting kit', () => {
    const state = addItem(createInitialState(), 'festival-ticket')
    expect(state.player.inventory).toContainEqual({ itemId: 'festival-ticket', quantity: 1 })
    expect(state.player.inventory).toHaveLength(4)
  })

  it('stacks repeat items', () => {
    const state = addItem(addItem(createInitialState(), 'shell'), 'shell', 2)
    expect(state.player.inventory).toContainEqual({ itemId: 'shell', quantity: 3 })
  })

  it('refuses unknown items', () => {
    const start = createInitialState()
    const state = addItem(start, 'jetpack')
    expect(state.player.inventory).toEqual(start.player.inventory)
    expect(state.notice).toMatch(/no item/i)
  })

  it('ignores invalid quantities', () => {
    const start = createInitialState()
    expect(addItem(start, 'shell', 0)).toBe(start)
    expect(addItem(start, 'shell', 1.5)).toBe(start)
  })
})

describe('recordMemory', () => {
  it('stamps the memory with day, time and location', () => {
    const later = advanceTime(createInitialState(), 60)
    const state = recordMemory(later, { title: '  First sunset ', description: 'Orange sky over the sea.' })
    expect(state.player.memories).toEqual([
      {
        id: 'memory-1',
        title: 'First sunset',
        description: 'Orange sky over the sea.',
        day: 1,
        minuteOfDay: 600,
        locationId: 'baga',
      },
    ])
  })

  it('gives each memory its own id', () => {
    const one = recordMemory(createInitialState(), { title: 'A', description: '' })
    const two = recordMemory(one, { title: 'B', description: '' })
    expect(two.player.memories.map((m) => m.id)).toEqual(['memory-1', 'memory-2'])
  })

  it('ignores memories without a title', () => {
    const start = createInitialState()
    expect(recordMemory(start, { title: '   ', description: 'x' })).toBe(start)
  })
})
