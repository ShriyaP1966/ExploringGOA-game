import { LOCATIONS } from '../../data/locations'
import { questById } from '../../engine/quests'
import type { GameState, QuestUpdate } from '../../types'

/**
 * What changed between two game states, for feedback only (floating numbers and toasts). It reads
 * state and never changes it. A reset or a loaded save is not "something that happened", so it
 * produces no feedback.
 */

/** Time went backwards or the trip's totals shrank: a new trip or a loaded save, not a game event. */
export function isRewind(prev: GameState, next: GameState): boolean {
  const before = prev.clock.day * 10_000 + prev.clock.minuteOfDay
  const after = next.clock.day * 10_000 + next.clock.minuteOfDay
  return (
    after < before ||
    next.player.stats.moneySpent < prev.player.stats.moneySpent ||
    next.daySummaries.length < prev.daySummaries.length
  )
}

export type Stat = 'money' | 'energy' | 'xp'

export interface StatDelta {
  stat: Stat
  amount: number
}

export function statDeltas(prev: GameState, next: GameState): StatDelta[] {
  if (prev === next || isRewind(prev, next)) return []
  const deltas: StatDelta[] = [
    { stat: 'money', amount: next.player.money - prev.player.money },
    { stat: 'energy', amount: next.player.energy - prev.player.energy },
    { stat: 'xp', amount: next.player.xp - prev.player.xp },
  ]
  return deltas.filter((d) => d.amount !== 0)
}

/** "+₹500", "−20", "+25 XP": a signed number as the HUD shows it. */
export function formatDelta({ stat, amount }: StatDelta): string {
  const sign = amount > 0 ? '+' : '−'
  const value = Math.abs(amount).toLocaleString('en-IN')
  if (stat === 'money') return `${sign}₹${value}`
  if (stat === 'xp') return `${sign}${value} XP`
  return `${sign}${value}`
}

export type ToastKind = 'discovery' | 'quest' | 'xp' | 'level' | 'memory'

export interface ToastSpec {
  kind: ToastKind
  icon: string
  title: string
  text?: string
}

const QUEST_TITLE: Record<QuestUpdate['kind'], string> = {
  started: 'New quest',
  step: 'Quest step done',
  completed: 'Quest complete!',
  failed: 'Quest failed',
  retry: 'Another chance',
}

/** Toasts for what just happened: places discovered, quest news, level-ups, memories and XP. */
export function toastsFor(prev: GameState, next: GameState): ToastSpec[] {
  if (prev === next || isRewind(prev, next)) return []
  const toasts: ToastSpec[] = []

  for (const id of next.discoveredLocationIds.filter((id) => !prev.discoveredLocationIds.includes(id))) {
    toasts.push({ kind: 'discovery', icon: '🗺️', title: 'New place discovered', text: `${LOCATIONS[id].emoji} ${LOCATIONS[id].name}` })
  }

  if (next.questUpdates !== prev.questUpdates) {
    for (const update of next.questUpdates) {
      const quest = questById(update.questId)
      // The toast's title already says "New quest" etc., so drop the message's own "📜 New quest:" opening.
      toasts.push({ kind: 'quest', icon: quest.emoji, title: QUEST_TITLE[update.kind], text: update.text.replace(/^\S+\s[^:]{1,30}:\s*/u, '') })
    }
  }

  if (next.levelUp && next.levelUp !== prev.levelUp) {
    const article = /^[AEIOU]/i.test(next.levelUp.title) ? 'an' : 'a'
    toasts.push({ kind: 'level', icon: '⭐', title: `Level up! You are now ${article} ${next.levelUp.title}`, text: `🎁 ${next.levelUp.perk}` })
  }

  if (next.newMemoryIds !== prev.newMemoryIds) {
    for (const memory of next.player.memories.filter((m) => next.newMemoryIds.includes(m.id))) {
      toasts.push({
        kind: 'memory',
        icon: memory.emoji ?? '📸',
        title: 'New memory',
        text: `${memory.title}${memory.photo ? ' 📸' : ''}`,
      })
    }
  }

  const xp = next.player.xp - prev.player.xp
  if (xp > 0) toasts.push({ kind: 'xp', icon: '✨', title: `+${xp} XP` })

  return toasts
}
