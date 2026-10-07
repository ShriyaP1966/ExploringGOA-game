/**
 * Seeded random numbers (mulberry32), so chance-based rules stay pure and testable:
 * the same seed always gives the same roll, and each roll returns the next seed to store.
 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const nextSeed = (seed + 0x6d2b79f5) | 0
  let t = nextSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, nextSeed]
}

/** A fresh seed for a new game. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
