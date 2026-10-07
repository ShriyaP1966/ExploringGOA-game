import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from './config'

describe('GAME_CONFIG', () => {
  it('describes a 3-day trip with 3 levels', () => {
    expect(GAME_CONFIG.title).toBe('ExploringGOA')
    expect(GAME_CONFIG.tripDays).toBe(3)
    expect(GAME_CONFIG.maxLevel).toBe(3)
  })
})
