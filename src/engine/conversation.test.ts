import { describe, expect, it } from 'vitest'
import { VoicePanelBoundary } from '../components/voice/VoicePanelBoundary'
import { MAX_COMMAND_LENGTH, parseCommand } from '../parser'
import type { CommandRecord, GameAction, GameState } from '../types'
import { advanceTime } from './clock'
import { didNotCatch, helpText, matchEventChoice, situationalSuggestions } from './conversation'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const say = (state: GameState, text: string) =>
  gameReducer(state, {
    type: 'COMMAND',
    command: parseCommand(text, {
      currentLocationId: state.currentLocationId,
      pendingQuestion: state.activeEvent !== null || state.pendingHelp !== null,
    }),
  })
const last = (state: GameState): CommandRecord => state.commandLog[state.commandLog.length - 1]
const day1 = () => run(createInitialState(), { type: 'BEGIN_DAY' })
const withMoney = (s: GameState, money: number): GameState => ({ ...s, player: { ...s.player, money } })
const breakdown = () => run(day1(), { type: 'FORCE_EVENT', eventId: 'scooter-trouble' })
const rain = () => run(day1(), { type: 'FORCE_EVENT', eventId: 'sudden-shower' })

describe('answering an event by speaking naturally', () => {
  it('"I\'ll ask someone nearby but I don\'t want to spend money" picks the free help', () => {
    const before = breakdown()
    const after = say(before, "I'll ask someone nearby but I don't want to spend money")
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['CHOOSE_EVENT_OPTION'] })
    expect(after.eventLog[0].choiceId).toBe('ask-local')
    expect(after.player.money).toBe(before.player.money)
  })

  it('"just pay for the mechanic" picks the paid option', () => {
    const before = breakdown()
    const after = say(before, 'just pay for the mechanic')
    expect(after.eventLog[0].choiceId).toBe('mechanic')
    expect(after.player.money).toBe(before.player.money - 600)
  })

  it('a negated option counts against it', () => {
    const after = say(breakdown(), "I don't want to pay the mechanic, I'll push it")
    expect(after.eventLog[0].choiceId).toBe('push')
  })

  it('"no money" rules out the paid choice even without naming another', () => {
    const match = matchEventChoice(breakdown(), parseCommand('fix it somehow but without spending money'))
    expect(match.kind === 'match' && match.choice.id).not.toBe('mechanic')
  })

  it('a matched choice still follows its rules', () => {
    const before = withMoney(breakdown(), 300)
    const after = say(before, 'pay the mechanic')
    expect(last(after).outcome).toBe('refused')
    expect(last(after).result).toMatch(/You need ₹600 for the mechanic/)
    expect(after.activeEvent).not.toBeNull()
  })

  it('asks which one when two choices are equally close', () => {
    const after = say(rain(), 'raincoat')
    expect(last(after)).toMatchObject({ outcome: 'refused' })
    expect(last(after).result).toMatch(/^Sorry, did you mean ".+" or ".+"\?$/)
  })

  it('refuses politely when nothing matches, listing what you can say', () => {
    const after = say(breakdown(), 'banana')
    expect(last(after).outcome).toBe('refused')
    expect(last(after).result).toMatch(/^Sorry, I couldn't match that to what's happening \(🛵💨 Scooter breakdown\)\. You can say "pay a roadside mechanic"/)
    expect(after.activeEvent).not.toBeNull()
  })

  it('"no" picks the decline option when the event has one', () => {
    const offer = run(day1(), { type: 'FORCE_EVENT', eventId: 'friendly-local' })
    expect(say(offer, 'no thanks').eventLog[0].choiceId).toBe('decline')
  })
})

describe('proposals: yes confirms, no or cancel drops, anything else replaces', () => {
  const proposed = () => say(day1(), 'find somewhere beautiful')

  it('yes confirms it', () => {
    const after = say(proposed(), 'yes')
    expect(last(after).outcome).toBe('success')
    expect(after.currentLocationId).not.toBe('baga')
  })

  it.each(['no', 'cancel', 'never mind'])('"%s" drops it, and says what was dropped', (word) => {
    const dropped = say(proposed(), word)
    expect(last(dropped)).toMatchObject({ outcome: 'answered', suggestion: null })
    expect(last(dropped).result).toMatch(/^OK, dropped: I won't take you to /)
    expect(last(say(dropped, 'yes')).result).toBe('There is nothing waiting for a yes right now.')
  })

  it('an unrelated command replaces it', () => {
    const replaced = say(proposed(), 'how much money do I have')
    expect(last(say(replaced, 'yes')).result).toBe('There is nothing waiting for a yes right now.')
  })

  it('a new proposal replaces the old one', () => {
    const food = say(proposed(), 'find me food')
    const after = say(food, 'yes')
    expect(last(after).actions).toEqual(['DO_ACTIVITY']) // the shack dinner, not the beautiful place
  })

  it('a local’s offer lapses politely when you do something else', () => {
    const offered = { ...day1(), pendingHelp: { kind: 'chai' as const } }
    const after = say(offered, 'take me to anjuna')
    expect(last(after)).toMatchObject({ outcome: 'success', actions: ['DECLINE_HELP', 'TRAVEL'] })
    expect(last(after).result).toMatch(/You leave the local's offer/)
    expect(after.pendingHelp).toBeNull()
    expect(after.currentLocationId).toBe('anjuna')
  })

  it('but questions do not make the offer lapse', () => {
    const offered = { ...day1(), pendingHelp: { kind: 'chai' as const } }
    expect(say(offered, 'how much money do I have').pendingHelp).toEqual({ kind: 'chai' })
  })
})

describe('the unclear-command fallback', () => {
  it('says it did not catch that and suggests two or three things to say', () => {
    const record = last(say(day1(), 'blorp the flimflam'))
    expect(record.outcome).toBe('not-understood')
    expect(record.result).toMatch(/^I didn't quite catch that\. You could say "[^"]+"(, "[^"]+")?( or "[^"]+")?\.$/)
    const quoted = record.result.match(/"[^"]+"/g) ?? []
    expect(quoted.length).toBeGreaterThanOrEqual(2)
    expect(quoted.length).toBeLessThanOrEqual(3)
  })

  it('fits the situation', () => {
    expect(situationalSuggestions(createInitialState())).toContain('start the day')
    expect(situationalSuggestions(breakdown())).toContain('pay a roadside mechanic')
    expect(situationalSuggestions({ ...day1(), pendingHelp: { kind: 'chai' } })).toEqual(['yes please', 'no thanks'])
    // The Lost Sunset's first step is at Baga.
    expect(situationalSuggestions(day1())).toContain('ask the shack owner about sunsets')
    const tired = { ...day1(), player: { ...day1().player, energy: 20 } }
    expect(situationalSuggestions(tired)).toContain('I need a rest')
  })

  it('works on the day intro too, while start still starts', () => {
    const intro = createInitialState()
    expect(last(say(intro, 'blorp')).result).toMatch(/^I didn't quite catch that\. You could say "start the day"/)
    expect(last(say(intro, 'help')).result).toMatch(/Right now you could say "start the day"/)
    expect(last(say(intro, 'take me to anjuna')).result).toMatch(/hasn't started yet/)
    expect(say(intro, 'go').phase).toBe('playing')
  })

  it('offers yes and no when something is proposed', () => {
    expect(didNotCatch(day1(), { kind: 'travel', locationId: 'anjuna' })).toMatch(/"yes", "no, don't go to Anjuna"/)
  })

  it('never suggests more than three things', () => {
    for (const state of [day1(), breakdown(), rain(), advanceTime(day1(), 6 * 60)]) {
      const ideas = situationalSuggestions(state)
      expect(ideas.length).toBeGreaterThanOrEqual(1)
      expect(ideas.length).toBeLessThanOrEqual(3)
    }
  })
})

describe('awkward input never crashes', () => {
  const ugly = [
    '',
    '   ',
    'asdkjh qwelkj zzz',
    '12345',
    '🌴🌴🌴',
    '<script>alert(1)</script>',
    "'; DROP TABLE trips; --",
    'take me to the moon',
    'teleport to palolem',
    'buy a house in goa',
    'go go go go go go go go',
    'x'.repeat(10_000),
    'take me to anjuna '.repeat(500),
  ]

  it.each(ugly.map((t) => [t.length > 40 ? `${t.slice(0, 40)}… (${t.length} chars)` : JSON.stringify(t), t]))(
    '%s',
    (_label, text) => {
      const before = day1()
      expect(() => parseCommand(text)).not.toThrow()
      const after = say(before, text)
      const record = last(after)
      expect(['success', 'refused', 'answered', 'not-understood']).toContain(record.outcome)
      expect(record.result.length).toBeGreaterThan(0)
    },
  )

  it('handles impossible requests with a clear answer and no change', () => {
    for (const text of ['take me to the moon', 'teleport to palolem', 'buy a house in goa']) {
      const before = day1()
      const after = say(before, text)
      expect(['refused', 'not-understood', 'answered']).toContain(last(after).outcome)
      expect(after.player).toEqual(before.player)
      expect(after.currentLocationId).toBe('baga')
    }
  })

  it('shortens very long input, keeping a marker', () => {
    const parsed = parseCommand('a'.repeat(MAX_COMMAND_LENGTH + 100))
    expect(parsed.raw.length).toBe(MAX_COMMAND_LENGTH + 1)
    expect(parsed.raw.endsWith('…')).toBe(true)
  })

  it('still understands a long sentence that starts with a real request', () => {
    expect(parseCommand(`take me to anjuna ${'please '.repeat(200)}`).destination).toBe('anjuna')
  })

  it('treats non-text input as nothing understood', () => {
    expect(parseCommand(undefined as unknown as string).intent).toBe('unknown')
  })
})

describe('help', () => {
  it('lists example phrases by purpose, and what fits right now', () => {
    const record = last(say(day1(), 'help'))
    expect(record.outcome).toBe('answered')
    for (const part of ['Getting around', 'Finding things', 'Doing things', 'Checking', 'Answering', 'Right now you could say']) {
      expect(record.result).toContain(part)
    }
    expect(helpText(day1())).toMatch(/"take me to Anjuna"/)
  })
})

describe('the voice panel error boundary', () => {
  it('switches to its fallback when the panel throws', () => {
    expect(VoicePanelBoundary.getDerivedStateFromError()).toEqual({ hasError: true })
  })
})
