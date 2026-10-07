import type { AdventureScore, GameState, RankInfo, ScoreLine } from '../types'
import { BUDGET_RULES, GAME_CONFIG, SCORE_RULES } from './config'

const RANKS: readonly RankInfo[] = SCORE_RULES.ranks

/** Days with a summary: each day the player saw through to the end. */
export function daysPlayed(state: GameState): number {
  return state.daySummaries.length
}

export function questsCompleted(state: GameState): number {
  return state.quests.filter((q) => q.status === 'completed').length
}

/** The most the whole trip may cost and still count as under budget. */
export function tripBudget(): number {
  return BUDGET_RULES.dailyBudget * GAME_CONFIG.tripDays
}

/** Finished the trip, did something, and spent no more than the trip budget. */
export function finishedUnderBudget(state: GameState): boolean {
  return state.ending !== null && state.completedActivities.length > 0 && state.player.stats.moneySpent <= tripBudget()
}

/** The rank a score earns: the best rank whose threshold it reaches. */
export function rankFor(score: number): RankInfo {
  return RANKS.find((r) => score >= r.minScore) ?? RANKS[RANKS.length - 1]
}

/**
 * The final Adventure Score, read only from real tracked values. Pure: the same state always
 * gives the same score, and nothing is changed.
 */
export function adventureScore(state: GameState): AdventureScore {
  const { player } = state
  const days = daysPlayed(state)
  const places = state.discoveredLocationIds.length
  const quests = questsCompleted(state)
  const spent = player.stats.moneySpent
  const km = player.stats.kmTraveled
  const memories = player.memories.length
  const levelsAbove = Math.max(0, player.level - 1)
  const endingBonus = state.scoreBonuses.reduce((sum, b) => sum + b.points, 0)

  const lines: ScoreLine[] = [
    { id: 'days', emoji: '📅', label: 'Days played', value: days, points: days * SCORE_RULES.perDayPlayed },
    { id: 'places', emoji: '📍', label: 'Places discovered', value: places, points: places * SCORE_RULES.perLocationDiscovered },
    { id: 'quests', emoji: '📜', label: 'Quests completed', value: quests, points: quests * SCORE_RULES.perQuestCompleted },
    {
      id: 'money',
      emoji: '💸',
      label: 'Money spent on experiences',
      value: spent,
      points: Math.min(SCORE_RULES.moneySpentMaxPoints, Math.floor(spent / SCORE_RULES.rupeesPerPoint)),
    },
    { id: 'km', emoji: '🛣️', label: 'Kilometres travelled', value: km, points: Math.min(SCORE_RULES.kmMaxPoints, Math.round(km * SCORE_RULES.perKm)) },
    { id: 'memories', emoji: '📔', label: 'Memories collected', value: memories, points: memories * SCORE_RULES.perMemory },
    { id: 'xp', emoji: '✨', label: 'XP earned', value: player.xp, points: player.xp * SCORE_RULES.perXp },
    { id: 'level', emoji: '⭐', label: 'Level reached', value: player.level, points: levelsAbove * SCORE_RULES.perLevelAboveFirst },
  ]
  if (finishedUnderBudget(state)) {
    lines.push({ id: 'under-budget', emoji: '💰', label: 'Finished under budget', value: spent, points: SCORE_RULES.underBudgetBonus })
  }
  if (endingBonus > 0) {
    lines.push({ id: 'ending', emoji: '🌇', label: 'Final sunset bonus', value: endingBonus, points: endingBonus })
  }

  const total = lines.reduce((sum, line) => sum + line.points, 0)
  const rank = rankFor(total)
  const higher = RANKS.filter((r) => r.minScore > total)
  const next = higher[higher.length - 1]
  return { lines, total, rank, nextRank: next ? { rank: next, pointsNeeded: next.minScore - total } : null }
}
