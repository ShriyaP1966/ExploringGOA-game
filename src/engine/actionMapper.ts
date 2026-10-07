import { ITEMS } from '../data/items'
import { LOCATIONS } from '../data/locations'
import { TRAVEL_MODES } from '../data/travel'
import type { Activity, GameAction, GameState, LocationId, ParsedCommand, Suggestion, TravelModeId } from '../types'
import { formatClock, formatDuration } from './clock'
import { quoteActivity } from './activities'
import { DAY_END_MINUTE, FINALE_RULES, GAME_CONFIG } from './config'
import { dayRules } from './days'
import { availableChoicePhrases, didNotCatch, helpText, matchEventChoice } from './conversation'
import { eventById } from './events'
import { checkFinalSunset } from './finale'
import { getRoute } from './locations'
import { levelInfo } from './player'
import { currentStep, questById } from './quests'
import {
  activityFits,
  chooseTravelMode,
  namedActivities,
  nearestWith,
  pickActivityHere,
  recommend,
  spendingLimit,
  type Recommendation,
  type RecommendResult,
} from './recommend'
import { checkScooterRental, hasScooterToday, quoteTravel, scooterFee } from './travel'
import { rupees } from './utils'

/**
 * What a command becomes. The mapper reads the state but never changes it: actions still go
 * through the reducer, which checks every rule again.
 */
export type MappedCommand = (
  | { kind: 'actions'; actions: GameAction[]; note?: string; suggestion?: Suggestion }
  | { kind: 'answer'; text: string; suggestion?: Suggestion }
  | { kind: 'refuse'; reason: string }
  | { kind: 'not-understood'; reason: string }
) & {
  /** How the request was read, e.g. trusting the real money over what was said. */
  notes?: string[]
}

const act = (actions: GameAction[], extra: { note?: string; suggestion?: Suggestion } = {}): MappedCommand => ({
  kind: 'actions',
  actions,
  ...extra,
})
const answer = (text: string, suggestion?: Suggestion): MappedCommand => ({ kind: 'answer', text, suggestion })
const refuse = (reason: string): MappedCommand => ({ kind: 'refuse', reason })

const name = (id: LocationId) => LOCATIONS[id].name
const says = (p: ParsedCommand, ...phrases: string[]) =>
  phrases.some((phrase) => ` ${p.normalized} `.includes(` ${phrase} `))

/** The last thing the game suggested, so "yes" or "take me there" can follow up. */
export function lastSuggestion(state: GameState): Suggestion | null {
  return state.commandLog[state.commandLog.length - 1]?.suggestion ?? null
}

function travelLine(state: GameState, to: LocationId, mode: TravelModeId): string {
  const leg = getRoute(state.currentLocationId, to)?.modes[mode]
  if (!leg) return ''
  return `${TRAVEL_MODES[mode].emoji} ${TRAVEL_MODES[mode].label.toLowerCase()} ${formatDuration(leg.minutes)}, ${leg.cost === 0 ? 'free' : rupees(leg.cost)}`
}

// --- Screens between days -------------------------------------------------------------------

function mapPhase(state: GameState, p: ParsedCommand): MappedCommand | null {
  if (state.phase === 'playing') return null
  // Help and the unclear-command fallback work on every screen, with suggestions that fit it.
  if (p.intent === 'help') return answer(helpText(state))
  // Anything else these screens don't accept: unclear input gets suggestions, the rest a reminder.
  const otherwise = (reason: string): MappedCommand =>
    p.intent === 'unknown' ? { kind: 'not-understood', reason: didNotCatch(state) } : refuse(reason)
  if (state.phase === 'day-intro') {
    if (p.intent === 'yes' || says(p, 'start', 'begin', 'ready', 'let us go', 'start exploring', 'go')) return act([{ type: 'BEGIN_DAY' }])
    return otherwise(`Day ${state.clock.day} hasn't started yet: say "start" (or press the button) first.`)
  }
  if (state.phase === 'day-summary') {
    if (p.intent === 'yes' || p.intent === 'end-day' || says(p, 'continue', 'sleep', 'next', 'next day', 'ok', 'finish', 'carry on'))
      return act([{ type: 'CONTINUE_AFTER_SUMMARY' }])
    return otherwise(state.ending ? 'The day is over: say "continue" to finish the trip.' : 'The day is over: say "continue" to sleep.')
  }
  if (state.phase === 'ended') {
    if (says(p, 'play again', 'restart', 'new game', 'new trip', 'again')) return act([{ type: 'RESET_GAME' }])
    return otherwise('The trip is over. Say "play again" to start a new one.')
  }
  return null
}

// --- Waiting events and offers --------------------------------------------------------------

function mapPendingEvent(state: GameState, p: ParsedCommand): MappedCommand | null {
  if (!state.activeEvent) return null
  const event = eventById(state.activeEvent.eventId)
  // Spoken answers are matched to the closest choice, using money wishes and negation.
  const match = matchEventChoice(state, p)
  if (match.kind === 'match') return act([{ type: 'CHOOSE_EVENT_OPTION', choiceId: match.choice.id }])
  const phrases = availableChoicePhrases(state).map((c) => `"${c}"`)
  if (match.kind === 'ambiguous') {
    const [a, b] = match.options.map((c) => `"${c.label.replace(/\s*\(.*\)$/, '').toLowerCase()}"`)
    return refuse(`Sorry, did you mean ${a} or ${b}?`)
  }
  return refuse(
    `Sorry, I couldn't match that to what's happening (${event.emoji} ${event.title}). You can say ${phrases.join(', or ')}.`,
  )
}

// --- Answers (no state change) --------------------------------------------------------------

function statusAnswer(state: GameState): string {
  const level = levelInfo(state.player.level)
  return (
    `📍 ${name(state.currentLocationId)} · Day ${state.clock.day} of ${GAME_CONFIG.tripDays}, ${formatClock(state.clock.minuteOfDay)} · ` +
    `💰 ${rupees(state.player.money)} · ⚡ ${state.player.energy}/100 · ${level.emoji} ${level.title} (${state.player.xp} XP)`
  )
}

function questsAnswer(state: GameState): string {
  const lines = state.quests
    .filter((q) => q.status === 'active' || q.retryPending)
    .map((q) => {
      const quest = questById(q.questId)
      const step = currentStep(quest, q)
      return q.status === 'active'
        ? `${quest.emoji} ${quest.title}: next, ${step?.description.toLowerCase() ?? 'done'}`
        : `${quest.emoji} ${quest.title}: failed, a retry is coming`
    })
  const done = state.quests.filter((q) => q.status === 'completed').map((q) => questById(q.questId).title)
  if (lines.length === 0 && done.length === 0) return 'No quests yet. They start as each day begins.'
  return [...lines, ...(done.length ? [`✓ Completed: ${done.join(', ')}`] : [])].join(' · ')
}

function inventoryAnswer(state: GameState): string {
  if (state.player.inventory.length === 0) return 'Your bag is empty.'
  return `🎒 ${state.player.inventory
    .map((e) => `${ITEMS[e.itemId].emoji} ${ITEMS[e.itemId].name}${e.quantity > 1 ? ` ×${e.quantity}` : ''}`)
    .join(', ')}`
}

function costAnswer(state: GameState, p: ParsedCommand): MappedCommand {
  // "What's the cheapest way there?": a named place, or the place just suggested.
  const followUp = lastSuggestion(state)
  const to = p.destination ?? (says(p, 'there') && followUp?.kind === 'travel' ? followUp.locationId : null)
  if (to && to !== state.currentLocationId) return compareWays(state, to)
  if (to === state.currentLocationId) return answer(`You're already at ${name(to)}.`)

  // A named activity: its price here, or where it is and what it costs there.
  const named = namedActivities(state, p)
  if (named.here.length > 0 || named.elsewhere.length > 0) {
    const price = (a: { emoji: string; name: string; cost: number }) => `${a.emoji} ${a.name}: ${a.cost === 0 ? 'free' : rupees(a.cost)}`
    return answer(
      [...named.here.map(price), ...named.elsewhere.map((e) => `${price(e.activity)} (at ${name(e.locationId)})`)].join(' · '),
    )
  }
  const kinds = p.activities
  const here = LOCATIONS[state.currentLocationId].activities.filter((a) => kinds.length === 0 || kinds.some((k) => activityFits(a, k)))
  if (kinds.length > 0 && here.length > 0) {
    return answer(here.map((a) => `${a.emoji} ${a.name}: ${a.cost === 0 ? 'free' : rupees(a.cost)}`).join(' · '))
  }
  return answer(
    `A scooter costs ${rupees(scooterFee(state))} a day (rides are then free); walking is free for short hops; taxis are the priciest. ` +
      'Ask about a place, e.g. "how much is a taxi to Anjuna".',
  )
}

/** Compares walking, scooter and taxi to a place, without moving: time, money, energy, and whether it's allowed now. */
function compareWays(state: GameState, to: LocationId): MappedCommand {
  const route = getRoute(state.currentLocationId, to)
  if (!route) return refuse(`There is no way to get to ${name(to)} from here.`)
  const modes: TravelModeId[] = ['walk', 'scooter', 'taxi']
  const rentToday = !hasScooterToday(state) && checkScooterRental(state).ok
  const options = modes.map((mode) => {
    const leg = route.modes[mode]
    const check = quoteTravel(state, to, mode)
    // A scooter you still have to rent costs the day fee (the ride itself is free).
    const extra = mode === 'scooter' && rentToday ? scooterFee(state) : 0
    return { mode, leg, check, total: leg.cost + extra }
  })
  const lines = options.map(({ mode, leg, check, total }) => {
    const cost =
      mode === 'scooter' && total > leg.cost ? `${rupees(total)} rental (ride free)` : total === 0 ? 'free' : rupees(total)
    const energy = check.ok ? ` · ⚡${check.quote.energy}` : ''
    const status = check.ok ? '' : mode === 'scooter' && /Rent a scooter first/.test(check.reason) ? ' (rent one first)' : ' (not possible now)'
    return `${TRAVEL_MODES[mode].emoji} ${TRAVEL_MODES[mode].label}: ${formatDuration(leg.minutes)} · ${cost}${energy}${status}`
  })
  const possible = options.filter((o) => o.check.ok).sort((a, b) => a.total - b.total || a.leg.minutes - b.leg.minutes)
  const cheapest = possible[0]
  const taxi = options[options.length - 1].check
  const verdict = cheapest
    ? `Cheapest you can do now: ${TRAVEL_MODES[cheapest.mode].label.toLowerCase()} (${cheapest.total === 0 ? 'free' : rupees(cheapest.total)}). Say "yes" to go that way.`
    : rentToday
      ? `Rent a scooter first (${rupees(scooterFee(state))}), then the ride is free.`
      : `You can't get there right now: ${taxi.ok ? '' : taxi.reason}`
  return answer(
    `To ${name(to)} (${route.distanceKm} km): ${lines.join(' · ')}. ${verdict}`,
    cheapest ? { kind: 'travel', locationId: to, mode: cheapest.mode } : undefined,
  )
}

// --- Recommendations ---------------------------------------------------------------------------

function howToGet(state: GameState, rec: Recommendation): string {
  if (!rec.travel || !rec.travel.check.ok) return ''
  return travelLine(state, rec.locationId, rec.travel.mode)
}

/** Explains why nothing fits, from the best of the ruled-out places. */
function nothingFits(result: RecommendResult): string {
  const reasons = result.ruledOut.slice(0, 2).map((r) => `${name(r.locationId)}: ${r.reason}`)
  return `Nothing you can reach fits that right now${reasons.length ? ` (${reasons.join('; ')})` : ''}.`
}

function suggestionFor(rec: Recommendation, eat: boolean): Suggestion {
  if (!rec.travel) return { kind: 'activity', activityId: rec.activity!.id }
  return {
    kind: 'travel',
    locationId: rec.locationId,
    mode: rec.travel.mode,
    ...(eat && rec.activity ? { thenActivityId: rec.activity.id } : {}),
  }
}

/** A place recommendation: the best match, why, how to get there, and a "say yes" prompt. */
function recommendAnswer(state: GameState, p: ParsedCommand): MappedCommand {
  const result = recommend(state, p, 'place')
  const rec = result.best
  if (!rec) return answer(nothingFits(result))
  const place = LOCATIONS[rec.locationId]
  const then = rec.activity ? `, then ${rec.activity.emoji} ${rec.activity.name.toLowerCase()}` : ''
  const also = result.alternatives[0] ? ` (Also good: ${name(result.alternatives[0].locationId)}.)` : ''
  return answer(
    `I'd go to ${place.emoji} ${place.name}: ${rec.why.join(', ')}. Getting there: ${howToGet(state, rec)}${then}.${also} Say "yes" to go.`,
    suggestionFor(rec, false),
  )
}

function mapTravel(state: GameState, p: ParsedCommand): MappedCommand {
  let to = p.destination
  const followUp = lastSuggestion(state)
  if (!to && says(p, 'there') && followUp?.kind === 'travel') return followUpSuggestion(state, followUp)
  // "Take me somewhere relaxing": recommend first, and go when the player says yes.
  if (!to && wantsSomewhere(p)) return recommendAnswer(state, p)
  if (!to) return refuse('Where to? Name a place, e.g. "take me to Anjuna", or say what you feel like, e.g. "somewhere quiet".')
  if (to === state.currentLocationId) return refuse(`You're already at ${name(to)}.`)

  const choice = chooseTravelMode(state, to, p)
  const limit = spendingLimit(p)
  if (choice.overBudget && choice.check.ok && limit !== null) {
    return refuse(
      `Every way you can go to ${name(to)} right now costs more than your ${limit === 0 ? 'free' : rupees(limit)} limit ` +
        `(${TRAVEL_MODES[choice.mode].label.toLowerCase()}: ${rupees(choice.check.quote.cost)}).`,
    )
  }
  to = to as LocationId
  return act([{ type: 'TRAVEL', to, mode: choice.mode }])
}

function mapFindPlace(state: GameState, p: ParsedCommand): MappedCommand {
  return recommendAnswer(state, p)
}

/** Nearest affordable food (cheap first when asked): here if possible, otherwise where to go. */
function mapFindFood(state: GameState, p: ParsedCommand): MappedCommand {
  const result = recommend(state, p, 'food')
  const rec = result.best
  if (!rec || !rec.activity) return answer(`No food you can get right now fits. ${nothingFits(result)}`)
  const meal = rec.activity
  if (!rec.travel) {
    return answer(
      `Right here at ${name(rec.locationId)}: ${meal.emoji} ${meal.name}, ${rupees(meal.cost)}, ⚡+${meal.energy}. Say "yes" to eat.`,
      suggestionFor(rec, true),
    )
  }
  const cheapNote = p.constraints.some((c) => c.kind === 'cheap') ? 'Cheapest good food nearby' : 'Good food nearby'
  return answer(
    `${cheapNote}: ${meal.emoji} ${meal.name} at ${name(rec.locationId)}, ${rupees(meal.cost)}, ⚡+${meal.energy}. ` +
      `Getting there: ${howToGet(state, rec)} (${rec.totalCost === 0 ? 'free' : rupees(rec.totalCost)} in all). Say "yes" to go and eat.`,
    suggestionFor(rec, true),
  )
}

// --- Intents that act ------------------------------------------------------------------------

function wantsSomewhere(p: ParsedCommand): boolean {
  return p.moods.length > 0 || p.constraints.length > 0 || p.activities.length > 0 || says(p, 'somewhere', 'anywhere', 'some place')
}

function mapActivity(state: GameState, p: ParsedCommand): MappedCommand {
  // On the last day, a sunset anywhere you've discovered is the final sunset. A sunset activity here
  // is used when it can happen (now, or after waiting for it); otherwise (none here, or one you
  // can't afford) the free final sunset, which waits for the evening by itself. The trip can always end.
  if ((p.activities.includes('sunset') || says(p, 'final sunset', 'last sunset')) && dayRules(state).finaleSunset && checkFinalSunset(state).ok) {
    const sunsetHere = pickActivityHere(state, p, ['sunset'])
    const usable = sunsetHere && (quoteActivity(state, sunsetHere.id).ok || waitThenDo(state, sunsetHere)?.kind === 'actions')
    if (!usable || says(p, 'final sunset', 'last sunset')) return act([{ type: 'WATCH_FINAL_SUNSET' }])
  }
  if (p.destination && p.destination !== state.currentLocationId) {
    return refuse(`You're at ${name(state.currentLocationId)}, not ${name(p.destination)}. Say "take me to ${name(p.destination)}" first.`)
  }
  if (says(p, 'shack owner')) {
    return LOCATIONS[state.currentLocationId].activities.some((a) => a.id === 'baga-ask-shack-owner')
      ? act([{ type: 'DO_ACTIVITY', activityId: 'baga-ask-shack-owner' }])
      : refuse('The shack owner is at Baga Beach.')
  }
  // An activity named by its own words ("parasailing", "look for shells"): that one, here or where it is.
  const named = namedActivities(state, p)
  if (named.here.length > 0) return waitThenDo(state, named.here[0]) ?? act([{ type: 'DO_ACTIVITY', activityId: named.here[0].id }])
  if (named.elsewhere.length > 0 && !p.activities.some((k) => pickActivityHere(state, p, [k]))) {
    const { activity, locationId } = named.elsewhere[0]
    return refuse(`${activity.emoji} ${activity.name} is at ${name(locationId)}. Say "take me to ${name(locationId)}" first.`)
  }
  const kinds = p.activities.length > 0 ? p.activities : []
  const activity = pickActivityHere(state, p, kinds)
  if (!activity) {
    const elsewhere = nearestWith(state, kinds)
    return refuse(
      `There's nothing like that at ${name(state.currentLocationId)}.${elsewhere ? ` Try ${name(elsewhere)}.` : ''}`,
    )
  }
  return waitThenDo(state, activity) ?? act([{ type: 'DO_ACTIVITY', activityId: activity.id }])
}

/**
 * An activity that opens later today (a sunset, the evening festival): wait until it opens, then
 * do it. If something else would still stop it then (money, an item), refuse with that reason.
 */
function waitThenDo(state: GameState, activity: Activity): MappedCommand | null {
  const now = state.clock.minuteOfDay
  const opens = activity.availableFrom
  if (opens === undefined || now >= opens || opens >= DAY_END_MINUTE) return null
  const atOpening: GameState = { ...state, clock: { ...state.clock, minuteOfDay: opens } }
  const later = quoteActivity(atOpening, activity.id)
  // Waiting wouldn't help (e.g. not enough money): say the real reason, not just "not yet".
  if (!later.ok) return refuse(later.reason)
  return {
    kind: 'actions',
    actions: [
      { type: 'ADVANCE_TIME', minutes: opens - now },
      { type: 'DO_ACTIVITY', activityId: activity.id },
    ],
    note: `You wait until ${formatClock(opens)}.`,
  }
}

const WAIT_WORDS = ['wait', 'hang around', 'hang out', 'kill time', 'pass the time']

/** "wait for the sunset", "wait an hour": let time pass where you are (no energy needed, none gained). */
function mapWait(state: GameState, p: ParsedCommand): MappedCommand {
  const now = state.clock.minuteOfDay
  const evening = says(p, 'sunset', 'sundown', 'evening', 'dusk', 'golden hour')
  const target = evening ? FINALE_RULES.waitUntil : Math.min(now + 60, DAY_END_MINUTE - 1)
  if (target <= now) return answer(evening ? 'The evening is already here.' : 'It is too late in the day to wait any longer: say "end the day".')
  return {
    kind: 'actions',
    actions: [{ type: 'ADVANCE_TIME', minutes: target - now }],
    note: `You wait until ${formatClock(target)}.`,
  }
}

/** "use my tourist map", "use the camera": the item you name, if you carry it; the engine decides if it can be used now. */
function mapUseItem(state: GameState, p: ParsedCommand): MappedCommand {
  const owned = state.player.inventory.map((entry) => ITEMS[entry.itemId])
  const named = Object.values(ITEMS).find((item) => says(p, item.name.toLowerCase(), ...(item.aliases ?? [])))
  if (!named) {
    const usable = owned.filter((item) => item.usable)
    return answer(
      usable.length > 0
        ? `Which item? You could say ${usable.map((item) => `"use my ${item.name.toLowerCase()}"`).join(' or ')}.`
        : 'You have nothing you can use right now.',
    )
  }
  if (!owned.some((item) => item.id === named.id)) return refuse(`You don't have a ${named.name.toLowerCase()}.`)
  if (!named.usable) return answer(`${named.emoji} ${named.name}: ${named.effect} It works by itself, so there is nothing to use.`)
  return act([{ type: 'USE_ITEM', itemId: named.id }])
}

function followUpSuggestion(state: GameState, s: Suggestion): MappedCommand {
  if (s.kind === 'activity') return act([{ type: 'DO_ACTIVITY', activityId: s.activityId }])
  if (s.locationId === state.currentLocationId) {
    return s.thenActivityId
      ? act([{ type: 'DO_ACTIVITY', activityId: s.thenActivityId }])
      : refuse(`You're already at ${name(s.locationId)}.`)
  }
  const mode = s.mode ?? chooseTravelMode(state, s.locationId, emptyRequest).mode
  const go: GameAction = { type: 'TRAVEL', to: s.locationId, mode }
  return act(s.thenActivityId ? [go, { type: 'DO_ACTIVITY', activityId: s.thenActivityId }] : [go])
}

const emptyRequest: ParsedCommand = {
  raw: '',
  normalized: '',
  intent: 'travel',
  alternatives: [],
  destination: null,
  travelMode: null,
  budget: null,
  moods: [],
  activities: [],
  constraints: [],
  confidence: 1,
  parser: 'follow-up',
}

/**
 * Turns a parsed command into game actions (or an answer, or a clear refusal). Reads the state to
 * choose sensibly; never changes it. The engine re-checks every action when it runs.
 */
/** Notes on how the request was read. The game always trusts the real money over what was said. */
export function understandingNotes(state: GameState, p: ParsedCommand): string[] {
  const said = p.budget?.moneyLeft
  const real = state.player.money
  if (said === null || said === undefined || said === real) return []
  return [`You said you have ${rupees(said)} left, but you really have ${rupees(real)}: I'm going by your real money.`]
}

export function mapCommand(state: GameState, p: ParsedCommand): MappedCommand {
  const notes = understandingNotes(state, p)
  let mapped = mapRequest(state, p)

  // A local's offer is a proposal too: doing something else instead politely lets it lapse.
  if (state.pendingHelp && mapped.kind === 'actions') {
    const answersOffer = mapped.actions.some((a) => a.type === 'ACCEPT_HELP' || a.type === 'DECLINE_HELP')
    if (!answersOffer) {
      mapped = {
        ...mapped,
        actions: [{ type: 'DECLINE_HELP' }, ...mapped.actions],
        note: [mapped.note, "(You leave the local's offer.)"].filter(Boolean).join(' '),
      }
    }
  }
  return notes.length > 0 ? { ...mapped, notes } : mapped
}

function mapRequest(state: GameState, p: ParsedCommand): MappedCommand {
  const phase = mapPhase(state, p)
  if (phase) return phase
  const pending = mapPendingEvent(state, p)
  if (pending) return pending

  if (state.pendingHelp) {
    if (p.intent === 'yes') return act([{ type: 'ACCEPT_HELP' }])
    if (p.intent === 'no' || p.intent === 'cancel') return act([{ type: 'DECLINE_HELP' }])
  }

  switch (p.intent) {
    case 'travel':
      return mapTravel(state, p)
    case 'find-place':
      return mapFindPlace(state, p)
    case 'find-food':
      return mapFindFood(state, p)
    case 'rent-scooter':
      return act([{ type: 'RENT_SCOOTER' }])
    case 'rest':
      return says(p, ...WAIT_WORDS) ? mapWait(state, p) : act([{ type: 'REST' }])
    case 'use-item':
      return mapUseItem(state, p)
    case 'ask-cost':
      return costAnswer(state, p)
    case 'activity':
      return mapActivity(state, p)
    case 'ask-local':
      return act([{ type: 'ASK_LOCAL' }])
    case 'status':
      return answer(statusAnswer(state))
    case 'show-quests':
      return answer(questsAnswer(state))
    case 'show-inventory':
      return answer(inventoryAnswer(state))
    case 'end-day':
      return act([{ type: 'END_DAY' }])
    // A proposal waits for an answer: yes confirms it, no or cancel drops it, anything else replaces it.
    case 'yes': {
      const s = lastSuggestion(state)
      return s ? followUpSuggestion(state, s) : answer('There is nothing waiting for a yes right now.')
    }
    case 'no':
    case 'cancel': {
      const s = lastSuggestion(state)
      if (s) return answer(`OK, dropped: I won't ${s.kind === 'travel' ? `take you to ${name(s.locationId)}` : 'do that'}.`)
      return answer(p.intent === 'cancel' ? 'There is nothing to cancel right now.' : 'OK.')
    }
    case 'help':
      return answer(helpText(state, lastSuggestion(state)))
    case 'unknown':
      return { kind: 'not-understood', reason: didNotCatch(state, lastSuggestion(state)) }
  }
}
