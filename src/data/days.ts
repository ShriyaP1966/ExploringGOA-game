import type { DayInfo } from '../types'

export const DAYS: Record<number, DayInfo> = {
  1: {
    day: 1,
    title: 'Arrival',
    emoji: '🧳',
    tagline: 'Settle in and explore North Goa.',
    intro: [
      'Welcome to Goa! You have just checked in near Baga Beach with {startMoney} for {tripDays} days.',
      'Click a pin on the map to see a place. Fogged "?" pins are places you have not explored yet: travel there to discover them.',
      'Things to do cost money, energy and time, and earn XP. Meals and rest give energy back.',
      'Today you are settling in, so stay in North Goa: walk the short hops or take a taxi. Scooter shops need a day to check your licence.',
      'The day ends at 10 PM, or press "End day" whenever you are ready to sleep. Going to bed early restores more energy.',
    ],
    rules: { regions: ['north'], scooterRental: false, finaleSunset: false },
  },
  2: {
    day: 2,
    title: 'Road Trip',
    emoji: '🛵',
    tagline: 'Scooters unlocked: the whole state is open.',
    intro: [
      'Your licence checked out: scooter rentals are open today for ₹400 a day, with no fuel to pay for.',
      'All of Goa is open. Ride down to Panaji’s painted lanes, or further if you have found a reason to.',
      'Long rides take hours, so plan to be somewhere special by sunset at about 6:30 PM.',
    ],
    rules: { regions: ['north', 'central', 'south'], scooterRental: true, finaleSunset: false },
  },
  3: {
    day: 3,
    title: 'Final Sunset',
    emoji: '🌅',
    tagline: 'Your last day. Make the sunset count.',
    intro: [
      'It is your last day in Goa. Spend what is left of your money and energy wisely.',
      'Choose any place you have discovered for your final sunset, and press "Watch your final sunset here" (until 6:45 PM). If it is early, you wait for the evening there.',
      'For the best ending: arrive before sunset (6:30 PM) with energy to spare, collect memories, and pick a place you discovered yourself.',
      'Out of money or energy? You can still watch from where you are, for a quieter ending. If 10 PM comes first, the trip simply ends.',
    ],
    rules: { regions: ['north', 'central', 'south'], scooterRental: true, finaleSunset: true },
  },
}
