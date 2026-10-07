import { describe, expect, it } from 'vitest'
import { parseCommand } from '.'
import { describeBudget, describeConstraint } from './describe'
import { editDistance } from './extract'
import { normalize } from './normalize'

/** Only the structured meaning (not raw text or confidence). */
const meaning = (text: string) => {
  const { intent, destination, travelMode, budget, moods, activities, constraints } = parseCommand(text)
  return { intent, destination, travelMode, budget, moods, activities, constraints }
}

describe('the four example sentences', () => {
  it('"I want a beautiful beach that isn\'t too crowded"', () => {
    expect(meaning("I want a beautiful beach that isn't too crowded")).toEqual({
      intent: 'find-place',
      destination: null,
      travelMode: null,
      budget: null,
      moods: ['beautiful'],
      activities: [],
      constraints: [{ kind: 'avoid-crowds' }, { kind: 'place-type', placeType: 'beach' }],
    })
  })

  it('"find me cheap food nearby"', () => {
    expect(meaning('find me cheap food nearby')).toEqual({
      intent: 'find-food',
      destination: null,
      travelMode: null,
      budget: null,
      moods: [],
      activities: ['eat'],
      constraints: [{ kind: 'cheap' }, { kind: 'nearby' }],
    })
  })

  it('"I\'m tired take me somewhere relaxing"', () => {
    expect(meaning("I'm tired take me somewhere relaxing")).toEqual({
      intent: 'travel',
      destination: null,
      travelMode: null,
      budget: null,
      moods: ['relaxing'],
      activities: [],
      constraints: [{ kind: 'tired' }],
    })
  })

  it('"I have 800 rupees left find somewhere beautiful that costs less than 200"', () => {
    expect(meaning('I have 800 rupees left find somewhere beautiful that costs less than 200')).toEqual({
      intent: 'find-place',
      destination: null,
      travelMode: null,
      budget: { maxSpend: 200, approximate: false, moneyLeft: 800 },
      moods: ['beautiful'],
      activities: [],
      constraints: [],
    })
  })

  it('reports how sure it is, and which parser answered', () => {
    const parsed = parseCommand('find me cheap food nearby')
    expect(parsed.parser).toBe('rule-based')
    expect(parsed.confidence).toBeGreaterThan(0.5)
    expect(parseCommand('hello goa').confidence).toBe(0)
  })
})

describe('normalising', () => {
  it.each([
    ["  I'm   TIRED!!  ", 'i am tired'],
    ["isn't", 'is not'],
    ['dont want', 'do not want'], // dictation often drops the apostrophe
    ["I don't want to spend money", 'i do not want to spend money'],
    ["tito's lane", 'tito lane'],
    ['₹200', '200 rupees'],
    ['200rs', '200 rupees'],
    ['Rs. 350', '350 rupees'],
    ['1,500 rupees', '1500 rupees'],
    ['2k', '2000'],
  ])('%j → %j', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })
})

describe('spoken numbers', () => {
  it.each([
    ['two hundred', '200'],
    ['eight hundred rupees', '800 rupees'],
    ['two hundred and fifty', '250'],
    ['fifteen hundred', '1500'],
    ['one thousand five hundred', '1500'],
    ['a thousand', '1000'],
    ['2 hundred', '200'],
    ['forty five', '45'],
    ['twenty', '20'],
  ])('%j → %j', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })

  it('leaves ordinary uses of "a" and "and" alone', () => {
    expect(normalize('a quiet beach and a sunset')).toBe('a quiet beach and a sunset')
  })
})

describe('destinations', () => {
  it.each([
    ['take me to Baga', 'baga'],
    ['go to Panjim', 'fontainhas'],
    ['Panaji please', 'fontainhas'],
    ['ponjim', 'fontainhas'],
    ['the latin quarter', 'fontainhas'],
    ['Chapora Fort', 'vagator'],
    ['ozran beach', 'vagator'],
    ['the flea market', 'anjuna'],
    ['Anjuna flea market', 'anjuna'],
    ['palolem', 'palolem'],
  ])('%j → %s', (input, id) => {
    expect(parseCommand(input).destination).toBe(id)
  })

  it('forgives small dictation slips in long names', () => {
    expect(parseCommand('take me to palolum').destination).toBe('palolem')
    expect(parseCommand('vagatore please').destination).toBe('vagator')
    expect(editDistance('palolum', 'palolem')).toBe(1)
  })

  it('does not see places in ordinary words', () => {
    expect(parseCommand('I have two bags').destination).toBeNull()
    expect(parseCommand('a nice vacation').destination).toBeNull()
  })

  it('picks where you are going, not where you are coming from', () => {
    expect(parseCommand('go from baga to anjuna').destination).toBe('anjuna')
    expect(parseCommand('leave baga and head to vagator').destination).toBe('vagator')
  })

  it('reads travel modes', () => {
    expect(parseCommand('scooter to anjuna').travelMode).toBe('scooter')
    expect(parseCommand('get a cab to panjim').travelMode).toBe('taxi')
    expect(parseCommand('walk to anjuna').travelMode).toBe('walk')
    expect(parseCommand('somewhere within walking distance').travelMode).toBeNull()
  })
})

describe('budgets', () => {
  it.each([
    ['under two hundred rupees', { maxSpend: 200, approximate: false, moneyLeft: null }],
    ['less than 200', { maxSpend: 200, approximate: false, moneyLeft: null }],
    ['around five hundred', { maxSpend: 500, approximate: true, moneyLeft: null }],
    ['about 300 rupees', { maxSpend: 300, approximate: true, moneyLeft: null }],
    ['I have eight hundred rupees left', { maxSpend: null, approximate: false, moneyLeft: 800 }],
    ['only 300 left', { maxSpend: null, approximate: false, moneyLeft: 300 }],
    ['I only have 500 rupees', { maxSpend: null, approximate: false, moneyLeft: 500 }],
    ['250 rupees max', { maxSpend: 250, approximate: false, moneyLeft: null }],
    ['spend up to fifteen hundred', { maxSpend: 1500, approximate: false, moneyLeft: null }],
    ['my budget is 400', { maxSpend: 400, approximate: false, moneyLeft: null }],
    ['₹150 or less', { maxSpend: 150, approximate: false, moneyLeft: null }],
    ["I don't want to spend money", { maxSpend: 0, approximate: false, moneyLeft: null }],
    ['something free', { maxSpend: 0, approximate: false, moneyLeft: null }],
  ])('%j', (input, budget) => {
    expect(parseCommand(input).budget).toEqual(budget)
  })

  it('keeps money left and a spending limit apart in one sentence', () => {
    expect(parseCommand('I have around 900 left, find food under 150').budget).toEqual({
      maxSpend: 150,
      approximate: false,
      moneyLeft: 900,
    })
  })

  it('finds no budget when none is mentioned', () => {
    expect(parseCommand('take me to baga').budget).toBeNull()
    expect(parseCommand('I have two bags').budget).toBeNull()
  })
})

describe('moods', () => {
  it.each([
    ['somewhere beautiful', ['beautiful']],
    ['a scenic spot', ['beautiful']],
    ['somewhere quiet and peaceful', ['quiet']],
    ['something relaxing', ['relaxing']],
    ['a lively party place', ['lively']],
    ['something local and authentic', ['authentic']],
    ['somewhere scenic and quiet', ['beautiful', 'quiet']],
  ])('%j → %j', (input, moods) => {
    expect(parseCommand(input).moods).toEqual(moods)
  })

  it('reads "not touristy" as authentic, and avoiding crowds', () => {
    const parsed = parseCommand('somewhere not touristy')
    expect(parsed.moods).toEqual(['authentic'])
    expect(parsed.constraints).toContainEqual({ kind: 'avoid-crowds' })
  })
})

describe('activities', () => {
  it.each([
    ['I am hungry', ['eat']],
    ['lets get some lunch', ['eat']],
    ['I want to go swimming', ['swim']],
    ['go shopping for souvenirs', ['shop']],
    ['take some photos', ['photo']],
    ['watch the sunset', ['sunset']],
  ])('%j → %j', (input, activities) => {
    expect(parseCommand(input).activities).toEqual(activities)
  })

  it('does not read "before sunset" as the sunset activity', () => {
    const parsed = parseCommand('go to panaji before sunset')
    expect(parsed.activities).toEqual([])
    expect(parsed.constraints).toEqual([{ kind: 'before', minute: 18 * 60 + 30, label: 'sunset' }])
  })
})

describe('negations', () => {
  it.each([
    ['not too crowded', { kind: 'avoid-crowds' }],
    ["a beach that isn't too crowded", { kind: 'avoid-crowds' }],
    ['away from the crowds', { kind: 'avoid-crowds' }],
    ['somewhere less busy', { kind: 'avoid-crowds' }],
    ['quiet, not lively', { kind: 'avoid-mood', mood: 'lively' }],
    ["I don't want to swim", { kind: 'avoid-activity', activity: 'swim' }],
    ["I don't want to spend money", { kind: 'free' }],
    ['nothing expensive', { kind: 'cheap' }],
    ['not too far', { kind: 'nearby' }],
  ])('%j → %j', (input, constraint) => {
    expect(parseCommand(input).constraints).toContainEqual(constraint)
  })

  it('stops a negation at "and"/"but": only the negated part is flipped', () => {
    const parsed = parseCommand('not crowded but beautiful')
    expect(parsed.moods).toEqual(['beautiful'])
    expect(parsed.constraints).toEqual([{ kind: 'avoid-crowds' }])
  })

  it('treats a crowd word on its own as wanting somewhere lively', () => {
    expect(parseCommand('somewhere busy').moods).toEqual(['lively'])
  })
})

describe('other constraints', () => {
  it('reads time limits', () => {
    expect(parseCommand('before 6').constraints).toEqual([{ kind: 'before', minute: 18 * 60, label: '6 PM' }])
    expect(parseCommand('by 10 am').constraints).toEqual([{ kind: 'before', minute: 10 * 60, label: '10 AM' }])
  })

  it('does not repeat the place type when a place is named', () => {
    expect(parseCommand('palolem beach').constraints).toEqual([])
  })
})

describe('describing the result for the voice panel', () => {
  it('describes budgets in plain words', () => {
    expect(describeBudget({ maxSpend: 200, approximate: false, moneyLeft: 800 })).toBe('under ₹200 · ₹800 left')
    expect(describeBudget({ maxSpend: 500, approximate: true, moneyLeft: null })).toBe('around ₹500')
    expect(describeBudget({ maxSpend: 0, approximate: false, moneyLeft: null })).toBe('spend nothing')
  })

  it('describes constraints in plain words', () => {
    expect(describeConstraint({ kind: 'avoid-crowds' })).toBe('not crowded')
    expect(describeConstraint({ kind: 'before', minute: 18 * 60 + 30, label: 'sunset' })).toBe('before sunset (6:30 PM)')
    expect(describeConstraint({ kind: 'place-type', placeType: 'beach' })).toBe('a beach')
  })
})
