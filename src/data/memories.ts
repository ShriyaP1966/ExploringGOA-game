import type { StoryMemory } from '../types'

/**
 * The trip's story memories. None is ever given directly: each is created automatically the first
 * time one of its triggers happens (see engine/memories.ts). Day, time and place come from that moment.
 */
export const STORY_MEMORIES: StoryMemory[] = [
  {
    id: 'sunset-at-vagator',
    title: 'Sunset at Vagator',
    emoji: '🌅',
    description: 'The sun slid behind the red cliffs and the whole beach went quiet to watch.',
    xp: 25,
    triggers: [
      { type: 'activity', activityId: 'vagator-ozran-sunset' },
      { type: 'quest-complete', questId: 'lost-sunset' },
    ],
  },
  {
    id: 'scooter-disaster',
    title: 'Scooter Disaster',
    emoji: '🛵',
    description: 'The scooter spluttered and died on a hill. A stranger helped push it to a garage, laughing the whole way.',
    xp: 20,
    triggers: [{ type: 'event', eventId: 'scooter-trouble' }],
  },
  {
    id: 'best-meal',
    title: 'Best Meal',
    emoji: '🍛',
    description: 'The kind of meal you will be describing to everyone back home.',
    xp: 20,
    triggers: [{ type: 'great-meal' }, { type: 'event', eventId: 'food-stall', choiceIds: ['eat'] }],
  },
  {
    id: 'hidden-beach-discovery',
    title: 'Hidden Beach Discovery',
    emoji: '🏝️',
    description: 'After all the crowds up north, a calm crescent of sand that felt like a secret.',
    xp: 30,
    triggers: [{ type: 'discover', locationId: 'palolem' }],
  },
  {
    id: 'successful-road-trip',
    title: 'Successful Road Trip',
    emoji: '🗺️',
    description: 'Wind, open roads and the whole state of Goa in a single day.',
    xp: 40,
    triggers: [{ type: 'quest-complete', questId: 'road-trip' }],
  },
  {
    id: 'final-sunset',
    title: 'The Final Sunset at {place}',
    emoji: '🌇',
    description: 'Your last evening in Goa, watching the sun sink into the sea from {place}.',
    xp: 30,
    triggers: [{ type: 'quest-complete', questId: 'final-sunset' }],
  },
  {
    id: 'local-kindness',
    title: "A Local's Kindness",
    emoji: '🤝',
    description: 'A stranger in {place} went out of her way to help, and asked for nothing back.',
    xp: 15,
    triggers: [{ type: 'event', eventId: 'friendly-local', choiceIds: ['hidden-beach', 'chai', 'ride'] }],
  },
  {
    id: 'funny-unexpected-event',
    title: 'Funny Unexpected Event',
    emoji: '🌧️',
    description: 'A sudden downpour sent everyone running into a tiny bar, where strangers ended up dancing until it stopped.',
    xp: 20,
    triggers: [{ type: 'event', eventId: 'sudden-shower' }],
  },
]
