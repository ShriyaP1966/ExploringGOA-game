import { describe, expect, it } from 'vitest'
import { parseCommand } from '.'
import type { CommandIntent, ParseContext } from '../types'
import { confidenceFrom, MIN_CONFIDENCE } from './intents'

const intentOf = (text: string, context?: ParseContext) => parseCommand(text, context).intent

/** Every intent, with several ways of saying it. */
const EXAMPLES: Record<Exclude<CommandIntent, 'unknown'>, string[]> = {
  travel: [
    'take me to anjuna',
    'go to panjim by scooter',
    'palolem please',
    'ride to vagator',
    'take me somewhere quiet',
    "I'm tired take me somewhere relaxing",
  ],
  'find-place': [
    'find me a quiet beach',
    "I want a beautiful beach that isn't too crowded",
    'something cheap and beautiful',
    'I have 800 rupees left find somewhere beautiful that costs less than 200',
    'any scenic spots nearby',
  ],
  'find-food': ['find me cheap food nearby', 'where can I eat', "I'm hungry", 'cheap food', 'something to eat under 200'],
  'rent-scooter': ['rent a scooter', 'I want to hire a bike', 'can I rent a scooter for the day'],
  rest: ['I want to take a nap', 'I need a rest', 'I want to relax here', "I'm exhausted", 'wait here for a while', 'hang around until evening'],
  'ask-cost': [
    'how much is a taxi to panjim',
    'what is the cheapest way to get to anjuna',
    'how much does parasailing cost',
    'is it expensive',
    'cheapest way to palolem',
  ],
  activity: [
    'I want to go swimming',
    'take photos at chapora fort',
    'shopping at the flea market',
    'watch the sunset',
    "let's eat here",
    'ask the shack owner about sunsets',
  ],
  'ask-local': ['ask a local', 'ask a local for help', 'talk to someone for directions', 'ask around for tips'],
  status: ['how much money do I have', "what's my energy", 'what time is it', 'where am I', 'status'],
  'show-quests': ['show my quests', 'what should I do next', 'quests'],
  'show-inventory': ['inventory', "what's in my bag", 'what do I have'],
  'use-item': ['use my tourist map', 'check the map', 'use the camera', 'look at my map'],
  'end-day': ['end the day', 'call it a day', 'go to sleep'],
  cancel: ['cancel', 'never mind', 'forget it', 'scratch that'],
  yes: ['yes', 'sure', 'ok sounds good', 'yeah go ahead'],
  no: ['no', 'no thanks', 'nope', 'not now'],
  help: ['help', 'what can I say', 'how does this work', 'I need help'],
}

describe('every intent', () => {
  for (const [intent, sentences] of Object.entries(EXAMPLES)) {
    it.each(sentences)(`"%s" → ${intent}`, (sentence) => {
      const parsed = parseCommand(sentence)
      expect(parsed.intent).toBe(intent)
      expect(parsed.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
      expect(parsed.alternatives[0].intent).toBe(intent)
    })
  }
})

describe('low confidence counts as unknown', () => {
  it.each(['hello goa', 'banana', 'the weather is nice', ''])('"%s" → unknown', (sentence) => {
    const parsed = parseCommand(sentence)
    expect(parsed.intent).toBe('unknown')
    expect(parsed.confidence).toBeLessThan(MIN_CONFIDENCE)
  })

  it('says unknown when the best guess is weak, but still reports what it considered', () => {
    // "local" alone hints at finding an authentic place, too weakly to act on.
    const parsed = parseCommand('local')
    expect(parsed.intent).toBe('unknown')
    expect(parsed.alternatives[0]).toEqual({ intent: 'find-place', score: 1 })
  })

  it('lowers confidence when two intents are close', () => {
    expect(confidenceFrom(6, 0)).toBeGreaterThan(confidenceFrom(6, 5))
    // A tie between two weak readings is too unsure to act on.
    expect(confidenceFrom(2.5, 2.5)).toBeLessThan(MIN_CONFIDENCE)
  })

  it('is never confident about nothing', () => {
    expect(confidenceFrom(0, 0)).toBe(0)
  })
})

describe('the same words can mean different things', () => {
  it('"cheap" next to food is about food; next to travel it is about cost', () => {
    expect(intentOf('cheap food')).toBe('find-food')
    expect(intentOf('where is the cheapest food')).toBe('find-food')
    expect(intentOf('cheapest way to palolem')).toBe('ask-cost')
    expect(intentOf('what is the cheapest way to get to anjuna')).toBe('ask-cost')
  })

  it('a cheap ride to a named place is still a trip', () => {
    const parsed = parseCommand('a cheap ride to anjuna')
    expect(parsed.intent).toBe('travel')
    expect(parsed.alternatives.map((a) => a.intent)).toContain('ask-cost')
  })

  it('"how much" is a price question, unless it asks what you have', () => {
    expect(intentOf('how much is a taxi to panjim')).toBe('ask-cost')
    expect(intentOf('how much money do I have')).toBe('status')
  })

  it('"relaxing" with a travel verb is a trip; on its own it is resting', () => {
    expect(intentOf('take me somewhere relaxing')).toBe('travel')
    expect(intentOf('I want to relax here')).toBe('rest')
    expect(intentOf('find somewhere relaxing')).toBe('find-place')
  })

  it('"go" with a place is travel; "go swimming" is an activity; "go to sleep" ends the day', () => {
    expect(intentOf('go to anjuna')).toBe('travel')
    expect(intentOf('go swimming')).toBe('activity')
    expect(intentOf('go to sleep')).toBe('end-day')
  })

  it('"eat" when looking is finding food; "eat here" is doing it', () => {
    expect(intentOf('where can I eat')).toBe('find-food')
    expect(intentOf("let's eat here")).toBe('activity')
  })

  it('a scooter to a place is travel; renting one is renting', () => {
    expect(intentOf('take a scooter to anjuna')).toBe('travel')
    expect(intentOf('rent a scooter')).toBe('rent-scooter')
  })

  it('"go back" is cancel on its own, travel with a place', () => {
    expect(intentOf('go back')).toBe('cancel')
    expect(intentOf('go back to baga')).toBe('travel')
  })

  it('"no" inside a longer request is a negation, not an answer', () => {
    expect(intentOf('no')).toBe('no')
    expect(intentOf('a beach with no crowds')).toBe('find-place')
  })

  it('"help" alone asks for help; asking a local for help asks a local', () => {
    expect(intentOf('help')).toBe('help')
    expect(intentOf('ask a local for help')).toBe('ask-local')
  })
})

describe('game context', () => {
  it('a waiting question makes yes and no more certain', () => {
    const free = parseCommand('yes')
    const asked = parseCommand('yes', { pendingQuestion: true })
    expect(asked.intent).toBe('yes')
    expect(asked.confidence).toBeGreaterThan(free.confidence)
    expect(parseCommand('no', { pendingQuestion: true }).confidence).toBeGreaterThan(parseCommand('no').confidence)
  })

  it('an activity fits better where it is on offer', () => {
    const atBeach = parseCommand('swim', { currentLocationId: 'baga' })
    const inTown = parseCommand('swim', { currentLocationId: 'fontainhas' })
    expect(atBeach.intent).toBe('activity')
    expect(atBeach.confidence).toBeGreaterThan(inTown.confidence)
  })

  it('context never changes what was said, only how sure the parser is', () => {
    const a = parseCommand('take me to anjuna')
    const b = parseCommand('take me to anjuna', { currentLocationId: 'palolem', pendingQuestion: true, hasScooterToday: true })
    expect(b.intent).toBe(a.intent)
    expect(b.destination).toBe(a.destination)
  })
})

describe('the result', () => {
  it('lists the top alternatives, highest first', () => {
    const { alternatives } = parseCommand('how much is a taxi to panjim')
    expect(alternatives[0].intent).toBe('ask-cost')
    expect(alternatives.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < alternatives.length; i++) expect(alternatives[i].score).toBeLessThanOrEqual(alternatives[i - 1].score)
  })

  it('keeps confidence between 0 and 1', () => {
    for (const sentence of Object.values(EXAMPLES).flat()) {
      const { confidence } = parseCommand(sentence)
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    }
  })
})
