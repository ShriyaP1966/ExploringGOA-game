import { describe, expect, it } from 'vitest'
import type { GameState } from '../types'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { findClue } from './locations'
import { changeEnergy, spendMoney } from './player'
import { checkScooterRental, hasScooterToday, quoteTravel, rentScooter, travel, travelEnergy } from './travel'

/** 9:00 AM on the given day, at Baga. */
function onDay(day: number): GameState {
  return advanceTime(createInitialState(), (day - 1) * 24 * 60)
}

function reason(state: GameState, ...args: Parameters<typeof quoteTravel> extends [GameState, ...infer R] ? R : never) {
  const check = quoteTravel(state, ...args)
  return check.ok ? null : check.reason
}

describe('travelEnergy', () => {
  it('scales with distance and mode, with a minimum of 1', () => {
    expect(travelEnergy(6, 'walk')).toBe(12)
    expect(travelEnergy(82, 'scooter')).toBe(33)
    expect(travelEnergy(82, 'taxi')).toBe(9)
    expect(travelEnergy(4, 'taxi')).toBe(1)
  })
})

describe('walking', () => {
  it('walks to a nearby place: free, with energy, time and distance', () => {
    const state = travel(createInitialState(), 'anjuna', 'walk')
    expect(state.currentLocationId).toBe('anjuna')
    expect(state.player.money).toBe(5000)
    expect(state.player.stats.moneySpent).toBe(0)
    expect(state.player.energy).toBe(88)
    expect(state.clock.minuteOfDay).toBe(9 * 60 + 80)
    expect(state.player.stats.kmTraveled).toBe(6)
  })

  it('refuses long walks with the distance and limit', () => {
    expect(reason(createInitialState(), 'vagator', 'walk')).toMatch(/too far to walk.*10 km.*6 km/i)
    expect(reason(onDay(2), 'fontainhas', 'walk')).toMatch(/too far to walk/i)
  })
})

describe('taxi', () => {
  it('charges the fare and tracks it as money spent', () => {
    const state = travel(onDay(2), 'fontainhas', 'taxi')
    expect(state.player.money).toBe(5000 - 850)
    expect(state.player.stats.moneySpent).toBe(850)
    expect(state.player.energy).toBe(100 - 2)
    expect(state.clock.minuteOfDay).toBe(9 * 60 + 40)
    expect(state.player.stats.kmTraveled).toBe(16)
  })

  it('refuses when the fare is unaffordable', () => {
    const broke = spendMoney(onDay(2), 4700)
    const check = quoteTravel(broke, 'fontainhas', 'taxi')
    expect(check.ok).toBe(false)
    expect(check.ok ? '' : check.reason).toMatch(/not enough money.*₹850.*₹300/i)
    expect(travel(broke, 'fontainhas', 'taxi').currentLocationId).toBe('baga')
  })
})

describe('scooter rental', () => {
  it('is not available on day 1', () => {
    const check = checkScooterRental(createInitialState())
    expect(check.ok).toBe(false)
    expect(check.ok ? '' : check.reason).toMatch(/from Day 2/)
    expect(reason(createInitialState(), 'anjuna', 'scooter')).toMatch(/from Day 2/)
  })

  it('must be rented before riding', () => {
    expect(reason(onDay(2), 'anjuna', 'scooter')).toMatch(/rent a scooter first.*₹400/i)
  })

  it('charges the day fee once and makes rides free that day', () => {
    let state = rentScooter(onDay(2))
    expect(hasScooterToday(state)).toBe(true)
    expect(state.player.money).toBe(4600)
    expect(state.player.stats.moneySpent).toBe(400)

    state = travel(state, 'palolem', 'scooter')
    expect(state.currentLocationId).toBe('baga') // Palolem is still hidden

    state = travel(state, 'fontainhas', 'scooter')
    expect(state.currentLocationId).toBe('fontainhas')
    expect(state.player.money).toBe(4600)
    expect(state.player.energy).toBe(100 - 7)
  })

  it('refuses a second rental on the same day', () => {
    const rented = rentScooter(onDay(2))
    const again = rentScooter(rented)
    expect(again.player.money).toBe(4600)
    expect(again.notice).toMatch(/already have a scooter/i)
  })

  it('expires at the end of the day', () => {
    const rented = rentScooter(onDay(2))
    const nextDay = advanceTime(rented, 24 * 60)
    expect(hasScooterToday(nextDay)).toBe(false)
    expect(reason(nextDay, 'anjuna', 'scooter')).toMatch(/rent a scooter first/i)
  })

  it('refuses the rental without enough money', () => {
    const broke = spendMoney(onDay(2), 4700)
    const after = rentScooter(broke)
    expect(after.scooterRentedOnDay).toBeNull()
    expect(after.notice).toMatch(/not enough money to rent/i)
  })
})

describe('travel refusals', () => {
  it('refuses when too tired, explaining what is needed', () => {
    const tired = changeEnergy(createInitialState(), -95)
    expect(reason(tired, 'anjuna', 'walk')).toMatch(/too tired.*⚡12.*⚡5/i)
    // A taxi needs far less energy, so it is still possible.
    expect(quoteTravel(tired, 'anjuna', 'taxi').ok).toBe(true)
  })

  it('refuses trips that would end after 10 PM', () => {
    const evening = advanceTime(createInitialState(), 12 * 60 + 30) // 9:30 PM
    expect(reason(evening, 'anjuna', 'walk')).toMatch(/not enough time left today.*1 h 20 min.*10:00 PM/i)
    expect(quoteTravel(evening, 'anjuna', 'taxi').ok).toBe(true) // 20 min arrives at 9:50 PM
  })

  it('refuses travelling to where you already are', () => {
    expect(reason(createInitialState(), 'baga', 'taxi')).toMatch(/already at Baga/)
  })

  it('keeps Palolem unreachable until its clue is found', () => {
    expect(reason(createInitialState(), 'palolem', 'taxi')).toMatch(/don't know/i)
    expect(quoteTravel(findClue(onDay(2), 'palolem-clue'), 'palolem', 'taxi').ok).toBe(true)
  })

  it('leaves the state unchanged apart from the reason', () => {
    const start = createInitialState()
    const refused = travel(start, 'vagator', 'walk')
    expect({ ...refused, notice: null }).toEqual(start)
    expect(refused.notice).toMatch(/too far/i)
  })
})

describe('arriving', () => {
  it('discovers a fogged place and says so', () => {
    const state = travel(createInitialState(), 'anjuna', 'walk')
    expect(state.discoveredLocationIds).toEqual(['baga', 'anjuna'])
    expect(state.visitedLocationIds).toEqual(['baga', 'anjuna'])
    expect(state.notice).toMatch(/Walked to Anjuna: 1 h 20 min · 6 km · ⚡−12\. .*New place discovered/)
  })

  it('does not repeat discovery when returning', () => {
    let state = travel(createInitialState(), 'anjuna', 'walk')
    state = travel(state, 'baga', 'walk')
    expect(state.discoveredLocationIds).toEqual(['baga', 'anjuna'])
    expect(state.visitedLocationIds).toEqual(['baga', 'anjuna'])
    expect(state.player.stats.kmTraveled).toBe(12)
    expect(state.notice).not.toMatch(/discovered/i)
  })

  it('mentions the fare for paid trips', () => {
    expect(travel(createInitialState(), 'anjuna', 'taxi').notice).toMatch(/Took a taxi to Anjuna.*₹500/)
  })

  it('reaches Palolem by scooter after finding the clue on day 2', () => {
    let state = findClue(onDay(2), 'palolem-clue')
    state = rentScooter(state)
    state = travel(state, 'palolem', 'scooter')
    expect(state.currentLocationId).toBe('palolem')
    expect(state.player.stats.kmTraveled).toBe(82)
    expect(state.player.money).toBe(4600)
    // 15 min at the rental shop, then the 2 h 15 min ride
    expect(state.clock.minuteOfDay).toBe(9 * 60 + 15 + 135)
  })
})
