import type { LevelInfo } from '../types'

/** Ordered from the first level. The perks themselves are applied in the engine (see LEVEL_PERKS). */
export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    title: 'Tourist',
    emoji: '🧳',
    minXp: 0,
    perk: 'Fresh off the plane. Explore to level up.',
  },
  {
    level: 2,
    title: 'Explorer',
    emoji: '🧭',
    minXp: 150,
    perk: 'Scooter rentals are 25% cheaper.',
  },
  {
    level: 3,
    title: 'Local Legend',
    emoji: '🌴',
    minXp: 450,
    perk: 'Locals are far more likely to help you.',
  },
]
