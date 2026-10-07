import { ITEMS } from '../data/items'
import { LEVELS } from '../data/levels'
import type { GameState, ItemId, LevelInfo, Memory, MemoryInput, Player } from '../types'
import { ENERGY_MAX, ENERGY_MIN, XP_REWARDS } from './config'
import { clamp, isPositiveAmount } from './utils'

function withPlayer(state: GameState, changes: Partial<Player>, notice: string | null = state.notice): GameState {
  return { ...state, player: { ...state.player, ...changes }, notice }
}

function withNotice(state: GameState, notice: string): GameState {
  return { ...state, notice }
}

export function canAfford(state: GameState, amount: number): boolean {
  return amount <= state.player.money
}

/** Refuses (with a notice) rather than letting money go below 0. */
export function spendMoney(state: GameState, amount: number): GameState {
  if (!isPositiveAmount(amount)) return state
  if (!canAfford(state, amount)) {
    const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`
    return withNotice(state, `Not enough money: you have ${rupees(state.player.money)}, this costs ${rupees(amount)}.`)
  }
  return withPlayer(state, {
    money: state.player.money - amount,
    stats: { ...state.player.stats, moneySpent: state.player.stats.moneySpent + amount },
  })
}

/** Positive delta restores energy, negative uses it. Always stays within 0–100. */
/** Developer tool: money in (the real game has no income). Does not count as spending. */
export function receiveMoney(state: GameState, amount: number): GameState {
  if (!isPositiveAmount(amount)) return state
  return withPlayer(state, { money: state.player.money + amount })
}

export function changeEnergy(state: GameState, delta: number): GameState {
  if (!Number.isFinite(delta) || delta === 0) return state
  return withPlayer(state, { energy: clamp(state.player.energy + delta, ENERGY_MIN, ENERGY_MAX) })
}

export function levelForXp(xp: number): number {
  let level = LEVELS[0].level
  for (const info of LEVELS) if (xp >= info.minXp) level = info.level
  return level
}

export function levelInfo(level: number): LevelInfo {
  return LEVELS.find((info) => info.level === level) ?? LEVELS[0]
}

export interface XpProgress {
  level: number
  isMaxLevel: boolean
  /** XP earned since the current level began. */
  intoLevel: number
  /** XP between the current level and the next (0 at max level). */
  levelSpan: number
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp)
  const index = LEVELS.findIndex((info) => info.level === level)
  const isMaxLevel = index === LEVELS.length - 1
  const start = LEVELS[index].minXp
  const levelSpan = isMaxLevel ? 0 : LEVELS[index + 1].minXp - start
  return { level, isMaxLevel, intoLevel: xp - start, levelSpan }
}

/** XP lost (e.g. a failed quest's consequence). You never drop below the start of your current level. */
export function removeXp(state: GameState, amount: number): GameState {
  if (!isPositiveAmount(amount)) return state
  const floor = levelInfo(state.player.level).minXp
  return withPlayer(state, { xp: Math.max(floor, state.player.xp - Math.round(amount)) })
}

/** Every XP source goes through here, so a level-up is always noticed (state.levelUp). */
export function addXp(state: GameState, amount: number): GameState {
  if (!isPositiveAmount(amount)) return state
  const xp = state.player.xp + Math.round(amount)
  const level = levelForXp(xp)
  const next = withPlayer(state, { xp, level })
  if (level <= state.player.level) return next
  const info = levelInfo(level)
  return { ...next, levelUp: { level, title: info.title, perk: info.perk } }
}

export function addItem(state: GameState, itemId: ItemId, quantity = 1): GameState {
  const item = ITEMS[itemId]
  if (!item) return withNotice(state, `There is no item called "${itemId}".`)
  if (!Number.isInteger(quantity) || quantity <= 0) return state

  const inventory = state.player.inventory
  const existing = inventory.find((entry) => entry.itemId === itemId)
  const nextInventory = existing
    ? inventory.map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity + quantity } : entry))
    : [...inventory, { itemId, quantity }]
  return withPlayer(state, { inventory: nextInventory })
}

/** Stamps the memory with the current day, time and location. Collecting a memory earns XP. */
export function recordMemory(state: GameState, input: MemoryInput, xp: number = XP_REWARDS.memory): GameState {
  const title = input.title.trim()
  if (!title) return state
  const memory: Memory = {
    id: `memory-${state.player.memories.length + 1}`,
    title,
    description: input.description.trim(),
    day: state.clock.day,
    minuteOfDay: state.clock.minuteOfDay,
    locationId: state.currentLocationId,
    ...(input.emoji ? { emoji: input.emoji } : {}),
    ...(input.activityId ? { activityId: input.activityId } : {}),
    ...(input.storyId ? { storyId: input.storyId } : {}),
    ...(input.photo !== undefined ? { photo: input.photo } : {}),
  }
  const next = withPlayer(state, { memories: [...state.player.memories, memory] })
  return addXp({ ...next, newMemoryIds: [...next.newMemoryIds, memory.id] }, xp)
}
