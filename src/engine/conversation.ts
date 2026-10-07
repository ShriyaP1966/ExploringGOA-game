import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type { EventChoice, GameState, ParsedCommand, Suggestion } from '../types'
import { DAY_END_MINUTE } from './config'
import { dayRules } from './days'
import { checkChoice, eventById } from './events'
import { checkFinalSunset } from './finale'
import { getRoute, isLocationDiscovered, isLocationVisible } from './locations'
import { currentStep, questById } from './quests'
import { checkScooterRental, hasScooterToday } from './travel'

/**
 * The conversation layer: matching natural answers to event choices, suggesting what the player
 * could say, and help. Read-only: it never changes state.
 */

// --- Matching spoken answers to event choices -------------------------------------------------

const NEGATORS = new Set(['not', 'no', 'never', 'without', 'avoid', 'nothing'])
const CLAUSE_BREAKS = new Set(['but', 'and', 'or', 'so', 'then', 'instead'])
const LABEL_STOP_WORDS = new Set(['with', 'your', 'from', 'into', 'that', 'this', 'them', 'have', 'some', 'just'])

/** Where a phrase occurs in the words, and whether each occurrence is negated ("I don't want to pay"). */
function mentions(tokens: string[], phrase: string): { negated: boolean }[] {
  const words = phrase.split(' ')
  const found: { negated: boolean }[] = []
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (!words.every((w, k) => tokens[i + k] === w)) continue
    let negated = false
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (CLAUSE_BREAKS.has(tokens[j])) break
      if (NEGATORS.has(tokens[j])) {
        negated = true
        break
      }
    }
    found.push({ negated })
  }
  return found
}

/** +1 if mentioned positively, -1 if only negated, 0 if not mentioned. */
function stance(tokens: string[], phrase: string): number {
  const hits = mentions(tokens, phrase)
  if (hits.some((h) => !h.negated)) return 1
  return hits.length > 0 ? -1 : 0
}

export interface ChoiceScore {
  choice: EventChoice
  score: number
}

/**
 * Scores each choice of the waiting event against what was said: its keywords and label words
 * (a negated mention counts against it) and the player's money wishes ("don't want to spend money"
 * rules out paid choices; "pay" favours them; a limit rules out dearer ones).
 */
export function scoreEventChoices(state: GameState, p: ParsedCommand): ChoiceScore[] {
  if (!state.activeEvent) return []
  const tokens = p.normalized.split(' ').filter(Boolean)
  const free = p.constraints.some((c) => c.kind === 'free') || p.budget?.maxSpend === 0
  const limit = p.budget?.maxSpend ?? null
  const wantsToPay = !free && ['pay', 'paying', 'money', 'spend'].some((w) => stance(tokens, w) > 0)

  return eventById(state.activeEvent.eventId).choices.map((choice) => {
    let score = 0
    for (const keyword of choice.keywords) {
      const s = stance(tokens, keyword)
      score += s > 0 ? 2 : s < 0 ? -3 : 0
    }
    const labelWords = choice.label
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !LABEL_STOP_WORDS.has(w) && !choice.keywords.includes(w))
    for (const w of new Set(labelWords)) if (stance(tokens, w) > 0) score += 1

    const cost = choice.outcome.cost ?? 0
    if (free) score += cost > 0 ? -6 : 1.5
    if (limit !== null && limit > 0 && cost > limit) score -= 6
    if (wantsToPay && cost > 0) score += 1.5
    return { choice, score }
  })
}

export type ChoiceMatch =
  | { kind: 'match'; choice: EventChoice }
  | { kind: 'ambiguous'; options: EventChoice[] }
  | { kind: 'none' }

/** The closest choice, if it is clear enough; otherwise which ones were close, or none. */
export function matchEventChoice(state: GameState, p: ParsedCommand): ChoiceMatch {
  if (!state.activeEvent) return { kind: 'none' }
  const event = eventById(state.activeEvent.eventId)
  if (p.intent === 'no' || p.intent === 'cancel') {
    const decline = event.choices.find((c) => c.id === 'decline')
    if (decline) return { kind: 'match', choice: decline }
  }
  const ranked = scoreEventChoices(state, p).sort((a, b) => b.score - a.score)
  const [first, second] = ranked
  if (!first || first.score < 2) return { kind: 'none' }
  if (second && first.score - second.score < 1) return { kind: 'ambiguous', options: [first.choice, second.choice] }
  return { kind: 'match', choice: first.choice }
}

/** The waiting event's choices you could pick right now, as phrases to say. */
export function availableChoicePhrases(state: GameState): string[] {
  if (!state.activeEvent) return []
  return eventById(state.activeEvent.eventId)
    .choices.filter((c) => checkChoice(state, c).ok)
    .map((c) => c.label.replace(/\s*\(.*\)$/, '').toLowerCase())
}

// --- What could the player say right now? -----------------------------------------------------

const quote = (phrases: string[]) =>
  phrases.length <= 1 ? `"${phrases[0] ?? 'help'}"` : `${phrases.slice(0, -1).map((s) => `"${s}"`).join(', ')} or "${phrases[phrases.length - 1]}"`

function describe(s: Suggestion): string {
  if (s.kind === 'activity') return 'do that'
  return `go to ${LOCATIONS[s.locationId].name}`
}

/** Two or three things that make sense to say in the current situation. */
export function situationalSuggestions(state: GameState, pending: Suggestion | null = null): string[] {
  if (state.phase === 'day-intro') return ['start the day', 'help']
  if (state.phase === 'day-summary') return ['continue', 'help']
  if (state.phase === 'ended') return ['play again']
  if (state.activeEvent) return availableChoicePhrases(state).slice(0, 3)
  if (state.pendingHelp) return ['yes please', 'no thanks']

  const ideas: string[] = []
  if (pending) ideas.push('yes', `no, don't ${describe(pending)}`)

  // The day's own goals first.
  if (dayRules(state).finaleSunset && checkFinalSunset(state).ok && state.clock.minuteOfDay < 18 * 60 + 45) {
    ideas.push('watch my final sunset here')
  }
  for (const progress of state.quests.filter((q) => q.status === 'active')) {
    const step = currentStep(questById(progress.questId), progress)
    if (step?.id === 'ask-shack-owner') ideas.push(state.currentLocationId === 'baga' ? 'ask the shack owner about sunsets' : 'take me to Baga')
    if (step?.id === 'reach-vagator' && state.currentLocationId !== 'vagator') ideas.push('take me to Vagator')
    if (step?.id === 'rent-scooter') ideas.push('rent a scooter')
  }

  // Then the player's needs and options.
  if (state.player.energy < 35) ideas.push('I need a rest', 'find me cheap food')
  if (!hasScooterToday(state) && checkScooterRental(state).ok) ideas.push('rent a scooter')
  const nearestKnown = LOCATION_IDS.filter(
    (id) => id !== state.currentLocationId && isLocationVisible(state, id) && isLocationDiscovered(state, id),
  ).sort((a, b) => (getRoute(state.currentLocationId, a)?.distanceKm ?? 99) - (getRoute(state.currentLocationId, b)?.distanceKm ?? 99))[0]
  if (nearestKnown) ideas.push(`take me to ${LOCATIONS[nearestKnown].name.split(/[,&]/)[0].trim()}`)
  if (state.clock.minuteOfDay < DAY_END_MINUTE - 60) ideas.push('find somewhere beautiful')
  ideas.push('find me cheap food', 'how much money do I have')

  return [...new Set(ideas)].slice(0, 3)
}

/** The unclear-command fallback. */
export function didNotCatch(state: GameState, pending: Suggestion | null = null): string {
  return `I didn't quite catch that. You could say ${quote(situationalSuggestions(state, pending))}.`
}

/** The help command: example phrases by purpose, and what fits right now. */
export function helpText(state: GameState, pending: Suggestion | null = null): string {
  return [
    '🗺️ Getting around: "take me to Anjuna", "rent a scooter", "what\'s the cheapest way to Panjim".',
    '🔎 Finding things: "find a quiet beach", "find me cheap food nearby", "somewhere relaxing under 200 rupees".',
    '🎟️ Doing things: "go swimming", "take photos", "I need a rest", "wait for the sunset", "ask a local", "use my tourist map".',
    '📋 Checking: "how much money do I have", "show my quests", "what\'s in my bag".',
    '💬 Answering: "yes", "no", "cancel", "end the day".',
    `👉 Right now you could say ${quote(situationalSuggestions(state, pending))}.`,
  ].join(' ')
}
