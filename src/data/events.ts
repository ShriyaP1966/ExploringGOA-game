import type { RandomEvent } from '../types'

/**
 * Random events. Each one can only fire when all its conditions are true in the real game state,
 * then rolls its probability (seeded, see engine/random.ts). At most one fires per trip or activity.
 */
export const EVENTS: RandomEvent[] = [
  {
    id: 'scooter-trouble',
    title: 'Scooter breakdown',
    emoji: '🛵💨',
    situation:
      'Just outside {place}, the scooter coughs, splutters and dies. A thin wisp of smoke curls up from the engine and the sun is beating down.',
    conditions: [
      { type: 'after', trigger: 'trip' },
      { type: 'trip-mode', mode: 'scooter' },
      // Only long rides strain these rental scooters.
      { type: 'trip-distance-at-least', km: 15 },
    ],
    probability: 0.4,
    cooldownMinutes: 24 * 60,
    choices: [
      {
        id: 'mechanic',
        label: 'Pay a roadside mechanic (₹600)',
        keywords: ['mechanic', 'pay', 'pay for', 'fix', 'repair', 'paid'],
        requires: { type: 'money-at-least', amount: 600 },
        unavailableReason: 'You need ₹600 for the mechanic.',
        outcome: {
          message: '🔧 A mechanic on a bicycle appears within minutes, tightens something and grins. Back on the road.',
          cost: 600,
          minutes: 30,
          energyDelta: -5,
          xp: 10,
        },
      },
      {
        id: 'push',
        label: 'Push it to a garage nearby',
        keywords: ['push', 'push it', 'walk it', 'garage'],
        outcome: {
          message: '😓 You push the scooter for what feels like forever. The garage fixes it for free out of pity.',
          minutes: 60,
          energyDelta: -20,
          xp: 15,
        },
      },
      {
        id: 'ask-local',
        label: 'Ask a local for help',
        keywords: ['local', 'locals', 'help', 'ask', 'someone', 'somebody', 'nearby', 'stranger', 'people'],
        outcome: {
          message: '🙋 A fruit seller calls her cousin, who arrives, laughs, and fixes it. It takes ages, but costs nothing.',
          minutes: 90,
          xp: 20,
        },
      },
    ],
  },
  {
    id: 'friendly-local',
    title: 'A local offers help',
    emoji: '🙋',
    situation:
      'A shopkeeper in {place} has been watching you. "You look like you have had a day," she says. "Can I help? I know every corner of Goa, and my brother has a car."',
    conditions: [
      { type: 'any', conditions: [{ type: 'after', trigger: 'trip' }, { type: 'after', trigger: 'activity' }] },
      // Right after a breakdown, or when money is running low.
      {
        type: 'any',
        conditions: [
          { type: 'event-recently', eventId: 'scooter-trouble', withinMinutes: 4 * 60 },
          { type: 'money-at-most', amount: 1000 },
        ],
      },
      { type: 'time-between', from: 9 * 60, to: 20 * 60 },
    ],
    probability: 0.6,
    cooldownMinutes: 24 * 60,
    choices: [
      {
        id: 'hidden-beach',
        label: 'Ask about places tourists never find',
        keywords: ['hidden', 'secret', 'places', 'beach'],
        requires: { type: 'lacks-clue', clueId: 'palolem-clue' },
        unavailableReason: 'You already know about the hidden beach.',
        outcome: {
          message:
            '🏝️ She leans in: "Palolem. Far south, a calm bay, coloured huts, no crowds." She draws it on your map. A new place appears!',
          clueId: 'palolem-clue',
          minutes: 20,
          xp: 20,
        },
      },
      {
        id: 'chai',
        label: 'Accept a cup of chai and a snack',
        keywords: ['chai', 'tea', 'snack', 'food', 'free'],
        outcome: {
          message: '☕ Sweet chai and a warm samosa, on the house. You feel human again.',
          energyDelta: 20,
          minutes: 20,
          xp: 10,
        },
      },
      {
        id: 'ride',
        label: "Accept a ride in her brother's car",
        keywords: ['ride', 'car', 'lift', 'drive'],
        outcome: {
          message: '🚗 Her brother drives you to the next place you know, singing along to the radio the whole way. Free.',
          freeRide: true,
          xp: 10,
        },
      },
      {
        id: 'decline',
        label: 'Thank her and decline',
        keywords: ['no', 'decline', 'thanks'],
        outcome: { message: 'You thank her warmly and carry on alone.' },
      },
    ],
  },
  {
    id: 'sudden-shower',
    title: 'Unexpected rain',
    emoji: '🌧️',
    situation:
      'The sky over {place} turns grey in minutes and a warm pre-monsoon downpour hammers the sand. Everyone runs for cover, laughing.',
    conditions: [
      { type: 'any', conditions: [{ type: 'after', trigger: 'trip' }, { type: 'after', trigger: 'activity' }] },
      // Afternoon storms, and only out in the open: beaches and cliffs, not the town.
      { type: 'time-between', from: 13 * 60, to: 17 * 60 },
      { type: 'location-in', locationIds: ['baga', 'anjuna', 'vagator', 'palolem'] },
    ],
    probability: 0.35,
    cooldownMinutes: 24 * 60,
    choices: [
      {
        id: 'wait',
        label: 'Shelter in a beach bar and wait it out',
        keywords: ['wait', 'shelter', 'bar', 'stay'],
        outcome: {
          message: '🍹 You squeeze into a tiny bar with half the beach. By the time the rain stops, everyone is dancing.',
          minutes: 60,
          xp: 5,
        },
      },
      {
        id: 'buy-raincoat',
        label: 'Buy a raincoat from a stall (₹200)',
        keywords: ['buy', 'raincoat', 'poncho', 'coat'],
        requires: {
          type: 'all',
          conditions: [{ type: 'money-at-least', amount: 200 }, { type: 'not', condition: { type: 'has-item', itemId: 'raincoat' } }],
        },
        unavailableReason: 'You need ₹200, and only one raincoat.',
        outcome: {
          message: '🧥 A quick-thinking vendor sells you a bright plastic poncho. You look ridiculous, but you are dry.',
          cost: 200,
          minutes: 10,
          giveItemId: 'raincoat',
          xp: 5,
        },
      },
      {
        id: 'wear-raincoat',
        label: 'Put on your raincoat',
        keywords: ['wear', 'raincoat', 'poncho', 'coat'],
        requires: { type: 'has-item', itemId: 'raincoat' },
        unavailableReason: 'You do not have a raincoat.',
        outcome: {
          message: '🧥 You pull on your raincoat and stroll on while everyone else hides. Smug and dry.',
          minutes: 5,
          xp: 10,
        },
      },
      {
        id: 'continue',
        label: 'Carry on regardless and get soaked',
        keywords: ['continue', 'carry on', 'soaked', 'keep going'],
        outcome: {
          message: '💦 You splash on through the rain, completely drenched. Strangers cheer you on from under the awnings.',
          energyDelta: -15,
          xp: 10,
        },
      },
    ],
  },
  {
    id: 'food-stall',
    title: 'Food stall discovery',
    emoji: '🍢',
    situation:
      'Just off the main road in {place}, the smell of frying hits you: a tiny family stall with three plastic stools and a queue of locals. Your stomach rumbles.',
    conditions: [
      { type: 'any', conditions: [{ type: 'after', trigger: 'trip' }, { type: 'after', trigger: 'activity' }] },
      // Near a town (Anjuna's market village, Panaji's Fontainhas)...
      { type: 'location-in', locationIds: ['anjuna', 'fontainhas'] },
      // ...when you are getting tired, or it's lunchtime.
      {
        type: 'any',
        conditions: [
          { type: 'energy-at-most', amount: 50 },
          { type: 'time-between', from: 12 * 60, to: 14 * 60 },
        ],
      },
      { type: 'time-between', from: 9 * 60, to: 21 * 60 },
    ],
    probability: 0.5,
    cooldownMinutes: 24 * 60,
    choices: [
      {
        id: 'eat',
        label: 'Sit down for a plate of fish curry rice (₹120)',
        keywords: ['eat', 'meal', 'curry', 'food', 'sit'],
        requires: { type: 'money-at-least', amount: 120 },
        unavailableReason: 'You need ₹120 for the meal.',
        outcome: {
          message: '🍛 Fiery fish curry, red rice and a crisp fried mackerel, for less than a coffee back home. The best meal of the trip.',
          cost: 120,
          energyDelta: 30,
          minutes: 30,
          xp: 10,
        },
      },
      {
        id: 'taste',
        label: 'Accept the free taste the auntie offers',
        keywords: ['taste', 'free', 'sample', 'try'],
        outcome: {
          message: '🥟 She presses a hot bhaji into your hand and refuses your money.',
          energyDelta: 8,
          minutes: 10,
        },
      },
      {
        id: 'decline',
        label: 'Keep walking',
        keywords: ['no', 'walk', 'decline', 'keep walking'],
        outcome: { message: 'You walk on, stomach rumbling.' },
      },
    ],
  },
]
