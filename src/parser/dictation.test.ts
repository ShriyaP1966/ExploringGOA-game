import { describe, expect, it } from 'vitest'
import { parseCommand } from '.'
import { mapCommand, type MappedCommand } from '../engine/actionMapper'
import { createInitialState } from '../engine/initialState'
import { gameReducer } from '../engine/reducer'
import type { CommandIntent, GameState } from '../types'
import { editDistance } from './extract'

/**
 * A sweep of sentences the way people dictate them (Wispr Flow): fillers, different phrasings,
 * spoken numbers and small typos. Each one is checked through the parser AND the mapper.
 */

const context = (s: GameState) => ({
  currentLocationId: s.currentLocationId,
  pendingQuestion: s.activeEvent !== null || s.pendingHelp !== null,
})
const day1 = gameReducer(createInitialState(), { type: 'BEGIN_DAY' })
const proposal = gameReducer(day1, { type: 'COMMAND', command: parseCommand('find somewhere beautiful', context(day1)) })
const breakdown = gameReducer(day1, { type: 'FORCE_EVENT', eventId: 'scooter-trouble' })

/** What the mapper did, in one comparable line: "TRAVEL:anjuna", "answer: …", "refuse: …". */
function outcome(m: MappedCommand): string {
  if (m.kind === 'actions') {
    return m.actions
      .map((a) => [a.type, 'to' in a ? a.to : '', 'activityId' in a ? a.activityId : '', 'choiceId' in a ? a.choiceId : ''].filter(Boolean).join(':'))
      .join(',')
  }
  return `${m.kind}: ${m.kind === 'answer' ? m.text : m.reason}`
}

interface Case {
  text: string
  /** Expected intent; 'unknown' is fine for event answers, which are matched to a choice instead. */
  intent: CommandIntent
  /** What the mapper should do with it. */
  maps: RegExp
  state?: GameState
}

const CASES: Case[] = [
  // travel
  { text: 'um can you take me to anjuna please', intent: 'travel', maps: /^TRAVEL:anjuna$/ },
  { text: "let's head over to vagator beach", intent: 'travel', maps: /^TRAVEL:vagator$/ },
  { text: 'I wanna go to panjim by taxi', intent: 'travel', maps: /^TRAVEL:fontainhas$/ },
  { text: 'take me to fontainhas, uh, the latin quarter', intent: 'travel', maps: /^TRAVEL:fontainhas$/ },
  { text: 'tke me to anjna', intent: 'travel', maps: /^TRAVEL:anjuna$/ },
  { text: 'so like I need to get to vagator before sunset', intent: 'travel', maps: /^TRAVEL:vagator$/ },
  // find-place
  { text: "I'm looking for a quiet beach, somewhere not too crowded", intent: 'find-place', maps: /^answer: I'd go to .*quiet/ },
  { text: 'can you find me somewhere pretty that costs under two hundred rupees', intent: 'find-place', maps: /^answer: I'd go to / },
  { text: 'where should I go for a nice view', intent: 'find-place', maps: /^answer: I'd go to / },
  { text: 'suggest somewhere fun for the afternoon', intent: 'find-place', maps: /^answer: I'd go to .*lively/ },
  // find-food
  { text: "uh I'm kinda hungry, where can I get something to eat", intent: 'find-food', maps: /^answer: Right here at Baga Beach/ },
  { text: 'find me some cheap seafood under three hundred', intent: 'find-food', maps: /^answer: No food you can get right now fits/ },
  { text: "I'm starving lol", intent: 'find-food', maps: /^answer: Right here at Baga Beach/ },
  { text: 'were can i eat', intent: 'find-food', maps: /^answer: Right here at Baga Beach/ },
  // rent-scooter
  { text: "I'd like to rent a scooty for the day", intent: 'rent-scooter', maps: /^RENT_SCOOTER$/ },
  { text: 'can I hire a two wheeler', intent: 'rent-scooter', maps: /^RENT_SCOOTER$/ },
  { text: 'get me a scooter', intent: 'rent-scooter', maps: /^RENT_SCOOTER$/ },
  // rest
  { text: "I'm so tired I just wanna chill for a bit", intent: 'rest', maps: /^REST$/ },
  { text: 'let me take a quick nap', intent: 'rest', maps: /^REST$/ },
  { text: 'I need to sit down and rest my legs', intent: 'rest', maps: /^REST$/ },
  // ask-cost
  { text: 'how much would a taxi to panjim cost', intent: 'ask-cost', maps: /^answer: To Fontainhas, Panaji \(16 km\)/ },
  { text: "what's the cheapest way to get to vagator", intent: 'ask-cost', maps: /^answer: To Vagator & Chapora Fort/ },
  { text: 'is the parasailing expensive', intent: 'ask-cost', maps: /^answer: 🪂 Go parasailing: ₹1,200$/ },
  { text: 'how much is it to go to anjuna by scooter', intent: 'ask-cost', maps: /^answer: To Anjuna/ },
  // activity
  { text: 'I wanna go swimming', intent: 'activity', maps: /^DO_ACTIVITY:baga-swim$/ },
  { text: "let's go parasailing", intent: 'activity', maps: /^DO_ACTIVITY:baga-parasailing$/ },
  { text: 'can I take some pictures here', intent: 'activity', maps: /^refuse: .*photo walk is at Vagator/ },
  { text: 'I want to look for shells on the beach', intent: 'activity', maps: /^DO_ACTIVITY:baga-beachcomb$/ },
  // ask-local
  { text: "maybe I'll ask one of the locals for tips", intent: 'ask-local', maps: /^ASK_LOCAL$/ },
  { text: 'talk to someone around here', intent: 'ask-local', maps: /^ASK_LOCAL$/ },
  // status
  { text: 'how much money have I got left', intent: 'status', maps: /^answer: .*₹5,000/ },
  { text: 'uh what time is it now', intent: 'status', maps: /^answer: .*9:00 AM/ },
  { text: 'how much energy do I have', intent: 'status', maps: /^answer: .*⚡ 100/ },
  { text: 'how am I doing', intent: 'status', maps: /^answer: 📍/ },
  // show-quests
  { text: 'what are my quests', intent: 'show-quests', maps: /^answer: 🌅 The Lost Sunset/ },
  { text: 'what should I be doing', intent: 'show-quests', maps: /^answer: 🌅 The Lost Sunset/ },
  { text: "what's my mission", intent: 'show-quests', maps: /^answer: 🌅 The Lost Sunset/ },
  // show-inventory
  { text: "what's in my backpack", intent: 'show-inventory', maps: /^answer: 🎒/ },
  { text: 'show me my stuff', intent: 'show-inventory', maps: /^answer: 🎒/ },
  // use-item
  { text: 'um can I use my tourist map', intent: 'use-item', maps: /^USE_ITEM$/ },
  { text: 'check the map for hidden places', intent: 'use-item', maps: /^USE_ITEM$/ },
  // end-day
  { text: "okay I'm done for today", intent: 'end-day', maps: /^END_DAY$/ },
  { text: "let's call it a night", intent: 'end-day', maps: /^END_DAY$/ },
  // cancel, yes, no: answering the game's proposal
  { text: 'actually never mind', intent: 'cancel', maps: /^answer: OK, dropped/, state: proposal },
  { text: 'wait cancel that', intent: 'cancel', maps: /^answer: OK, dropped/, state: proposal },
  { text: "yeah sure let's do it", intent: 'yes', maps: /^TRAVEL:/, state: proposal },
  { text: 'yep sounds great', intent: 'yes', maps: /^TRAVEL:/, state: proposal },
  { text: 'okay go for it', intent: 'yes', maps: /^TRAVEL:/, state: proposal },
  { text: "nah I'm good", intent: 'no', maps: /^answer: OK, dropped/, state: proposal },
  { text: 'no thank you', intent: 'no', maps: /^answer: OK, dropped/, state: proposal },
  // help
  { text: 'uh what can I say here', intent: 'help', maps: /^answer: 🗺️ Getting around/ },
  { text: "I'm confused, how does this work", intent: 'help', maps: /^answer: 🗺️ Getting around/ },
  // answering an event popup
  { text: "hmm I guess I'll just push it to the garage", intent: 'unknown', maps: /^CHOOSE_EVENT_OPTION:push$/, state: breakdown },
  { text: 'eh just pay the guy', intent: 'unknown', maps: /^CHOOSE_EVENT_OPTION:mechanic$/, state: breakdown },
]

describe('dictation sweep', () => {
  it.each(CASES.map((c) => [c.text, c] as const))('"%s"', (_text, c) => {
    const state = c.state ?? day1
    const parsed = parseCommand(c.text, context(state))
    if (c.intent !== 'unknown') expect(parsed.intent).toBe(c.intent)
    expect(outcome(mapCommand(state, parsed))).toMatch(c.maps)
  })

  it('covers every intent', () => {
    const covered = new Set(CASES.map((c) => c.intent))
    const all: CommandIntent[] = [
      'travel', 'find-place', 'find-food', 'rent-scooter', 'rest', 'ask-cost', 'activity', 'ask-local', 'status',
      'show-quests', 'show-inventory', 'use-item', 'end-day', 'cancel', 'yes', 'no', 'help',
    ]
    expect(all.filter((i) => !covered.has(i))).toEqual([])
  })
})

describe('what the sweep fixed', () => {
  it('reads 5-letter slips of 6-letter names, but no ordinary words', () => {
    expect(parseCommand('go to anjna').destination).toBe('anjuna')
    expect(parseCommand('go to panji').destination).toBe('fontainhas')
    for (const word of ['panic', 'angle', 'again', 'plane', 'ozone', 'banjo', 'jungle']) {
      expect(parseCommand(`I ${word}`).destination).toBeNull()
    }
    expect(editDistance('anjna', 'anjuna')).toBe(1)
  })

  it('fixes common typing slips', () => {
    expect(parseCommand('waht time is it').intent).toBe('status')
    expect(parseCommand('wher can i eat pls').intent).toBe('find-food')
  })

  it('only takes yes/no from a longer reply made of reply words', () => {
    expect(parseCommand('yeah sure let us do it').intent).toBe('yes')
    expect(parseCommand('yeah take me to anjuna').intent).toBe('travel')
  })

  it('names activities by their own words, and says where they are', () => {
    expect(outcome(mapCommand(day1, parseCommand('I want to go kayaking', context(day1))))).toMatch(/^refuse: /)
    const hammock = parseCommand('lie in a hammock', context(day1))
    expect(hammock.intent).toBe('activity')
    // Palolem is still hidden on Day 1, so it isn't given away.
    expect(outcome(mapCommand(day1, hammock))).not.toMatch(/Palolem/)
  })

  it('a price question about an activity never starts it', () => {
    for (const text of ['how much is parasailing', 'is the parasailing expensive', 'what does parasailing cost']) {
      expect(outcome(mapCommand(day1, parseCommand(text, context(day1))))).toMatch(/^answer: 🪂 Go parasailing: ₹1,200/)
    }
  })

  it('"take pictures" never books a paid activity just because it makes a memory', () => {
    expect(outcome(mapCommand(day1, parseCommand('take some photos', context(day1))))).not.toMatch(/parasailing/)
  })
})
