import { ITEMS } from '../data/items'
import { LOCATIONS, LOCATION_IDS } from '../data/locations'
import type { Activity, GameState } from '../types'
import { advanceTime, formatClock, formatDuration } from './clock'
import { DAY_END_MINUTE } from './config'
import { dayRules } from './days'
import { hasItem, heatPenalty, removeItem } from './items'
import { finalSunsetFromActivity } from './finale'
import { findClue } from './locations'
import { recordMoment } from './memories'
import { addItem, addXp, changeEnergy, recordMemory, spendMoney } from './player'
import { rupees } from './utils'

export type ActivityCheck = { ok: true; activity: Activity } | { ok: false; reason: string }

export function findActivityHere(state: GameState, activityId: string): Activity | undefined {
  return LOCATIONS[state.currentLocationId].activities.find((a) => a.id === activityId)
}

export function isActivityDoneToday(state: GameState, activityId: string): boolean {
  return state.completedActivities.some((a) => a.activityId === activityId && a.day === state.clock.day)
}

/** Checks every activity rule without changing anything. */
export function quoteActivity(state: GameState, activityId: string): ActivityCheck {
  const activity = findActivityHere(state, activityId)
  if (!activity) return { ok: false, reason: "That isn't something you can do here." }

  if (isActivityDoneToday(state, activityId)) {
    return { ok: false, reason: `You've already done this today. Try again tomorrow.` }
  }

  if (activity.requiresItemId && !hasItem(state, activity.requiresItemId)) {
    const source = whereToGet(activity.requiresItemId)
    return {
      ok: false,
      reason: `You need a ${ITEMS[activity.requiresItemId].name.toLowerCase()} for this.${source ? ` You can get one at ${source}.` : ''}`,
    }
  }

  if (activity.givesItemId && ITEMS[activity.givesItemId].unique && hasItem(state, activity.givesItemId)) {
    return { ok: false, reason: `You already have a ${ITEMS[activity.givesItemId].name.toLowerCase()}.` }
  }

  const now = state.clock.minuteOfDay
  if (activity.availableFrom !== undefined && now < activity.availableFrom) {
    return { ok: false, reason: `Not yet: this starts from ${formatClock(activity.availableFrom)}.` }
  }
  if (activity.availableUntil !== undefined && now > activity.availableUntil) {
    return { ok: false, reason: `Too late today: the last start is ${formatClock(activity.availableUntil)}.` }
  }

  if (activity.cost > state.player.money) {
    return {
      ok: false,
      reason: `Not enough money: this costs ${rupees(activity.cost)}, you have ${rupees(state.player.money)}.`,
    }
  }

  const energyNeeded = activityEnergyLoss(state, activity)
  if (energyNeeded > state.player.energy) {
    const heat = activityHeat(state, activity) > 0 ? ' (including the midday heat)' : ''
    return {
      ok: false,
      reason: `Too tired: this needs ⚡${energyNeeded} energy${heat} and you have ⚡${state.player.energy}. Eat or rest first.`,
    }
  }

  if (now + activity.minutes > DAY_END_MINUTE) {
    return {
      ok: false,
      reason: `Not enough time left today: this takes ${formatDuration(activity.minutes)} and must finish by ${formatClock(DAY_END_MINUTE)}.`,
    }
  }

  return { ok: true, activity }
}

export function isFinaleActivity(state: GameState, activity: Activity): boolean {
  return Boolean(activity.isSunset) && dayRules(state).finaleSunset
}

/** Extra energy the midday heat takes: only outdoors, only for tiring activities. */
export function activityHeat(state: GameState, activity: Activity): number {
  return activity.indoor || activity.energy >= 0 ? 0 : heatPenalty(state)
}

/** Total energy an activity uses (0 for meals and rest, which restore energy). */
export function activityEnergyLoss(state: GameState, activity: Activity): number {
  return Math.max(0, -activity.energy) + activityHeat(state, activity)
}

/** The location where an item can be obtained through an activity, if any. */
function whereToGet(itemId: string): string | null {
  const source = LOCATION_IDS.find((id) => LOCATIONS[id].activities.some((a) => a.givesItemId === itemId))
  return source ? LOCATIONS[source].name : null
}

/** A photo moment becomes a memory only with a camera, and only once per activity. */
function capturePhoto(state: GameState, activity: Activity): { state: GameState; text: string | null } {
  if (!activity.memory) return { state, text: null }
  if (!hasItem(state, 'camera')) return { state, text: '📷 No camera, so no photo of this moment.' }
  if (state.player.memories.some((m) => m.activityId === activity.id)) return { state, text: null }
  return {
    state: recordMemory(state, { ...activity.memory, activityId: activity.id, emoji: activity.emoji, photo: true }),
    text: `📸 Photo memory saved: “${activity.memory.title}”.`,
  }
}

export function doActivity(state: GameState, activityId: string): GameState {
  const check = quoteActivity(state, activityId)
  if (!check.ok) return { ...state, notice: check.reason }
  const { activity } = check

  const heat = activityHeat(state, activity)
  let next = spendMoney(state, activity.cost)
  next = changeEnergy(next, activity.energy - heat)
  // The photo is taken when the moment starts, so it carries the start time.
  const photo = capturePhoto(next, activity)
  // Story memories (a great meal, the Vagator sunset…) are made from the same moment.
  next = recordMoment(photo.state, { type: 'activity', activity })
  next = advanceTime(next, activity.minutes)
  next = addXp(next, activity.xp)

  const extras: string[] = []
  if (heat > 0) {
    extras.push(
      hasItem(state, 'sunglasses')
        ? `☀️ Midday heat cost ⚡${heat} more (your sunglasses helped).`
        : `☀️ Midday heat cost ⚡${heat} more. Sunglasses would help.`,
    )
  }
  if (activity.requiresItemId && activity.consumesRequiredItem) {
    next = removeItem(next, activity.requiresItemId)
    extras.push(`${ITEMS[activity.requiresItemId].emoji} ${ITEMS[activity.requiresItemId].name} used.`)
  }
  if (activity.givesClueId && !next.foundClueIds.includes(activity.givesClueId)) {
    next = { ...findClue(next, activity.givesClueId), notice: next.notice }
    extras.push('🧭 You learned something new!')
  }
  if (activity.hintsLocationId) {
    const place = activity.hintsLocationId
    if (!next.hintedLocationIds.includes(place)) next = { ...next, hintedLocationIds: [...next.hintedLocationIds, place] }
    extras.push(`📍 ${LOCATIONS[place].name} is marked on your map.`)
  }
  if (activity.givesItemId) {
    next = addItem(next, activity.givesItemId)
    extras.push(`${ITEMS[activity.givesItemId].emoji} You got: ${ITEMS[activity.givesItemId].name}.`)
  }
  if (photo.text) extras.push(photo.text)

  const energyChange = activity.energy - heat
  const parts = [
    formatDuration(activity.minutes),
    activity.cost > 0 ? rupees(activity.cost) : null,
    energyChange !== 0 ? `⚡${energyChange > 0 ? '+' : '−'}${Math.abs(energyChange)}` : null,
    `+${activity.xp} XP`,
  ].filter(Boolean)

  const done: GameState = {
    ...next,
    completedActivities: [...next.completedActivities, { activityId, day: state.clock.day }],
    notice: [`${activity.emoji} ${activity.name}: ${parts.join(' · ')}.`, ...extras].join(' '),
  }
  // On the last day, a sunset activity is also your choice of place for the final sunset.
  return isFinaleActivity(state, activity) ? finalSunsetFromActivity(state, done) : done
}
