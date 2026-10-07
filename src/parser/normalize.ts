/**
 * Step 1 of understanding: turn whatever was typed or dictated into tidy, predictable text.
 * Lower case, contractions expanded, money symbols as "rupees", spoken numbers as digits.
 */

const CONTRACTIONS: Record<string, string> = {
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "i'm": 'i am',
  "i've": 'i have',
  "i'd": 'i would',
  "i'll": 'i will',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "there's": 'there is',
  "let's": 'let us',
  "you're": 'you are',
  "we're": 'we are',
  // Dictation and fast typing often drop the apostrophe.
  isnt: 'is not',
  arent: 'are not',
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  cant: 'can not',
  im: 'i am',
  ive: 'i have',
  lets: 'let us',
  wanna: 'want to',
  gonna: 'going to',
  gotta: 'got to',
  kinda: 'kind of',
  gimme: 'give me',
  lemme: 'let me',
  // Common typing slips.
  tke: 'take',
  taek: 'take',
  teh: 'the',
  wher: 'where',
  whre: 'where',
  waht: 'what',
  wat: 'what',
  hw: 'how',
  pls: 'please',
  plz: 'please',
  u: 'you',
  ur: 'your',
  thx: 'thanks',
}

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, lac: 100000 }

const isDigits = (t: string) => /^\d+$/.test(t)

/**
 * Replaces spoken numbers with digits: "two hundred and fifty" → "250", "fifteen hundred" → "1500",
 * "a thousand" → "1000", "2 hundred" → "200". Other words are left alone.
 */
export function spokenNumbersToDigits(tokens: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    const next = tokens[i + 1]
    // A number starts with a unit word ("two"), or with "a"/"an"/digits right before a scale ("a thousand", "2 hundred").
    const startsNumber = t in UNITS || ((t === 'a' || t === 'an' || isDigits(t)) && next !== undefined && next in SCALES)
    if (!startsNumber) {
      out.push(t)
      i++
      continue
    }

    let total = 0
    let current = 0
    // "2 hundred": a digit followed by a scale word.
    if (isDigits(t) || t === 'a' || t === 'an') {
      current = isDigits(t) ? Number(t) : 1
      i++
    }
    while (i < tokens.length) {
      const w = tokens[i]
      if (w in UNITS) {
        current += UNITS[w]
      } else if (w === 'hundred') {
        current = (current || 1) * 100
      } else if (w in SCALES) {
        total += (current || 1) * SCALES[w]
        current = 0
      } else if (w === 'and' && tokens[i + 1] !== undefined && tokens[i + 1] in UNITS) {
        // "two hundred and fifty"
      } else {
        break
      }
      i++
    }
    out.push(String(total + current))
  }
  return out
}

/** Lower case, expand contractions, money symbols → "rupees", numbers → digits, no punctuation. */
export function normalize(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/[‘’´`]/g, "'")
    .replace(/(\d),(\d)/g, '$1$2') // 1,500 → 1500
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n: string) => String(Math.round(Number(n) * 1000))) // 2k → 2000
    .replace(/₹\s*(\d+)/g, '$1 rupees')
    .replace(/(\d+)\s*(?:rs\.?|inr|₹|bucks|rupee)(?=\s|$|[^a-z])/g, '$1 rupees')
    .replace(/\b(?:rs\.?|inr)\s*(\d+)/g, '$1 rupees')

  s = s
    .split(/\s+/)
    .map((word) => CONTRACTIONS[word] ?? word)
    .join(' ')

  s = s
    .replace(/'s\b/g, '') // possessives: "tito's" → "tito"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return spokenNumbersToDigits(s.split(' ').filter(Boolean)).join(' ')
}
