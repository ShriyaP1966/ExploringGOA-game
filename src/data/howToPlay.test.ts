import { describe, expect, it } from 'vitest'
import { parseCommand } from '../parser'
import { EXAMPLE_GROUPS } from './howToPlay'

describe('How to play examples', () => {
  const phrases = EXAMPLE_GROUPS.flatMap((g) => g.phrases)

  it.each(phrases)('"%s" is understood by the parser', (phrase) => {
    const parsed = parseCommand(phrase, { currentLocationId: 'baga', pendingQuestion: phrase === 'yes' || phrase === 'no thanks' })
    expect(parsed.intent).not.toBe('unknown')
  })

  it('includes the two examples players see first', () => {
    expect(phrases).toEqual(expect.arrayContaining(['take me to Vagator', 'find me cheap food nearby']))
  })
})
