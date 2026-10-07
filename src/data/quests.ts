import type { Quest } from '../types'

const SUNSET = 18 * 60 + 30
/** The last moment you can still start watching the sunset (matches the sunset activity window). */
const LAST_LIGHT = 18 * 60 + 45

/** All quests. The engine (engine/quests.ts) starts, advances, completes and fails them automatically. */
export const QUESTS: Quest[] = [
  {
    id: 'lost-sunset',
    title: 'The Lost Sunset',
    emoji: '🌅',
    objective: 'Find out where to see the best sunset in Goa, and be there in time to watch it.',
    requirements: [{ type: 'day-is', day: 1 }],
    steps: [
      {
        id: 'ask-shack-owner',
        description: 'Ask the shack owner at Baga where to find the best sunset in Goa',
        completeWhen: { type: 'has-clue', clueId: 'sunset-clue' },
      },
      {
        id: 'reach-vagator',
        description: 'Reach Vagator before sunset (6:30 PM) with at least ⚡20 energy left',
        completeWhen: {
          type: 'all',
          conditions: [
            { type: 'on-attempt-day' },
            { type: 'at-location', locationId: 'vagator' },
            { type: 'time-before', minute: SUNSET },
            { type: 'energy-at-least', amount: 20 },
          ],
        },
        resetOnRetry: true,
      },
      {
        id: 'watch-sunset',
        description: 'Watch the sunset over Ozran Beach',
        completeWhen: { type: 'activity-done-today', activityId: 'vagator-ozran-sunset' },
        resetOnRetry: true,
      },
    ],
    // The sun sets before you arrive, the light is gone before you watch, or the day ends.
    failWhen: {
      type: 'any',
      conditions: [
        { type: 'all', conditions: [{ type: 'time-after', minute: SUNSET }, { type: 'step-incomplete', stepId: 'reach-vagator' }] },
        { type: 'all', conditions: [{ type: 'time-after', minute: LAST_LIGHT }, { type: 'step-incomplete', stepId: 'watch-sunset' }] },
        { type: 'day-ending' },
        { type: 'after-attempt-day' },
      ],
    },
    attempts: [
      {
        label: 'Day 1',
        reward: { xp: 60, itemIds: ['shell'] },
        consequence: 'Less XP: the shack owner will give you one more chance on Day 2 evening, for a smaller reward.',
      },
      {
        label: 'Second chance (Day 2 evening)',
        availableWhen: { type: 'all', conditions: [{ type: 'day-is', day: 2 }, { type: 'time-at-least', minute: 16 * 60 }] },
        // Day 2 ended (or Day 3 began) before the second chance opened.
        expiresWhen: {
          type: 'any',
          conditions: [{ type: 'day-is', day: 3 }, { type: 'all', conditions: [{ type: 'day-is', day: 2 }, { type: 'day-ending' }] }],
        },
        reward: { xp: 25, itemIds: ['shell'] },
        consequence: 'The sunset is lost for this trip.',
      },
    ],
  },
  {
    id: 'road-trip',
    title: 'The Road Trip',
    emoji: '🛵',
    objective:
      'Rent a scooter and ride to at least three different places across two regions today, keeping your energy above 20 and your money above ₹500.',
    requirements: [{ type: 'day-is', day: 2 }],
    tracksTrips: true,
    steps: [
      {
        id: 'rent-scooter',
        description: 'Rent a scooter for the day',
        completeWhen: { type: 'scooter-rented-today' },
      },
      {
        id: 'first-leg',
        description: 'Ride the first leg of the trip',
        completeWhen: { type: 'trips-today', atLeast: 1, mode: 'scooter' },
      },
      {
        id: 'second-leg',
        description: 'Ride a second leg',
        completeWhen: { type: 'trips-today', atLeast: 2, mode: 'scooter' },
      },
      {
        id: 'three-places',
        description: 'Visit at least three different places today',
        completeWhen: { type: 'places-visited-today', atLeast: 3 },
      },
      {
        id: 'two-regions',
        description: 'Cover at least two regions of Goa',
        completeWhen: { type: 'regions-visited-today', atLeast: 2 },
      },
    ],
    // Energy above 20 and money above ₹500 for the whole trip.
    constraint: {
      type: 'all',
      conditions: [
        { type: 'energy-at-least', amount: 21 },
        { type: 'money-at-least', amount: 501 },
      ],
    },
    // Ending the day (or the day running out) without enough progress.
    failWhen: { type: 'any', conditions: [{ type: 'day-ending' }, { type: 'after-attempt-day' }] },
    attempts: [
      {
        label: 'Day 2',
        reward: { xp: 80, itemIds: [] },
        consequence: 'The road trip fell apart and the day is gone.',
        xpPenalty: 20,
      },
    ],
  },
  {
    id: 'final-sunset',
    title: 'The Final Sunset',
    emoji: '🌇',
    objective:
      'Choose any place you have discovered and watch your last sunset in Goa there. Arrive before 6:30 PM with energy to spare, bring your memories, and pick a place you found yourself for the best ending.',
    requirements: [{ type: 'day-is', day: 3 }],
    steps: [
      {
        id: 'watch-final-sunset',
        description: 'Watch your final sunset at a place you have discovered',
        completeWhen: { type: 'final-sunset-watched' },
      },
    ],
    // If 10 PM comes first, the trip simply ends without the finale.
    failWhen: { type: 'any', conditions: [{ type: 'day-ending' }, { type: 'after-attempt-day' }] },
    attempts: [
      {
        label: 'Day 3',
        reward: { xp: 30, itemIds: [], finalSunsetBonus: true, endsTrip: true },
        consequence: 'The sun set without you. Your trip ends quietly.',
      },
    ],
  },
]
