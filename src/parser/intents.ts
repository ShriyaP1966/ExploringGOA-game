import { ITEMS } from '../data/items'
import { LOCATIONS } from '../data/locations'
import type { Activity, ActivityKind, CommandIntent, Constraint, IntentScore, LocationId, Mood, ParseContext } from '../types'
import { ACTIVITY_PHRASES, CHEAP_PHRASES } from './lexicon'
import { findAny, type Match } from './extract'

/** Below this, the parser says "unknown" rather than guess. */
export const MIN_CONFIDENCE = 0.45

/** What the extraction steps found, used as evidence for intents. */
export interface IntentFeatures {
  text: string
  tokens: string[]
  destination: LocationId | null
  hasTravelMode: boolean
  travelModeIsScooter: boolean
  hasBudget: boolean
  moods: Mood[]
  activities: ActivityKind[]
  constraints: Constraint[]
}

// --- Keywords (whole words/phrases after normalising) ---------------------------------------
const TRAVEL_VERBS = [
  'go', 'going', 'go to', 'head', 'heading', 'take me', 'bring me', 'get me to', 'drive', 'ride', 'travel',
  'walk to', 'move', 'let us go', 'visit', 'go back to', 'take a scooter', 'take a taxi', 'get a taxi', 'get a cab',
]
const SOMEWHERE = ['somewhere', 'some place', 'someplace', 'anywhere', 'a place', 'a spot', 'there']
const FIND_WORDS = [
  'find', 'recommend', 'suggest', 'where', 'looking for', 'look for', 'show me', 'any ideas', 'ideas', 'options',
  'what is good', 'best', 'i want a', 'i want an', 'i would like a', 'i need a', 'i am looking', 'is there',
]
const SOMETHING = ['something', 'somewhere', 'some place', 'a place', 'a spot', 'spot', 'spots', 'places']
const RENT_WORDS = ['rent', 'renting', 'hire', 'rental', 'book']
const SCOOTER_WORDS = ['scooter', 'scooty', 'bike', 'moped', 'activa']
/** Every item's name and nicknames, from the item data. */
const ITEM_WORDS = [...new Set(Object.values(ITEMS).flatMap((item) => [item.name.toLowerCase(), ...(item.aliases ?? [])]))]
const USE_VERBS = ['use', 'using', 'check', 'look at', 'read', 'open', 'consult', 'study', 'get out', 'take out']
/** Passing time on purpose: waiting for something later today. */
const WAIT_PHRASES = ['wait', 'wait here', 'wait a bit', 'wait for', 'wait until', 'hang around', 'hang out here', 'kill time', 'pass the time']
const REST_PHRASES = [
  'rest', 'take a rest', 'have a rest', 'nap', 'take a nap', 'sleep for a bit', 'lie down', 'sit down', 'take a break',
  'have a break', 'relax here', 'chill here', 'put my feet up', 'recharge', 'catch my breath',
]
const COST_PHRASES = [
  'how much', 'price', 'prices', 'fare', 'fares', 'cost of', 'what does it cost', 'what will it cost',
  'how expensive', 'is it expensive', 'cheapest way', 'cheapest route', 'cheapest option', 'cheaper way', 'cheapest',
  'is it free', 'can i afford', 'afford',
]
const ASK_LOCAL_PHRASES = [
  'ask a local', 'ask locals', 'ask the locals', 'ask someone', 'ask around', 'talk to a local', 'talk to locals',
  'talk to someone', 'speak to a local', 'chat with', 'ask for directions', 'local tips', 'any tips', 'ask people',
]
const INFO_WORDS = ['information', 'info', 'directions', 'tips', 'advice']
const STATUS_PHRASES = [
  'how much money', 'money do i have', 'money left', 'my money', 'how much energy', 'my energy', 'energy left',
  'how tired am i', 'what time', 'what day', 'where am i', 'my stats', 'status', 'how am i doing',
]
const QUEST_PHRASES = [
  'quest', 'quests', 'mission', 'missions', 'objective', 'objectives', 'what should i do', 'what do i do now',
  'what should i be doing', 'what am i supposed to do', 'what do i need to do', 'what is my goal',
  'what is next', 'what next', 'my tasks', 'tasks', 'goals', 'to do list', 'journal',
]
const INVENTORY_PHRASES = [
  'inventory', 'my bag', 'backpack', 'items', 'my items', 'my stuff', 'what do i have', 'what am i carrying',
  'what is in my bag', 'my things', 'belongings',
]
const END_DAY_PHRASES = [
  'end the day', 'end my day', 'end day', 'call it a day', 'call it a night', 'go to bed', 'go to sleep', 'time to sleep',
  'good night', 'done for today', 'done for the day', 'finish the day', 'finish for today', 'wrap up the day',
  'that is it for today', 'head back to the hotel', 'back to the hotel',
]
const CANCEL_PHRASES = ['cancel', 'never mind', 'nevermind', 'forget it', 'forget that', 'scratch that', 'stop', 'undo', 'ignore that']
const YES_PHRASES = [
  'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'alright', 'all right', 'of course', 'please do', 'sounds good',
  'let us do it', 'do it', 'accept', 'i accept', 'go ahead', 'why not',
]
const NO_PHRASES = ['no', 'nope', 'nah', 'no thanks', 'no thank you', 'decline', 'not now', 'i will pass', 'pass', 'skip it', 'not really']
const HELP_PHRASES = ['help me', 'i need help', 'how do i play', 'what can i say', 'what can i do', 'instructions', 'how does this work', 'commands']
/** Fillers that can surround a yes or no ("yeah sure let's do it", "nah I'm good"). */
const REPLY_FILLERS = [
  'let', 'us', 'it', 'do', 'that', 'then', 'please', 'thanks', 'thank', 'you', 'sounds', 'good', 'great', 'fine', 'cool',
  'perfect', 'i', 'am', 'go', 'for', 'ahead', 'lets', 'really', 'not', 'right', 'now', 'maybe', 'definitely', 'absolutely',
  'okay', 'ok', 'sure', 'yes', 'yeah', 'yep', 'yup', 'no', 'nope', 'nah', 'um', 'uh', 'hmm', 'well', 'actually', 'oh',
]
const ACTIVITY_VERBS = ['let us', 'go', 'take', 'do', 'try', 'watch', 'have', 'grab', 'can i', 'i want to', 'here']

/** Every activity's own words ("parasailing", "shells", "kayak"), from the location data. */
const ACTIVITY_KEYWORDS = [...new Set(Object.values(LOCATIONS).flatMap((l) => l.activities.flatMap((a) => a.keywords ?? [])))]

const has = (tokens: string[], phrases: string[]) => findAny(tokens, phrases).length > 0
const eatMatches = (tokens: string[]) => findAny(tokens, ACTIVITY_PHRASES.eat)

/** Is any match of `a` within `distance` words of any match of `b`? */
function near(a: Match[], b: Match[], distance: number): boolean {
  return a.some((x) => b.some((y) => Math.abs(x.start - y.start) <= distance))
}

/** Does the current place offer this kind of activity? (Context: "swim" fits better at a beach.) */
function offeredHere(kind: ActivityKind, here: LocationId | undefined): boolean {
  if (!here) return false
  const fits: Record<ActivityKind, (a: Activity) => boolean> = {
    eat: (a) => Boolean(a.meal),
    swim: (a) => a.id.includes('swim') || a.id.includes('kayak'),
    shop: (a) => a.id.includes('flea') || a.id.includes('ticket'),
    photo: (a) => Boolean(a.memory) || a.id.includes('photo'),
    sunset: (a) => Boolean(a.isSunset),
  }
  return LOCATIONS[here].activities.some(fits[kind])
}

/**
 * Scores every intent from keywords, extracted entities and game context. The same words can
 * count for different intents depending on what surrounds them.
 */
export function scoreIntents(f: IntentFeatures, context: ParseContext = {}): Record<CommandIntent, number> {
  const t = f.tokens
  const s: Record<CommandIntent, number> = {
    travel: 0, 'find-place': 0, 'find-food': 0, 'rent-scooter': 0, rest: 0, 'ask-cost': 0, activity: 0,
    'ask-local': 0, status: 0, 'show-quests': 0, 'show-inventory': 0, 'end-day': 0, cancel: 0, yes: 0, no: 0,
    help: 0, 'use-item': 0, unknown: 0,
  }
  // A reply: a few words, or only yes/no words and fillers ("yeah sure let's do it").
  const short = t.length <= 4 || (t.length <= 8 && t.every((w) => REPLY_FILLERS.includes(w)))
  const travelVerb = has(t, TRAVEL_VERBS)
  const somewhere = has(t, SOMEWHERE)
  const findWords = has(t, FIND_WORDS)
  const eat = eatMatches(t)
  const cheap = findAny(t, CHEAP_PHRASES)
  const travelContext = [...findAny(t, TRAVEL_VERBS), ...findAny(t, ['way', 'route', 'ride', 'trip', 'get to', 'taxi', 'cab', 'scooter'])]
  const rent = has(t, RENT_WORDS)
  const scooter = has(t, SCOOTER_WORDS) || f.travelModeIsScooter
  const named = findAny(t, ACTIVITY_KEYWORDS)
  // "what does parasailing cost": "cost" in a question (in a wish, "costs under 200" is a budget).
  const askedCost = /^(what|how|does|is|will)\b/.test(f.text) && has(t, ['cost', 'costs'])
  const costQuestion = has(t, COST_PHRASES) || askedCost || (has(t, ['expensive']) && has(t, ['is', 'how', 'too']))

  // Help and ending the day: clear phrases.
  if (/^help\b/.test(f.text) || has(t, HELP_PHRASES)) s.help += 6
  else if (has(t, ['help'])) s.help += 2
  if (has(t, END_DAY_PHRASES)) s['end-day'] += 7

  // Yes / no / cancel: short replies, much stronger when a question is waiting.
  if (short && has(t, YES_PHRASES)) s.yes += 4 + (context.pendingQuestion ? 2 : 0)
  if (short && has(t, NO_PHRASES)) s.no += 4 + (context.pendingQuestion ? 2 : 0)
  if (has(t, CANCEL_PHRASES)) s.cancel += 5
  if (has(t, ['go back']) && !f.destination) s.cancel += 3

  // Renting: "rent" with a scooter word.
  if (rent && scooter) s['rent-scooter'] += 7
  else if (rent) s['rent-scooter'] += 3
  // "get me a scooter": wanting one, with nowhere to go yet.
  else if (scooter && !f.destination && has(t, ['get me a', 'get a', 'i need a', 'i want a', 'grab a', 'borrow a', 'i would like a']))
    s['rent-scooter'] += 5

  // Travel: a travel verb counts fully only with somewhere to go.
  if (travelVerb) s.travel += f.destination || somewhere || f.hasTravelMode ? 3 : 1
  if (f.destination) s.travel += 2
  if (f.hasTravelMode && !rent) s.travel += 1
  if (travelVerb && somewhere) s.travel += 1
  if (rent) s.travel -= 2
  if (costQuestion) s.travel -= 2 // "how much is it to go to Anjuna" asks, it doesn't go

  // Finding a place: search words, wishes about the place.
  if (findWords) s['find-place'] += 3
  if (has(t, SOMETHING)) s['find-place'] += 1.5
  s['find-place'] += f.moods.length
  if (f.constraints.some((c) => c.kind === 'place-type')) s['find-place'] += 1.5
  if (f.constraints.some((c) => c.kind === 'avoid-crowds')) s['find-place'] += 1
  if (f.hasBudget) s['find-place'] += 0.5
  if (f.constraints.some((c) => c.kind === 'nearby')) s['find-place'] += 0.5

  // Food: eating words; "cheap" right next to food is about cheap food.
  if (eat.length > 0) {
    s['find-food'] += 3
    if (findWords) s['find-food'] += 1.5
    if (near(cheap, eat, 3)) s['find-food'] += 2
    if (has(t, ['hungry', 'starving'])) s['find-food'] += 1
    s['find-place'] -= 2 // the food is what they are after, not the place
  }

  // Cost: price questions; "cheap"/"cheapest" next to travel words is about the cheapest way.
  if (has(t, COST_PHRASES) || askedCost) s['ask-cost'] += 4
  // "is the parasailing expensive" is a price question on its own.
  if (has(t, ['expensive']) && has(t, ['is', 'how', 'too'])) s['ask-cost'] += has(t, COST_PHRASES) ? 2 : 4
  if (near(cheap, travelContext, 4) || (cheap.length > 0 && f.destination && eat.length === 0)) s['ask-cost'] += 2
  if (f.destination && has(t, COST_PHRASES)) s['ask-cost'] += 1
  if (eat.length > 0 && near(findAny(t, ['cheapest']), eat, 3)) s['ask-cost'] -= 2

  // Status: "how much money do I have" is a status question, not a price question.
  if (has(t, STATUS_PHRASES)) {
    s.status += 4
    s['find-place'] -= 2 // "where am I" is not a search
  }
  if (has(t, ['how much']) && has(t, ['do i have', 'i have', 'left', 'have i got'])) {
    s.status += 3
    s['ask-cost'] -= 3
  }

  if (has(t, QUEST_PHRASES)) s['show-quests'] += 5
  if (has(t, INVENTORY_PHRASES)) s['show-inventory'] += 5

  // Using an item: a use verb with something you carry ("use my tourist map", "check the map").
  if (has(t, ITEM_WORDS) && has(t, USE_VERBS)) {
    s['use-item'] += 6
    s['show-quests'] -= 2
    s['find-place'] -= 2
  }

  // Waiting: passing time on purpose counts as resting where you are.
  if (has(t, WAIT_PHRASES)) s.rest += 4

  // Asking a local: explicit phrases, or a local plus a request for information.
  if (has(t, ASK_LOCAL_PHRASES)) s['ask-local'] += 5
  if (has(t, ['local', 'locals']) && has(t, ['ask', 'talk', 'speak'])) s['ask-local'] += 2
  if (has(t, INFO_WORDS) && has(t, ['ask', 'get', 'need', 'any'])) s['ask-local'] += 1.5

  // Resting: rest phrases; feeling tired or wanting to relax here (not travelling somewhere).
  if (has(t, REST_PHRASES)) {
    s.rest += 4
    s['find-place'] -= 2 // "I need a rest" is not a search
  }
  if (!travelVerb && !findWords) {
    if (f.constraints.some((c) => c.kind === 'tired')) s.rest += 1.5
    if (f.moods.includes('relaxing')) s.rest += 1.5
  }

  // Activities (other than eating, which is usually "find food"); the shack owner chat is an activity.
  const doing = f.activities.filter((a) => a !== 'eat')
  if (doing.length > 0) s.activity += 3
  if (f.activities.includes('eat') && has(t, ['here', 'let us', 'have'])) {
    // "let's eat here": eating now, not looking for food.
    s.activity += 2.5
    s['find-food'] -= 1.5
  }
  // "shopping at the flea market": doing something at a named place, without a travel verb.
  if (f.activities.length > 0 && f.destination && !travelVerb) s.activity += 1
  if (f.activities.length > 0 && has(t, ACTIVITY_VERBS)) s.activity += 1
  if (f.activities.some((a) => offeredHere(a, context.currentLocationId))) s.activity += 1.5
  if (has(t, ['shack owner'])) s.activity += 4
  // A named activity ("parasailing", "look for shells") is doing that activity, unless it's a price question.
  if (named.length > 0) {
    s.activity += 4
    if (has(t, ACTIVITY_VERBS)) s.activity += 1
    const here = context.currentLocationId ? LOCATIONS[context.currentLocationId].activities : []
    if (named.some((m) => here.some((a) => a.keywords?.includes(m.phrase)))) s.activity += 1.5
    s['find-place'] -= 1.5
  }
  if (costQuestion) s.activity -= 3
  if (findWords) s.activity -= 1

  return s
}

/** Turns scores into a confidence: high when the winner is strong and clearly ahead of the runner-up. */
export function confidenceFrom(top: number, second: number): number {
  if (top <= 0) return 0
  const strength = top / (top + 1.5)
  const clearLead = 1 - 0.35 * Math.max(0, second) / top
  return Math.round(strength * clearLead * 100) / 100
}

export interface IntentResult {
  intent: CommandIntent
  confidence: number
  alternatives: IntentScore[]
}

export function classifyIntent(features: IntentFeatures, context: ParseContext = {}): IntentResult {
  const ranked = (Object.entries(scoreIntents(features, context)) as [CommandIntent, number][])
    .filter(([intent, score]) => intent !== 'unknown' && score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([intent, score]) => ({ intent, score: Math.round(score * 10) / 10 }))

  const [first, second] = ranked
  const confidence = first ? confidenceFrom(first.score, second?.score ?? 0) : 0
  return {
    intent: first && confidence >= MIN_CONFIDENCE ? first.intent : 'unknown',
    confidence,
    alternatives: ranked.slice(0, 3),
  }
}

