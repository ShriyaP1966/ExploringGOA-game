import { LOCATIONS } from '../data/locations'
import type { ActionResult, CommandChanges, CommandOutcome, CommandRecord, GameState, ParsedCommand } from '../types'
import type { MappedCommand } from './actionMapper'
import { COMMAND_RULES } from './config'
import { questById } from './quests'

function changed<T>(from: T, to: T, same: (a: T, b: T) => boolean = Object.is) {
  return same(from, to) ? null : { from, to }
}

/** Compares the state before and after a command: exactly what really changed. */
export function describeChanges(before: GameState, after: GameState): CommandChanges {
  const quests: string[] = []
  for (const progress of after.quests) {
    const old = before.quests.find((q) => q.questId === progress.questId)
    const quest = questById(progress.questId)
    if (!old) continue
    if (old.status !== progress.status || old.retryPending !== progress.retryPending) {
      const status = progress.retryPending ? 'failed, retry pending' : progress.status.replace('-', ' ')
      quests.push(`${quest.emoji} ${quest.title}: ${status}`)
    }
    for (const stepId of progress.completedStepIds.filter((id) => !old.completedStepIds.includes(id))) {
      const step = quest.steps.find((s) => s.id === stepId)
      if (step) quests.push(`${quest.emoji} ${quest.title}: ✓ ${step.description}`)
    }
  }

  const discoveries = [
    ...after.discoveredLocationIds
      .filter((id) => !before.discoveredLocationIds.includes(id))
      .map((id) => `🗺️ Discovered ${LOCATIONS[id].name}`),
    ...after.foundClueIds.filter((id) => !before.foundClueIds.includes(id)).map(() => '🧭 Found a new clue'),
    ...after.player.memories
      .filter((m) => !before.player.memories.some((old) => old.id === m.id))
      .map((m) => `📔 New memory: ${m.title}`),
  ]

  return {
    location: changed(before.currentLocationId, after.currentLocationId),
    money: changed(before.player.money, after.player.money),
    energy: changed(before.player.energy, after.player.energy),
    time: changed(before.clock, after.clock, (a, b) => a.day === b.day && a.minuteOfDay === b.minuteOfDay),
    quests,
    discoveries,
  }
}

/** Transient fields that describe the last action rather than the game itself. */
const TRANSIENT = new Set(['notice', 'levelUp', 'newMemoryIds', 'questUpdates', 'commandLog', 'lastAction'])

/** Did anything real change (not just a message)? A refused action changes nothing but the notice. */
export function changedForReal(before: GameState, after: GameState): boolean {
  if (before === after) return false
  const strip = (s: GameState) => JSON.stringify(s, (key, value) => (TRANSIENT.has(key) ? undefined : value))
  return strip(before) !== strip(after)
}

/** Why the reducer ignored an action, when it gives no message of its own. */
export function gateReason(state: GameState): string | null {
  if (state.phase === 'day-intro') return `Day ${state.clock.day} hasn't started yet.`
  if (state.phase === 'day-summary') return 'The day is over.'
  if (state.phase === 'ended') return 'The trip is over.'
  if (state.activeEvent) return 'Something is happening: choose what to do first.'
  return null
}

/**
 * Records a command and its real outcome in the short history (oldest dropped first):
 * success or refusal, a human-readable reason, and exactly what changed.
 */
export function recordCommand(
  before: GameState,
  after: GameState,
  parsed: ParsedCommand,
  mapped: MappedCommand,
  /** Each action's own result from the engine. Without them, success is judged by whether anything changed. */
  results?: ActionResult[],
): GameState {
  const actions = mapped.kind === 'actions' ? mapped.actions : []
  let outcome: CommandOutcome
  let result: string
  if (mapped.kind === 'answer') {
    outcome = 'answered'
    result = mapped.text
  } else if (mapped.kind === 'refuse') {
    outcome = 'refused'
    result = mapped.reason
  } else if (mapped.kind === 'not-understood') {
    outcome = 'not-understood'
    result = mapped.reason
  } else {
    const refusal = results?.find((r) => !r.ok)
    const succeeded = results ? results.length > 0 && !refusal : changedForReal(before, after)
    if (succeeded) {
      outcome = 'success'
      // "Done." is only a fallback: it is left out when anything more specific was said.
      const reasons = (results ?? []).map((r) => r.reason).filter((r) => r !== 'Done.')
      const said = reasons.join(' ') || after.notice || after.questUpdates.map((u) => u.text).join(' ') || (mapped.note ? '' : 'Done.')
      result = [mapped.note, said].filter(Boolean).join(' ')
    } else {
      outcome = 'refused'
      result = refusal?.reason || after.notice || gateReason(before) || 'That is not possible right now.'
    }
  }

  // A command that ran no action (an answer, a refusal, not understood) also replaces the last
  // action's level-up, memory and quest notifications, so nothing stale lingers on screen.
  if (actions.length === 0) after = { ...after, levelUp: null, newMemoryIds: [], questUpdates: [] }

  const previous = before.commandLog
  const record: CommandRecord = {
    id: (previous[previous.length - 1]?.id ?? 0) + 1,
    parsed,
    outcome,
    actions: actions.map((a) => a.type),
    actionCount: actions.length,
    suggestion: (mapped.kind === 'answer' || mapped.kind === 'actions') && mapped.suggestion ? mapped.suggestion : null,
    notes: mapped.notes ?? [],
    result,
    changes: describeChanges(before, after),
    at: before.clock,
  }
  // Refusals and answers also show in the game's own notice, so nothing is silent.
  const notice = outcome === 'refused' || outcome === 'not-understood' ? result : after.notice
  return { ...after, notice, commandLog: [...previous, record].slice(-COMMAND_RULES.historyLength) }
}
