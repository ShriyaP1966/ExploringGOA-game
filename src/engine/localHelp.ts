import { LOCATIONS } from '../data/locations'
import type { GameState, LocalHelpOffer } from '../types'
import { advanceTime } from './clock'
import { DAY_END_MINUTE, LEVEL_PERKS, LOCAL_HELP, XP_REWARDS } from './config'
import { directionWord, nextHintTarget } from './items'
import { findClue, getRoute } from './locations'
import { addXp, changeEnergy } from './player'
import { nextRandom } from './random'

export type HelpCheck = { ok: true } | { ok: false; reason: string }

/** Chance that a local stops to help; much better for a Local Legend. */
export function localHelpChance(state: GameState): number {
  return state.player.level >= LEVEL_PERKS.betterHelpFromLevel ? LEVEL_PERKS.legendHelpChance : LOCAL_HELP.chance
}

export function checkAskLocal(state: GameState): HelpCheck {
  if (state.pendingHelp) return { ok: false, reason: 'A local is already waiting for your answer.' }
  if (state.localHelpAskedOnDay === state.clock.day) {
    return { ok: false, reason: "You've already asked around today. Try again tomorrow." }
  }
  if (state.clock.minuteOfDay + LOCAL_HELP.askMinutes > DAY_END_MINUTE) {
    return { ok: false, reason: 'Everyone has gone home for the night.' }
  }
  return { ok: true }
}

/** What the most useful help would be right now: the hidden beach first, then a hint, then a cup of chai. */
function bestOffer(state: GameState): LocalHelpOffer {
  if (!state.foundClueIds.includes('palolem-clue')) return { kind: 'palolem-clue' }
  const target = nextHintTarget(state)
  return target ? { kind: 'hint', locationId: target } : { kind: 'chai' }
}

export function offerText(state: GameState, offer: LocalHelpOffer): string {
  switch (offer.kind) {
    case 'palolem-clue':
      return '🙋 A fisherman leans in: “Tourists never find it. My cousin’s shack is on a quiet bay far down south. Want me to show you on your map?”'
    case 'hint':
      return `🙋 A shopkeeper smiles: “Have you been ${directionWord(state.currentLocationId, offer.locationId)} yet? I can tell you about a place.”`
    case 'chai':
      return '🙋 An auntie waves you over: “You look tired. Sit, have some chai.”'
  }
}

export function askLocal(state: GameState): GameState {
  const check = checkAskLocal(state)
  if (!check.ok) return { ...state, notice: check.reason }

  const [roll, rngSeed] = nextRandom(state.rngSeed)
  const asked = { ...advanceTime(state, LOCAL_HELP.askMinutes), rngSeed, localHelpAskedOnDay: state.clock.day }
  if (roll >= localHelpChance(state)) {
    return { ...asked, notice: '🤷 Everyone you ask is too busy to chat today. Try again tomorrow.' }
  }
  const offer = bestOffer(state)
  // The offer itself is shown with Accept / Decline; the notice just says someone stopped.
  return { ...asked, pendingHelp: offer, notice: '🙋 Someone stops to help you!' }
}

/** Accepting help is a good decision: it pays off and earns XP. */
export function acceptHelp(state: GameState): GameState {
  const offer = state.pendingHelp
  if (!offer) return state
  let next: GameState = { ...state, pendingHelp: null }
  let text: string

  switch (offer.kind) {
    case 'palolem-clue':
      next = findClue(next, 'palolem-clue')
      text = '🧭 They pencil a circle on a quiet bay far to the south. A new place appears on your map!'
      break
    case 'hint': {
      const route = getRoute(state.currentLocationId, offer.locationId)
      next = {
        ...next,
        hintedLocationIds: next.hintedLocationIds.includes(offer.locationId)
          ? next.hintedLocationIds
          : [...next.hintedLocationIds, offer.locationId],
      }
      text = `🧭 “About ${route?.distanceKm ?? '?'} km from here: ${LOCATIONS[offer.locationId].mapHint}”`
      break
    }
    case 'chai':
      next = changeEnergy(next, LOCAL_HELP.energyFromChai)
      text = `☕ Sweet, spiced and exactly what you needed. ⚡+${LOCAL_HELP.energyFromChai}`
      break
  }

  next = addXp(next, XP_REWARDS.acceptLocalHelp)
  return { ...next, notice: `${text} +${XP_REWARDS.acceptLocalHelp} XP for accepting local help.` }
}

export function declineHelp(state: GameState): GameState {
  if (!state.pendingHelp) return state
  return { ...state, pendingHelp: null, notice: 'You thank them politely and carry on.' }
}
