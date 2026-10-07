import { describe, expect, it } from 'vitest'
import type { GameState } from '../types'
import { doActivity, quoteActivity } from './activities'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { changeEnergy, levelInfo, spendMoney } from './player'

function at(minuteOfDay: number, state: GameState = createInitialState()): GameState {
  return advanceTime(state, minuteOfDay - state.clock.minuteOfDay)
}

function reason(state: GameState, id: string) {
  const check = quoteActivity(state, id)
  return check.ok ? null : check.reason
}

describe('doActivity', () => {
  it('applies cost, energy, time and XP', () => {
    const state = doActivity(createInitialState(), 'baga-parasailing')
    expect(state.player.money).toBe(3800)
    expect(state.player.stats.moneySpent).toBe(1200)
    expect(state.player.energy).toBe(85)
    expect(state.clock.minuteOfDay).toBe(9 * 60 + 45)
    expect(state.player.xp).toBe(30 + 10) // activity XP + photo memory XP
    expect(state.completedActivities).toEqual([{ activityId: 'baga-parasailing', day: 1 }])
    expect(state.notice).toMatch(/Go parasailing: 45 min · ₹1,200 · ⚡−15 · \+30 XP/)
  })

  it('lets meals restore energy (up to 100)', () => {
    const hungry = changeEnergy(createInitialState(), -50)
    expect(doActivity(hungry, 'baga-shack-dinner').player.energy).toBe(70)
  })

  it('raises a level-up notice when XP crosses a level', () => {
    let state = doActivity(createInitialState(), 'baga-parasailing')
    state = { ...state, player: { ...state.player, xp: levelInfo(2).minXp - 5 } }
    expect(doActivity(state, 'baga-swim').levelUp).toMatchObject({ level: 2, title: 'Explorer' })
  })
})

describe('activity refusals', () => {
  it('only allows activities at your current location', () => {
    expect(reason(createInitialState(), 'palolem-kayak')).toMatch(/isn't something you can do here/i)
  })

  it('allows each activity once per day', () => {
    const swum = doActivity(createInitialState(), 'baga-swim')
    expect(reason(swum, 'baga-swim')).toMatch(/already done this today/i)
    expect(quoteActivity(advanceTime(swum, 24 * 60), 'baga-swim').ok).toBe(true)
  })

  it('respects start-time windows', () => {
    expect(reason(at(16 * 60, { ...createInitialState(), currentLocationId: 'anjuna' }), 'anjuna-cliff-sunset')).toMatch(
      /starts from 5:30 PM/,
    )
    expect(reason(at(19 * 60, { ...createInitialState(), currentLocationId: 'anjuna' }), 'anjuna-cliff-sunset')).toMatch(
      /last start is 6:45 PM/,
    )
    expect(reason(at(17 * 60 + 30), 'baga-parasailing')).toMatch(/too late/i)
  })

  it('refuses without enough money or energy', () => {
    expect(reason(spendMoney(createInitialState(), 4000), 'baga-parasailing')).toMatch(/not enough money/i)
    expect(reason(changeEnergy(createInitialState(), -95), 'baga-parasailing')).toMatch(/too tired.*⚡15.*⚡5/i)
    // Meals never need energy.
    expect(quoteActivity(changeEnergy(createInitialState(), -100), 'baga-shack-dinner').ok).toBe(true)
  })

  it('refuses activities that would run past 10 PM', () => {
    expect(reason(at(21 * 60 + 30), 'baga-sunbed')).toMatch(/not enough time left today/i)
  })
})
