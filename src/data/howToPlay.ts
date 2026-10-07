/**
 * The How to play overlay: the basics, and example things to say (each one is tested against the parser).
 * {placeCount}, {tripDays} and {startMoney} are filled in from the configuration (components/format.ts).
 */

export const HOW_TO_PLAY_STEPS = [
  { icon: '🎙️', text: 'Say or type what you want to do, in your own words, then press Enter. The box is always ready.' },
  { icon: '⚡', text: 'Every choice costs money, energy or time. Watch the bar at the top, and rest or eat when you run low.' },
  { icon: '🌅', text: 'Explore {placeCount} places in {tripDays} days, follow the quests, collect memories, and catch your final sunset on the last day.' },
]

export interface ExampleGroup {
  title: string
  phrases: string[]
}

export const EXAMPLE_GROUPS: ExampleGroup[] = [
  { title: '🗺️ Getting around', phrases: ['take me to Vagator', 'what is the cheapest way to Panjim', 'rent a scooter'] },
  { title: '🔎 Finding things', phrases: ['find me cheap food nearby', 'somewhere relaxing under 500 rupees', 'find a quiet beach'] },
  { title: '🎟️ Doing things', phrases: ['go swimming', 'ask a local', 'wait for the sunset', 'use my tourist map'] },
  { title: '📋 Checking', phrases: ['how much money do I have', 'show my quests', "what's in my bag"] },
  { title: '💬 Answering', phrases: ['yes', 'no thanks', 'end the day', 'help'] },
]
