import { ITEMS } from '../data/items'
import { STORY_MEMORIES } from '../data/memories'
import { QUESTS } from '../data/quests'
import { LOCATIONS } from '../data/locations'
import type {
  FinalSunset,
  GameState,
  LocationId,
  Quest,
  QuestAttempt,
  QuestCondition,
  QuestProgress,
  QuestStep,
  QuestUpdate,
  Region,
  TripRecord,
} from '../types'
import { FINALE_RULES } from './config'
import { recordMoment } from './memories'
import { addItem, addXp, removeXp } from './player'

export function questById(id: string): Quest {
  const quest = QUESTS.find((q) => q.id === id)
  if (!quest) throw new Error(`Unknown quest "${id}"`)
  return quest
}

export function initialQuestProgress(): QuestProgress[] {
  return QUESTS.map((quest) => ({
    questId: quest.id,
    status: 'not-started',
    attempt: 0,
    attemptDay: null,
    completedStepIds: [],
    retryPending: false,
  }))
}

/** Extra facts about when quests are being checked. */
export interface QuestCheckContext {
  /** The final check as the day closes (End day, 10 PM, or the finale). */
  dayEnding: boolean
}

const DURING_DAY: QuestCheckContext = { dayEnding: false }

export function tripsToday(state: GameState): TripRecord[] {
  return state.tripLog.filter((trip) => trip.day === state.clock.day)
}

/** Different places you have been today, starting with where you woke up. */
export function placesVisitedToday(state: GameState): LocationId[] {
  const places = [state.dayStart.locationId, ...tripsToday(state).map((trip) => trip.to)]
  return [...new Set(places)]
}

export function regionsVisitedToday(state: GameState): Region[] {
  return [...new Set(placesVisitedToday(state).map((id) => LOCATIONS[id].region))]
}

/** Evaluates a quest condition against the game state. Pure. */
export function checkCondition(
  state: GameState,
  condition: QuestCondition,
  progress: QuestProgress,
  context: QuestCheckContext = DURING_DAY,
): boolean {
  const { day, minuteOfDay } = state.clock
  switch (condition.type) {
    case 'money-at-least':
      return state.player.money >= condition.amount
    case 'scooter-rented-today':
      return state.scooterRentedOnDay === day
    case 'trips-today':
      return tripsToday(state).filter((trip) => !condition.mode || trip.mode === condition.mode).length >= condition.atLeast
    case 'places-visited-today':
      return placesVisitedToday(state).length >= condition.atLeast
    case 'regions-visited-today':
      return regionsVisitedToday(state).length >= condition.atLeast
    case 'day-ending':
      return context.dayEnding
    case 'final-sunset-watched':
      return state.finalSunset !== null
    case 'day-is':
      return day === condition.day
    case 'time-at-least':
      return minuteOfDay >= condition.minute
    case 'time-after':
      return minuteOfDay > condition.minute
    case 'time-before':
      return minuteOfDay <= condition.minute
    case 'at-location':
      return state.currentLocationId === condition.locationId
    case 'has-clue':
      return state.foundClueIds.includes(condition.clueId)
    case 'energy-at-least':
      return state.player.energy >= condition.amount
    case 'activity-done-today':
      return state.completedActivities.some((a) => a.activityId === condition.activityId && a.day === day)
    case 'step-incomplete':
      return !progress.completedStepIds.includes(condition.stepId)
    case 'on-attempt-day':
      return progress.attemptDay === day
    case 'after-attempt-day':
      return progress.attemptDay !== null && day > progress.attemptDay
    case 'all':
      return condition.conditions.every((c) => checkCondition(state, c, progress, context))
    case 'any':
      return condition.conditions.some((c) => checkCondition(state, c, progress, context))
  }
}

export function currentStep(quest: Quest, progress: QuestProgress): QuestStep | null {
  return quest.steps.find((step) => !progress.completedStepIds.includes(step.id)) ?? null
}

export function currentAttempt(quest: Quest, progress: QuestProgress): QuestAttempt {
  return quest.attempts[Math.min(progress.attempt, quest.attempts.length - 1)]
}

/** Story memories a quest gives when completed (via its quest-complete trigger). */
export function questMemoryTitles(questId: string): string[] {
  return STORY_MEMORIES.filter((memory) =>
    memory.triggers.some((t) => t.type === 'quest-complete' && t.questId === questId),
  ).map((memory) => memory.title)
}

/** The reward, as promised, or as actually earned once the final sunset has been watched. */
export function rewardText(questId: string, attempt: QuestAttempt, finalSunset: FinalSunset | null = null): string {
  const qualities = FINALE_RULES.qualities
  const place = finalSunset ? LOCATIONS[finalSunset.locationId].name : 'your chosen place'
  const parts = [
    `+${attempt.reward.xp} XP`,
    ...attempt.reward.itemIds.map((id) => `${ITEMS[id].emoji} ${ITEMS[id].name}`),
    ...questMemoryTitles(questId).map((title) => `📔 ${title.replaceAll('{place}', place)}`),
    ...(attempt.reward.finalSunsetBonus && finalSunset
      ? [`🌟 ${finalSunset.quality} ending +${finalSunset.xp} XP and +${finalSunset.scoreBonus} score`]
      : attempt.reward.finalSunsetBonus
      ? [`🌟 ending bonus +${qualities[qualities.length - 1].xp}–${qualities[0].xp} XP and +${qualities[qualities.length - 1].scoreBonus}–${qualities[0].scoreBonus} score`]
      : []),
  ]
  return parts.join(', ')
}

function startAttempt(progress: QuestProgress, quest: Quest, attempt: number, day: number): QuestProgress {
  const keep = (id: string) => !quest.steps.find((s) => s.id === id)?.resetOnRetry
  return {
    ...progress,
    status: 'active',
    attempt,
    attemptDay: day,
    retryPending: false,
    completedStepIds: attempt === 0 ? progress.completedStepIds : progress.completedStepIds.filter(keep),
  }
}

function giveReward(state: GameState, quest: Quest, attempt: QuestAttempt): GameState {
  const { reward } = attempt
  let next = addXp(state, reward.xp)
  for (const itemId of reward.itemIds) next = addItem(next, itemId)
  // The finale's bonus depends on how well the final sunset was earned (see engine/finale.ts).
  if (reward.finalSunsetBonus && next.finalSunset) {
    const { xp, scoreBonus, quality } = next.finalSunset
    next = addXp(next, xp)
    next = { ...next, scoreBonuses: [...next.scoreBonuses, { id: quest.id, label: `Final sunset (${quality})`, points: scoreBonus }] }
  }
  next = recordMoment(next, { type: 'quest-complete', questId: quest.id })
  return reward.endsTrip ? { ...next, ending: 'final-sunset' } : next
}

function failAttempt(
  state: GameState,
  quest: Quest,
  progress: QuestProgress,
  attempt: QuestAttempt,
): { state: GameState; progress: QuestProgress; text: string } {
  const hasRetry = progress.attempt + 1 < quest.attempts.length
  const before = state.player.xp
  const next = attempt.xpPenalty ? removeXp(state, attempt.xpPenalty) : state
  const lost = before - next.player.xp
  return {
    state: next,
    progress: { ...progress, status: 'failed', retryPending: hasRetry },
    text: `🌑 Quest failed: ${quest.title}. ${attempt.consequence}${lost > 0 ? ` (−${lost} XP)` : ''}`,
  }
}

/** Moves one quest forward as far as the current state allows. */
function advanceQuest(
  state: GameState,
  progress: QuestProgress,
  context: QuestCheckContext,
): { state: GameState; progress: QuestProgress; updates: QuestUpdate[] } {
  const quest = questById(progress.questId)
  const updates: QuestUpdate[] = []
  const update = (kind: QuestUpdate['kind'], text: string) => updates.push({ questId: quest.id, kind, text })
  const check = (condition: QuestCondition, p: QuestProgress) => checkCondition(s, condition, p, context)
  let p = progress
  let s = state

  // Start the quest, or open a retry, when allowed.
  if (p.status === 'not-started' && quest.requirements.every((c) => check(c, p))) {
    p = startAttempt(p, quest, 0, s.clock.day)
    update('started', `📜 New quest: ${quest.emoji} ${quest.title}. ${quest.objective}`)
  } else if (p.status === 'failed' && p.retryPending) {
    const next = quest.attempts[p.attempt + 1]
    if (next?.availableWhen && check(next.availableWhen, p)) {
      p = startAttempt(p, quest, p.attempt + 1, s.clock.day)
      update('retry', `📜 ${next.label}: ${quest.emoji} ${quest.title} is back on (reward ${rewardText(quest.id, next)}).`)
    } else if (next?.expiresWhen && check(next.expiresWhen, p)) {
      p = { ...p, retryPending: false }
      update('failed', `🌑 The chance for ${quest.title} has passed.`)
    }
  }
  if (p.status !== 'active') return { state: s, progress: p, updates }

  const attempt = currentAttempt(quest, p)

  // Rules that must hold the whole time (e.g. keep energy and money up) are checked first.
  if (quest.constraint && !check(quest.constraint, p)) {
    const failed = failAttempt(s, quest, p, attempt)
    update('failed', failed.text)
    return { state: failed.state, progress: failed.progress, updates }
  }

  // Tick off steps strictly in order.
  for (let step = currentStep(quest, p); step && check(step.completeWhen, p); step = currentStep(quest, p)) {
    p = { ...p, completedStepIds: [...p.completedStepIds, step.id] }
    update('step', `✅ Quest step done: ${step.description}.`)
  }

  if (!currentStep(quest, p)) {
    s = giveReward(s, quest, attempt)
    p = { ...p, status: 'completed' }
    update('completed', `🏆 Quest complete: ${quest.title}! ${rewardText(quest.id, attempt, s.finalSunset)}`)
  } else if (check(quest.failWhen, p)) {
    const failed = failAttempt(s, quest, p, attempt)
    s = failed.state
    p = failed.progress
    update('failed', failed.text)
  }
  return { state: s, progress: p, updates }
}

/**
 * Runs after every action: starts, advances, completes and fails quests automatically.
 * The reducer runs it once more with `dayEnding` just before a day closes.
 */
export function updateQuests(state: GameState, context: QuestCheckContext = DURING_DAY): GameState {
  let next = state
  const progress: QuestProgress[] = []
  const updates: QuestUpdate[] = []
  for (const entry of state.quests) {
    const result = advanceQuest(next, entry, context)
    next = result.state
    progress.push(result.progress)
    updates.push(...result.updates)
  }
  if (updates.length === 0 && progress.every((p, i) => p === state.quests[i])) return next
  return { ...next, quests: progress, questUpdates: [...next.questUpdates, ...updates] }
}
