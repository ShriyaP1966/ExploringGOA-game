import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type { ActivityKind, Budget, Constraint, LocationId, Mood, PlaceType, TravelModeId } from '../types'
import {
  ACTIVITY_PHRASES,
  CHEAP_PHRASES,
  CLAUSE_BREAKS,
  CROWD_PHRASES,
  FREE_PHRASES,
  MOOD_PHRASES,
  NEARBY_PHRASES,
  NEGATION_REACH,
  NEGATORS,
  PLACE_TYPE_PHRASES,
  TIRED_PHRASES,
  TRAVEL_MODE_PHRASES,
} from './lexicon'

/** A phrase found in the token list: tokens [start, end). */
export interface Match {
  start: number
  end: number
  phrase: string
}

/** All whole-word occurrences of a phrase. */
export function findPhrase(tokens: string[], phrase: string): Match[] {
  const words = phrase.split(' ')
  const matches: Match[] = []
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((w, k) => tokens[i + k] === w)) matches.push({ start: i, end: i + words.length, phrase })
  }
  return matches
}

export function findAny(tokens: string[], phrases: string[]): Match[] {
  return phrases.flatMap((phrase) => findPhrase(tokens, phrase))
}

/** Is the word at `start` negated by "not", "no", "without"… within a few words before it? */
export function isNegated(tokens: string[], start: number): boolean {
  for (let j = start - 1; j >= Math.max(0, start - NEGATION_REACH); j--) {
    if (CLAUSE_BREAKS.has(tokens[j])) return false
    if (NEGATORS.has(tokens[j])) return true
  }
  return false
}

const overlaps = (m: Match, used: Match[]) => used.some((u) => m.start < u.end && u.start < m.end)

/** Small spelling slips from dictation: "palolum", "vagatore". */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

const ORIGIN_WORDS = new Set(['from', 'leaving', 'leave'])
const TARGET_WORDS = new Set(['to', 'towards', 'toward', 'into', 'visit', 'reach', 'at', 'in', 'see'])

export interface DestinationResult {
  destination: LocationId | null
  /** Words used for the place name, so they are not read again as a place type or activity. */
  used: Match[]
}

/**
 * Finds the place the player means, by name, nickname or a near-miss spelling. If several are
 * mentioned, prefers the one after "to"/"visit" and ignores the one after "from".
 */
export function extractDestination(tokens: string[]): DestinationResult {
  const found: { id: LocationId; match: Match }[] = []
  for (const id of LOCATION_IDS) {
    for (const alias of LOCATIONS[id].aliases) {
      for (const match of findPhrase(tokens, alias)) found.push({ id, match })
    }
  }
  // Near-miss spellings of single-word names (names of 6+ letters, so short everyday words never match).
  tokens.forEach((token, i) => {
    if (token.length < 5) return
    for (const id of LOCATION_IDS) {
      const close = LOCATIONS[id].aliases.some(
        (alias) => !alias.includes(' ') && alias.length >= 6 && editDistance(token, alias) <= (alias.length >= 8 ? 2 : 1),
      )
      if (close && !found.some((f) => f.match.start === i)) found.push({ id, match: { start: i, end: i + 1, phrase: token } })
    }
  })
  if (found.length === 0) return { destination: null, used: [] }

  // Longest phrase wins where matches overlap ("anjuna flea market" over "flea market").
  found.sort((a, b) => b.match.end - b.match.start - (a.match.end - a.match.start) || a.match.start - b.match.start)
  const kept: typeof found = []
  for (const f of found) if (!overlaps(f.match, kept.map((k) => k.match))) kept.push(f)

  const notOrigin = kept.filter((f) => !ORIGIN_WORDS.has(tokens[f.match.start - 1]))
  const targeted = notOrigin.filter((f) => TARGET_WORDS.has(tokens[f.match.start - 1]) || TARGET_WORDS.has(tokens[f.match.start - 2]))
  const pick = targeted[0] ?? notOrigin[notOrigin.length - 1] ?? null
  return { destination: pick?.id ?? null, used: kept.map((k) => k.match) }
}

export function extractTravelMode(tokens: string[]): TravelModeId | null {
  for (const [mode, phrases] of Object.entries(TRAVEL_MODE_PHRASES) as [TravelModeId, string[]][]) {
    const hit = findAny(tokens, phrases).find((m) => !isNegated(tokens, m.start))
    // "walking distance" is about nearness, not walking.
    if (hit && !(mode === 'walk' && tokens[hit.end] === 'distance')) return mode
  }
  return null
}

const number = (s: string) => Number(s)

/**
 * Money: a spending limit ("under 200", "less than 200", "around 500", "spend nothing") and money
 * left ("I have 800 rupees left"). Spoken numbers are already digits by now.
 */
export function extractBudget(text: string, tokens: string[]): Budget | null {
  const usedNumbers = new Set<number>()
  let moneyLeft: number | null = null
  let maxSpend: number | null = null
  let approximate = false

  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(text)
    if (!m) return null
    const at = m.index + m[0].lastIndexOf(m[1])
    if (usedNumbers.has(at)) return null
    usedNumbers.add(at)
    return m
  }

  // Money left: "i have 800 rupees left", "only 300 left", "i have 800 rupees".
  const left =
    take(/\b(?:i |)(?:only |just |still )?(?:have|got|have got)\s+(?:only |just |about |around |roughly )?(\d+)\s*(?:rupees\s*)?(?:left|remaining)\b/) ??
    take(/\b(\d+)\s*(?:rupees\s*)?(?:left|remaining)\b/) ??
    take(/\bi (?:only |just |still )?(?:have|got)\s+(?:only |just )?(\d+)\s*rupees\b/)
  if (left) moneyLeft = number(left[1])

  // A hard limit: "under 200", "less than 200", "200 max", "spend up to 300", "my budget is 500".
  const limit =
    take(
      /\b(?:under|below|less than|lesser than|no more than|not more than|at most|maximum of|max|up to|upto|within|cheaper than|budget of|budget is)\s+(?:rupees\s+)?(\d+)\b/,
    ) ??
    take(/\b(\d+)\s*(?:rupees\s*)?(?:or less|or under|or below|max|maximum|tops|at most)\b/) ??
    take(/\b(?:spend|spending|pay|paying)\s+(?:only |just |up to |at most |max )?(\d+)\b/)
  if (limit) {
    maxSpend = number(limit[1])
  } else {
    // A soft limit: "around 500", "about 300".
    const approx = take(/\b(?:around|about|roughly|approximately|approx|something like|close to)\s+(?:rupees\s+)?(\d+)\b/)
    if (approx) {
      maxSpend = number(approx[1])
      approximate = true
    }
  }

  // Spending nothing: "free", "I don't want to spend money".
  if (maxSpend === null && wantsFree(tokens)) maxSpend = 0

  if (moneyLeft === null && maxSpend === null) return null
  return { maxSpend, approximate, moneyLeft }
}

/** "free", "no money", or a negated "spend"/"pay": "i do not want to spend money". */
export function wantsFree(tokens: string[]): boolean {
  if (findAny(tokens, FREE_PHRASES).length > 0) return true
  return findAny(tokens, ['spend', 'spending', 'pay', 'paying']).some((m) => isNegated(tokens, m.start))
}

export interface MoodResult {
  moods: Mood[]
  avoided: Mood[]
  avoidCrowds: boolean
}

/** Moods, and negated moods ("not lively", "not too crowded", "not touristy"). */
export function extractMoods(tokens: string[], used: Match[]): MoodResult {
  const moods = new Set<Mood>()
  const avoided = new Set<Mood>()
  let avoidCrowds = false

  for (const [mood, phrases] of Object.entries(MOOD_PHRASES) as [Mood, string[]][]) {
    for (const m of findAny(tokens, phrases)) {
      if (overlaps(m, used)) continue
      if (isNegated(tokens, m.start)) avoided.add(mood)
      else moods.add(mood)
    }
  }
  for (const m of findAny(tokens, CROWD_PHRASES)) {
    if (isNegated(tokens, m.start)) {
      // "not touristy" means local and authentic; any negated crowd word means avoid crowds.
      if (m.phrase === 'touristy') moods.add('authentic')
      avoidCrowds = true
    } else {
      moods.add('lively')
    }
  }
  // "Not quiet" and "quiet" can't both stand: a negated mood wins.
  for (const mood of avoided) moods.delete(mood)
  return { moods: [...moods], avoided: [...avoided], avoidCrowds }
}

export interface ActivityResult {
  activities: ActivityKind[]
  avoided: ActivityKind[]
}

export function extractActivities(tokens: string[], used: Match[]): ActivityResult {
  const activities = new Set<ActivityKind>()
  const avoided = new Set<ActivityKind>()
  for (const [activity, phrases] of Object.entries(ACTIVITY_PHRASES) as [ActivityKind, string[]][]) {
    for (const m of findAny(tokens, phrases)) {
      if (overlaps(m, used)) continue
      if (isNegated(tokens, m.start)) avoided.add(activity)
      else activities.add(activity)
    }
  }
  for (const a of avoided) activities.delete(a)
  return { activities: [...activities], avoided: [...avoided] }
}

export function extractPlaceTypes(tokens: string[], used: Match[]): PlaceType[] {
  const types = new Set<PlaceType>()
  for (const [type, phrases] of Object.entries(PLACE_TYPE_PHRASES) as [PlaceType, string[]][]) {
    if (findAny(tokens, phrases).some((m) => !overlaps(m, used) && !isNegated(tokens, m.start))) types.add(type)
  }
  return [...types]
}

const SUNSET_MINUTE = 18 * 60 + 30

/** The words of a time limit like "before sunset", so "sunset" there isn't read as the sunset activity. */
export function timeLimitWords(tokens: string[]): Match[] {
  return ['before', 'by', 'for'].flatMap((word) =>
    findPhrase(tokens, `${word} sunset`).concat(findPhrase(tokens, `${word} the sunset`)),
  )
}

/** "before sunset", "by 6 pm", "before 5". */
export function extractTimeLimit(text: string): Constraint | null {
  if (/\b(?:before|by|for|in time for)\s+(?:the\s+)?sunset\b/.test(text)) {
    return { kind: 'before', minute: SUNSET_MINUTE, label: 'sunset' }
  }
  const m = /\b(?:before|by)\s+(\d{1,2})(?:\s*(am|pm))?\b/.exec(text)
  if (!m) return null
  const hour = Number(m[1])
  if (hour < 1 || hour > 12) return null
  // Without am/pm, assume the time a traveller would mean: 1–8 is afternoon/evening.
  const pm = m[2] ? m[2] === 'pm' : hour <= 8 || hour === 12
  const h24 = pm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour
  return { kind: 'before', minute: h24 * 60, label: `${hour} ${pm ? 'PM' : 'AM'}` }
}

/** Everything else the player insists on or wants to avoid. */
export function extractConstraints(
  text: string,
  tokens: string[],
  moods: MoodResult,
  activities: ActivityResult,
  placeTypes: PlaceType[],
): Constraint[] {
  const constraints: Constraint[] = []
  if (moods.avoidCrowds) constraints.push({ kind: 'avoid-crowds' })
  for (const mood of moods.avoided) constraints.push({ kind: 'avoid-mood', mood })
  for (const activity of activities.avoided) constraints.push({ kind: 'avoid-activity', activity })
  if (wantsFree(tokens)) constraints.push({ kind: 'free' })
  else if (
    findAny(tokens, CHEAP_PHRASES).some((m) => !isNegated(tokens, m.start)) ||
    findPhrase(tokens, 'expensive').some((m) => isNegated(tokens, m.start))
  ) {
    constraints.push({ kind: 'cheap' })
  }
  if (findAny(tokens, NEARBY_PHRASES).length > 0 || findPhrase(tokens, 'far').some((m) => isNegated(tokens, m.start))) {
    constraints.push({ kind: 'nearby' })
  }
  if (findAny(tokens, TIRED_PHRASES).length > 0) constraints.push({ kind: 'tired' })
  for (const placeType of placeTypes) constraints.push({ kind: 'place-type', placeType })
  const time = extractTimeLimit(text)
  if (time) constraints.push(time)
  return constraints
}
