import type { ParseContext, ParsedCommand } from '../types'
import { ruleParse } from './ruleParser'

export { describeBudget, describeConstraint } from './describe'

/** Longer input is cut to this many characters (dictation can run on). */
export const MAX_COMMAND_LENGTH = 500

/** What the parser returns if anything goes wrong: understood as nothing, never a crash. */
function nothingUnderstood(raw: string): ParsedCommand {
  return {
    raw,
    normalized: '',
    intent: 'unknown',
    alternatives: [],
    destination: null,
    travelMode: null,
    budget: null,
    moods: [],
    activities: [],
    constraints: [],
    confidence: 0,
    parser: 'rule-based',
  }
}

/**
 * The parser the game uses: rule-based, no AI and no network. `context` is read-only game information.
 * It never throws: empty, very long or strange input is understood as best it can, or as nothing.
 */
export function parseCommand(raw: string, context: ParseContext = {}): ParsedCommand {
  const text = typeof raw === 'string' ? raw : ''
  const tooLong = text.length > MAX_COMMAND_LENGTH
  const input = tooLong ? text.slice(0, MAX_COMMAND_LENGTH) : text
  // What was said is kept (shortened, marked with …) so the panel can show it.
  const shown = tooLong ? `${input}…` : input
  try {
    const parsed = ruleParse(input, context)
    return tooLong ? { ...parsed, raw: shown } : parsed
  } catch {
    return nothingUnderstood(shown)
  }
}
