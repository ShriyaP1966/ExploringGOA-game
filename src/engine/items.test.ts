import { describe, expect, it } from 'vitest'
import type { GameState, LocationId } from '../types'
import { doActivity, quoteActivity } from './activities'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { findClue } from './locations'
import { activateItem, checkUseItem, directionWord, hasItem, itemQuantity, nextHintTarget, removeItem } from './items'
import { quoteTravel, travel } from './travel'

/** At a location on a given day and time (minutes since midnight). */
function at(locationId: LocationId, minuteOfDay: number, day = 1): GameState {
  const start = { ...createInitialState(), currentLocationId: locationId }
  return advanceTime(start, (day - 1) * 24 * 60 + minuteOfDay - start.clock.minuteOfDay)
}

const NOON = 13 * 60

function reason(state: GameState, activityId: string) {
  const check = quoteActivity(state, activityId)
  return check.ok ? null : check.reason
}

describe('starting kit', () => {
  it('starts with a camera, a map and sunglasses', () => {
    const state = createInitialState()
    expect(hasItem(state, 'camera')).toBe(true)
    expect(hasItem(state, 'tourist-map')).toBe(true)
    expect(hasItem(state, 'sunglasses')).toBe(true)
  })
})

describe('removeItem', () => {
  it('removes the entry when the last one is used', () => {
    expect(hasItem(removeItem(createInitialState(), 'camera'), 'camera')).toBe(false)
  })

  it('does nothing if you do not have enough', () => {
    const start = createInitialState()
    expect(removeItem(start, 'shell')).toBe(start)
  })
})

describe('sunglasses and the midday heat', () => {
  it('adds no heat in the morning', () => {
    expect(doActivity(at('baga', 10 * 60), 'baga-swim').player.energy).toBe(90)
  })

  it('reduces the extra energy lost to midday heat', () => {
    const withGlasses = doActivity(at('baga', NOON), 'baga-swim')
    expect(withGlasses.player.energy).toBe(100 - 10 - 2)
    expect(withGlasses.notice).toMatch(/sunglasses helped/)

    const without = doActivity(removeItem(at('baga', NOON), 'sunglasses'), 'baga-swim')
    expect(without.player.energy).toBe(100 - 10 - 6)
    expect(without.notice).toMatch(/Sunglasses would help/)
  })

  it('never adds heat to meals or indoor visits', () => {
    const hungry = { ...at('baga', NOON), player: { ...at('baga', NOON).player, energy: 50 } }
    expect(doActivity(hungry, 'baga-shack-dinner').player.energy).toBe(70)
    expect(doActivity(at('fontainhas', NOON), 'fontainhas-church').player.energy).toBe(95)
  })

  it('makes walking at midday more tiring', () => {
    const quote = (s: GameState) => {
      const q = quoteTravel(s, 'anjuna', 'walk')
      return q.ok ? q.quote.energy : null
    }
    expect(quote(at('baga', 10 * 60))).toBe(12)
    expect(quote(at('baga', NOON))).toBe(14)
    expect(quote(removeItem(at('baga', NOON), 'sunglasses'))).toBe(18)
    expect(travel(at('baga', NOON), 'anjuna', 'walk').player.energy).toBe(86)
  })

  it('counts the heat when checking if you are too tired', () => {
    const tired = { ...at('baga', NOON), player: { ...at('baga', NOON).player, energy: 11 } }
    expect(reason(tired, 'baga-swim')).toMatch(/needs ⚡12 energy \(including the midday heat\)/)
  })
})

describe('camera and photo memories', () => {
  const sunsetAtAnjuna = () => at('anjuna', 17 * 60 + 40)

  it('turns a special moment into a photo memory', () => {
    const state = doActivity(sunsetAtAnjuna(), 'anjuna-cliff-sunset')
    expect(state.player.memories).toEqual([
      expect.objectContaining({
        title: 'Sunset on the Anjuna cliffs',
        activityId: 'anjuna-cliff-sunset',
        locationId: 'anjuna',
        day: 1,
        minuteOfDay: 17 * 60 + 40, // when the moment started, not when it ended
      }),
    ])
    expect(state.notice).toMatch(/Photo memory saved/)
  })

  it('records no memory without a camera, and says so', () => {
    const state = doActivity(removeItem(sunsetAtAnjuna(), 'camera'), 'anjuna-cliff-sunset')
    expect(state.player.memories).toEqual([])
    expect(state.player.xp).toBe(20)
    expect(state.notice).toMatch(/No camera/)
  })

  it('does not duplicate the same photo on a later day', () => {
    const dayOne = doActivity(sunsetAtAnjuna(), 'anjuna-cliff-sunset')
    const dayTwo = doActivity(advanceTime(dayOne, 24 * 60 - 60), 'anjuna-cliff-sunset')
    expect(dayTwo.completedActivities).toHaveLength(2)
    expect(dayTwo.player.memories).toHaveLength(1)
  })

  it('is required for the Fontainhas photo walk', () => {
    expect(reason(removeItem(at('fontainhas', 10 * 60), 'camera'), 'fontainhas-photos')).toMatch(/need a camera/)
    const state = doActivity(at('fontainhas', 10 * 60), 'fontainhas-photos')
    expect(state.player.memories[0].title).toBe('Colours of Fontainhas')
  })

  it('gives ordinary activities no memory', () => {
    expect(doActivity(at('baga', 10 * 60), 'baga-swim').player.memories).toEqual([])
  })
})

describe('tourist map', () => {
  it('hints at the nearest unexplored place, without naming it', () => {
    const state = activateItem(at('baga', 10 * 60), 'tourist-map')
    expect(state.hintedLocationIds).toEqual(['anjuna'])
    expect(state.mapUsedOnDay).toBe(1)
    expect(state.clock.minuteOfDay).toBe(10 * 60 + 5)
    expect(state.notice).toMatch(/about 6 km north: A rocky stretch of coast/)
    expect(state.notice).not.toMatch(/Anjuna/)
  })

  it('works once per day', () => {
    const used = activateItem(at('baga', 10 * 60), 'tourist-map')
    const check = checkUseItem(used, 'tourist-map')
    expect(check.ok ? '' : check.reason).toMatch(/already studied the map today/)
    expect(activateItem(used, 'tourist-map').hintedLocationIds).toEqual(['anjuna'])
  })

  it('reveals the hidden beach from Day 2, before any other hint', () => {
    let state = activateItem(at('baga', 10 * 60), 'tourist-map')
    state = activateItem(advanceTime(state, 24 * 60), 'tourist-map')
    expect(state.foundClueIds).toEqual(['palolem-clue'])
    expect(state.hintedLocationIds).toEqual(['anjuna'])
    expect(state.notice).toMatch(/quiet bay far to the south/)
    // The day after, it goes back to hinting the next nearest place.
    state = activateItem(advanceTime(state, 24 * 60), 'tourist-map')
    expect(state.hintedLocationIds).toEqual(['anjuna', 'vagator'])
  })

  it('never hints at Palolem while it is hidden, but can once the clue is found', () => {
    const allNorth = {
      ...at('fontainhas', 10 * 60, 1),
      discoveredLocationIds: ['baga', 'anjuna', 'vagator', 'fontainhas'] as LocationId[],
    }
    const check = checkUseItem(allNorth, 'tourist-map')
    expect(check.ok ? '' : check.reason).toMatch(/nothing new/)
    expect(nextHintTarget(findClue(allNorth, 'palolem-clue'))).toBe('palolem')
  })

  it('describes directions on the map', () => {
    expect(directionWord('baga', 'vagator')).toBe('north')
    expect(directionWord('baga', 'palolem')).toBe('south-east')
    expect(directionWord('baga', 'fontainhas')).toBe('south-east')
    expect(directionWord('baga', 'anjuna')).toBe('north')
  })

  it('cannot "use" items that work passively', () => {
    const check = checkUseItem(createInitialState(), 'sunglasses')
    expect(check.ok ? '' : check.reason).toMatch(/works on its own/)
  })
})

describe('beach festival ticket', () => {
  it('can be bought at Anjuna, once', () => {
    const bought = doActivity(at('anjuna', 11 * 60), 'anjuna-festival-ticket')
    expect(bought.player.money).toBe(4400)
    expect(itemQuantity(bought, 'festival-ticket')).toBe(1)
    expect(reason(advanceTime(bought, 24 * 60), 'anjuna-festival-ticket')).toMatch(/already have a beach festival ticket/)
  })

  it('is needed for the Vagator festival, which says where to buy one', () => {
    expect(reason(at('vagator', 19 * 60), 'vagator-beach-festival')).toMatch(/need a beach festival ticket.*at Anjuna/)
  })

  it('only works in the evening at Vagator', () => {
    const withTicket = (minute: number) => ({
      ...at('vagator', minute),
      player: { ...at('vagator', minute).player, inventory: [{ itemId: 'festival-ticket', quantity: 1 }] },
    })
    expect(reason(withTicket(18 * 60), 'vagator-beach-festival')).toMatch(/starts from 7:00 PM/)

    const state = doActivity(withTicket(19 * 60), 'vagator-beach-festival')
    expect(hasItem(state, 'festival-ticket')).toBe(false)
    expect(state.player.xp).toBe(40)
    expect(state.clock.minuteOfDay).toBe(21 * 60)
    expect(state.notice).toMatch(/Beach festival ticket used/)
  })
})

describe('shells', () => {
  it('can be found on a beach, once a day per beach', () => {
    let state = doActivity(at('baga', 10 * 60), 'baga-beachcomb')
    expect(itemQuantity(state, 'shell')).toBe(1)
    expect(state.notice).toMatch(/You got: Shell/)
    state = doActivity(advanceTime(state, 24 * 60), 'baga-beachcomb')
    expect(itemQuantity(state, 'shell')).toBe(2)
  })
})

describe('activity costs', () => {
  it('charges for shopping at the flea market', () => {
    const state = doActivity(at('anjuna', 10 * 60), 'anjuna-flea-market')
    expect(state.player.money).toBe(4750)
    expect(state.player.stats.moneySpent).toBe(250)
  })

  it('refuses what you cannot afford, with a notification', () => {
    const broke = { ...at('baga', 10 * 60), player: { ...at('baga', 10 * 60).player, money: 100 } }
    const state = doActivity(broke, 'baga-shack-dinner')
    expect(state.player.money).toBe(100)
    expect(state.notice).toMatch(/Not enough money: this costs ₹600, you have ₹100/)
  })
})
