import { describe, expect, it } from 'vitest'
import { advanceTime, formatClock, formatDuration } from './clock'
import { createInitialState } from './initialState'

describe('advanceTime', () => {
  it('moves the clock forward within a day', () => {
    const state = advanceTime(createInitialState(), 90)
    expect(state.clock).toEqual({ day: 1, minuteOfDay: 10 * 60 + 30 })
  })

  it('rolls over into the next day', () => {
    // 9 AM + 16 hours = 1 AM on day 2
    const state = advanceTime(createInitialState(), 16 * 60)
    expect(state.clock).toEqual({ day: 2, minuteOfDay: 60 })
  })

  it('can roll over several days at once', () => {
    const state = advanceTime(createInitialState(), 2 * 24 * 60 + 30)
    expect(state.clock).toEqual({ day: 3, minuteOfDay: 9 * 60 + 30 })
  })

  it('ignores zero, negative and non-finite minutes', () => {
    const start = createInitialState()
    expect(advanceTime(start, 0)).toBe(start)
    expect(advanceTime(start, -30)).toBe(start)
    expect(advanceTime(start, Number.NaN)).toBe(start)
  })
})

describe('formatDuration', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [75, '1 h 15 min'],
    [135, '2 h 15 min'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})

describe('formatClock', () => {
  it.each([
    [0, '12:00 AM'],
    [540, '9:00 AM'],
    [720, '12:00 PM'],
    [795, '1:15 PM'],
    [1439, '11:59 PM'],
  ])('formats %i as %s', (minute, expected) => {
    expect(formatClock(minute)).toBe(expected)
  })
})
