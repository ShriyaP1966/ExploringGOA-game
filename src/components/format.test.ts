import { describe, expect, it } from 'vitest'
import { DAYS } from '../data/days'
import { HOW_TO_PLAY_STEPS } from '../data/howToPlay'
import { fillTemplate } from './format'

describe('game text', () => {
  it('fills money, days and place count from the real configuration', () => {
    expect(fillTemplate('{startMoney} for {tripDays} days, {placeCount} places')).toBe('₹5,000 for 3 days, 5 places')
  })

  it('leaves no placeholder behind in any intro or How to play line', () => {
    const lines = [...Object.values(DAYS).flatMap((d) => d.intro), ...HOW_TO_PLAY_STEPS.map((s) => s.text)]
    for (const line of lines) expect(fillTemplate(line)).not.toMatch(/[{}]/)
  })
})
