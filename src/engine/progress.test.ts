import { describe, expect, it } from 'vitest'
import type { GameAction, GameState } from '../types'
import { doActivity } from './activities'
import { advanceTime } from './clock'
import { createInitialState } from './initialState'
import { acceptHelp, askLocal, declineHelp, localHelpChance } from './localHelp'
import { discoverLocation, isLocationVisible, mapPinStatus } from './locations'
import { addXp, levelInfo, recordMemory } from './player'
import { nextRandom } from './random'
import { gameReducer } from './reducer'
import { rentScooter, scooterFee, travel } from './travel'

/** A seed whose first roll lands in [min, max). */
function seedRolling(min: number, max: number): number {
  for (let seed = 1; seed < 10_000; seed++) {
    const [value] = nextRandom(seed)
    if (value >= min && value < max) return seed
  }
  throw new Error('no seed found')
}

const LUCKY = seedRolling(0, 0.3) // helps at any level
const UNLUCKY = seedRolling(0.95, 1) // never helps
const LEGEND_ONLY = seedRolling(0.6, 0.8) // helps only a Local Legend

/** Level thresholds come from the level data, so these tests follow any rebalancing. */
const EXPLORER = levelInfo(2).minXp
const LEGEND = levelInfo(3).minXp

function withLevel(state: GameState, xp: number): GameState {
  return addXp(state, xp)
}

describe('levels', () => {
  it('names the three levels', () => {
    expect(levelInfo(1).title).toBe('Tourist')
    expect(levelInfo(2)).toMatchObject({ title: 'Explorer', minXp: 150 })
    expect(levelInfo(3)).toMatchObject({ title: 'Local Legend', minXp: 450 })
  })

  it('starts as a Tourist and levels up with a notice', () => {
    expect(createInitialState().player.level).toBe(1)
    const explorer = addXp(createInitialState(), EXPLORER)
    expect(explorer.levelUp).toMatchObject({ level: 2, title: 'Explorer' })
    // More XP within the same level raises no new level-up.
    expect(addXp(explorer, 10).levelUp).toEqual(explorer.levelUp)
    expect(addXp(createInitialState(), 10).levelUp).toBeNull()
  })

  it('clears the level-up notice on the next action', () => {
    let state = gameReducer(createInitialState(), { type: 'BEGIN_DAY' })
    state = gameReducer(state, { type: 'ADD_XP', amount: EXPLORER + 20 })
    expect(state.levelUp?.title).toBe('Explorer')
    state = gameReducer(state, { type: 'ADVANCE_TIME', minutes: 5 })
    expect(state.levelUp).toBeNull()
  })
})

describe('discovery XP', () => {
  it('rewards discovering a place by travelling there, once', () => {
    let state = travel(createInitialState(), 'anjuna', 'walk')
    expect(state.player.xp).toBe(25)
    expect(state.player.stats.placesDiscovered).toBe(2)
    expect(state.notice).toMatch(/New place discovered: Anjuna! \+25 XP/)

    state = travel(state, 'baga', 'walk')
    state = travel(state, 'anjuna', 'walk')
    expect(state.player.xp).toBe(25)
    expect(state.player.stats.placesDiscovered).toBe(2)
  })

  it('rewards the hidden gem more', () => {
    const state = discoverLocation(createInitialState(), 'palolem')
    expect(state.player.xp).toBe(50 + 30) // hidden gem + the Hidden Beach Discovery memory
    expect(state.notice).toMatch(/\+50 XP/)
  })

  it('keeps the discovered count in step with the discovered places', () => {
    let state = discoverLocation(createInitialState(), 'vagator')
    state = discoverLocation(state, 'fontainhas')
    expect(state.player.stats.placesDiscovered).toBe(state.discoveredLocationIds.length)
  })

  it('can level you up', () => {
    let state = addXp(createInitialState(), EXPLORER - 20) // the Anjuna discovery's 25 XP tips it over
    state = travel(state, 'anjuna', 'walk')
    expect(state.player.level).toBe(2)
    expect(state.levelUp?.title).toBe('Explorer')
  })
})

describe('memory XP', () => {
  it('rewards collecting a memory', () => {
    expect(recordMemory(createInitialState(), { title: 'Waves', description: '' }).player.xp).toBe(10)
  })
})

describe('staying under budget', () => {
  const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
  const playing = () => run(createInitialState(), { type: 'BEGIN_DAY' })

  it('gives a bonus for a day kept within budget', () => {
    const state = run(playing(), { type: 'DO_ACTIVITY', activityId: 'baga-swim' }, { type: 'END_DAY' })
    expect(state.daySummaries[0]).toMatchObject({ underBudget: true, xpEarned: 10 + 20 })
  })

  it('gives no bonus after overspending', () => {
    const state = run(
      playing(),
      { type: 'DO_ACTIVITY', activityId: 'baga-parasailing' },
      { type: 'DO_ACTIVITY', activityId: 'baga-shack-dinner' },
      { type: 'END_DAY' },
    )
    expect(state.daySummaries[0].underBudget).toBe(false)
  })

  it('gives no bonus for a day where you did nothing', () => {
    const state = run(playing(), { type: 'END_DAY' })
    expect(state.daySummaries[0]).toMatchObject({ underBudget: false, xpEarned: 0 })
  })
})

describe('Explorer perk: cheaper scooters', () => {
  const day2 = (xp: number) => withLevel(advanceTime(createInitialState(), 24 * 60), xp)

  it('charges a Tourist the full ₹400', () => {
    expect(scooterFee(day2(0))).toBe(400)
    expect(rentScooter(day2(0)).player.money).toBe(4600)
  })

  it('gives an Explorer 25% off', () => {
    const state = rentScooter(day2(EXPLORER))
    expect(scooterFee(day2(EXPLORER))).toBe(300)
    expect(state.player.money).toBe(4700)
    expect(state.notice).toMatch(/₹300, Explorer discount/)
  })
})

describe('local help', () => {
  const at = (seed: number) => ({ ...createInitialState(seed), currentLocationId: 'anjuna' as const })

  it('takes 15 minutes and can be asked once a day', () => {
    const asked = askLocal(at(UNLUCKY))
    expect(asked.clock.minuteOfDay).toBe(9 * 60 + 15)
    expect(asked.notice).toMatch(/too busy/)
    expect(askLocal(asked).notice).toMatch(/already asked around today/)
    expect(askLocal(advanceTime(asked, 24 * 60)).localHelpAskedOnDay).toBe(2)
  })

  it('first offers the way to the hidden beach, which reveals Palolem when accepted', () => {
    const offered = askLocal(at(LUCKY))
    expect(offered.pendingHelp).toEqual({ kind: 'palolem-clue' })
    expect(isLocationVisible(offered, 'palolem')).toBe(false)

    const accepted = acceptHelp(offered)
    expect(accepted.pendingHelp).toBeNull()
    expect(accepted.foundClueIds).toEqual(['palolem-clue'])
    expect(mapPinStatus(accepted, 'palolem')).toBe('fogged')
    expect(accepted.player.xp).toBe(15)
    expect(accepted.notice).toMatch(/\+15 XP for accepting local help/)
  })

  it('earns nothing if declined', () => {
    const declined = declineHelp(askLocal(at(LUCKY)))
    expect(declined.pendingHelp).toBeNull()
    expect(declined.foundClueIds).toEqual([])
    expect(declined.player.xp).toBe(0)
  })

  it('offers a hint once the hidden beach is known, then chai when nothing is left', () => {
    const known = { ...at(LUCKY), foundClueIds: ['palolem-clue' as const] }
    const hint = askLocal(known)
    expect(hint.pendingHelp).toEqual({ kind: 'hint', locationId: 'vagator' })
    expect(acceptHelp(hint).hintedLocationIds).toEqual(['vagator'])

    const everywhere = {
      ...known,
      player: { ...known.player, energy: 50 },
      discoveredLocationIds: ['baga', 'anjuna', 'vagator', 'fontainhas', 'palolem'] as GameState['discoveredLocationIds'],
    }
    const chai = acceptHelp(askLocal(everywhere))
    expect(chai.player.energy).toBe(65)
  })

  it('leaves the offer behind if you travel away', () => {
    const offered = askLocal(at(LUCKY))
    expect(travel(offered, 'baga', 'walk').pendingHelp).toBeNull()
  })

  it('makes help much more likely for a Local Legend', () => {
    expect(localHelpChance(createInitialState())).toBe(0.5)
    expect(localHelpChance(withLevel(createInitialState(), LEGEND))).toBe(0.85)

    expect(askLocal(at(LEGEND_ONLY)).pendingHelp).toBeNull()
    expect(askLocal(withLevel(at(LEGEND_ONLY), LEGEND)).pendingHelp).toEqual({ kind: 'palolem-clue' })
  })

  it('advances the random seed so the next roll is different', () => {
    const asked = askLocal(at(LUCKY))
    expect(asked.rngSeed).not.toBe(LUCKY)
  })
})

describe('XP from good decisions adds up', () => {
  it('rewards a sensible first morning', () => {
    let state = askLocal({ ...createInitialState(LUCKY) })
    state = acceptHelp(state) // +15
    state = doActivity(state, 'baga-beachcomb') // +5
    state = travel(state, 'anjuna', 'walk') // +25
    expect(state.player.xp).toBe(45)
  })
})
