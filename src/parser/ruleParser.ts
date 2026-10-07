import type { ParseContext, ParsedCommand } from '../types'
import {
  extractActivities,
  extractBudget,
  extractConstraints,
  extractDestination,
  extractMoods,
  extractPlaceTypes,
  extractTravelMode,
  timeLimitWords,
} from './extract'
import { classifyIntent } from './intents'
import { normalize } from './normalize'

export const PARSER_NAME = 'rule-based'

/**
 * The rule-based natural language parser: no AI, no network. It turns a sentence into a structured
 * request (intent, destination, budget, moods, activities, constraints). It never changes game state.
 */
export function ruleParse(raw: string, context: ParseContext = {}): ParsedCommand {
  const normalized = normalize(raw)
  const tokens = normalized ? normalized.split(' ') : []

  const { destination, used: placeWords } = extractDestination(tokens)
  // Words already read as a place or a time limit ("before sunset") are not read again as an activity.
  const used = [...placeWords, ...timeLimitWords(tokens)]
  const travelMode = extractTravelMode(tokens)
  const budget = extractBudget(normalized, tokens)
  const moods = extractMoods(tokens, used)
  const activities = extractActivities(tokens, used)
  // A named place already says what kind of place it is.
  const placeTypes = destination ? [] : extractPlaceTypes(tokens, used)
  const constraints = extractConstraints(normalized, tokens, moods, activities, placeTypes)

  // Scored from keywords, what was extracted, and the game context; low confidence means unknown.
  const { intent, confidence, alternatives } = classifyIntent(
    {
      text: normalized,
      tokens,
      destination,
      hasTravelMode: travelMode !== null,
      travelModeIsScooter: travelMode === 'scooter',
      hasBudget: budget !== null,
      moods: moods.moods,
      activities: activities.activities,
      constraints,
    },
    context,
  )

  return {
    raw,
    normalized,
    intent,
    alternatives,
    destination,
    travelMode,
    budget,
    moods: moods.moods,
    activities: activities.activities,
    constraints,
    confidence,
    parser: PARSER_NAME,
  }
}
