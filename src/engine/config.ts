// Core trip constants. All game rules live in src/engine.
export const GAME_CONFIG = {
  title: 'ExploringGOA',
  /** How the name is shown to players (logo, HUD). */
  displayName: 'Exploring Goa',
  motto: ['Your summer.', 'Your choices.', 'Your Goa.'],
  tagline: 'A 3-day summer trip to Goa, told in your own words.',
  tripDays: 3,
  maxLevel: 3,
} as const

export const MINUTES_PER_DAY = 24 * 60

export const STARTING_VALUES = {
  money: 5000,
  energy: 100,
  day: 1,
  minuteOfDay: 9 * 60,
  level: 1,
  xp: 0,
  locationId: 'baga',
  items: ['camera', 'tourist-map', 'sunglasses'],
} as const

/** Midday heat drains extra energy from outdoor activities and walks that start in this window. */
export const HEAT_RULES = {
  from: 12 * 60,
  until: 16 * 60,
  extraEnergy: 6,
  /** Sunglasses cut the extra loss to this. */
  withSunglasses: 2,
} as const

export const MAP_RULES = {
  /** Time spent studying the map. */
  minutes: 5,
  /** From this day, the map reveals the hidden beach (if no local has yet). */
  revealsHiddenGemFromDay: 2,
} as const

export const ENERGY_MIN = 0
export const ENERGY_MAX = 100

/** Each day starts at 9:00 AM. */
export const DAY_START_MINUTE = 9 * 60

/** Nothing (travel, activities) may end after this time of day: 10:00 PM. Reaching it ends the day. */
export const DAY_END_MINUTE = 22 * 60

/** Sunset is around 6:30 PM. */
export const SUNSET_MINUTE = 18 * 60 + 30

export const SLEEP_RULES = {
  /** Energy a night's sleep restores. */
  restore: 60,
  /** Going to bed before this time restores more. */
  earlyBedBefore: 20 * 60,
  earlyBedRestore: 75,
} as const

export const TRAVEL_RULES = {
  /** Longest distance anyone will agree to walk in the Goan heat. */
  walkMaxKm: 6,
  /** Rental fee per day. Scooters need no fuel, so trips themselves are free. Which days allow renting is in data/days.ts. */
  scooterDayFee: 400,
  /** Paperwork and a helmet fitting at the rental shop. */
  scooterRentalMinutes: 15,
} as const

/** XP for real achievements and good decisions. Activities give their own XP (see the location data). */
export const XP_REWARDS = {
  discovery: 25,
  /** Finding a clue-locked hidden gem. */
  hiddenGemDiscovery: 50,
  memory: 10,
  acceptLocalHelp: 15,
  underBudgetDay: 20,
} as const

export const BUDGET_RULES = {
  /** Roughly ₹5,000 over three days. Spending no more than this in a day earns a bonus. */
  dailyBudget: 1600,
} as const

export const LOCAL_HELP = {
  askMinutes: 15,
  /** Chance a local stops to help. */
  chance: 0.5,
  energyFromChai: 15,
} as const

export const REST_RULES = {
  minutes: 60,
  energy: 15,
} as const

export const RECOMMEND_RULES = {
  /** A meal this cheap or cheaper counts as cheap food. */
  cheapMealMax: 400,
  /** "Around 500" allows this much over. */
  approximateSlack: 0.2,
  /** Sunset is worth heading for from this time on. */
  sunsetSoonFrom: 15 * 60,
  /** After this, nearby places are favoured more. */
  lateFrom: 19 * 60,
} as const

export const COMMAND_RULES = {
  /** How many recent commands the voice panel keeps. */
  historyLength: 5,
} as const

/** The Day 3 finale: how the ending's quality is scored and rewarded. */
export const FINALE_RULES = {
  /** If you're early, you wait here until this time. */
  waitUntil: 18 * 60,
  /** The sun is gone after this: too late to watch. */
  lastStart: 18 * 60 + 45,
  watchMinutes: 45,
  /** Arriving at or before this counts as "before sunset". */
  arriveBy: 18 * 60 + 30,
  energyLeftAtLeast: 20,
  /** Memory count for one and two quality points. */
  memoriesForOnePoint: 3,
  memoriesForTwoPoints: 6,
  /** Points (out of 5) needed for each quality, with its XP and score bonus. */
  qualities: [
    { quality: 'legendary', minPoints: 5, xp: 100, scoreBonus: 500 },
    { quality: 'golden', minPoints: 3, xp: 70, scoreBonus: 350 },
    { quality: 'warm', minPoints: 1, xp: 45, scoreBonus: 200 },
    { quality: 'quiet', minPoints: 0, xp: 25, scoreBonus: 100 },
  ],
} as const

/** Real benefits of higher levels. Titles and descriptions live in data/levels.ts. */
export const LEVEL_PERKS = {
  /** From Explorer (level 2): scooter rental discount. */
  scooterDiscountFromLevel: 2,
  scooterDiscount: 0.25,
  /** From Local Legend (level 3): locals help much more often. */
  betterHelpFromLevel: 3,
  legendHelpChance: 0.85,
} as const

/**
 * The final Adventure Score: points for each real tracked value, a bonus for finishing under budget,
 * and the ending bonus set aside in `state.scoreBonuses`. Caps stop a value being farmed.
 */
export const SCORE_RULES = {
  perDayPlayed: 100,
  perLocationDiscovered: 75,
  perQuestCompleted: 150,
  /** Money put into experiences: one point per this many rupees spent... */
  rupeesPerPoint: 20,
  /** ...up to this many points. */
  moneySpentMaxPoints: 250,
  perKm: 2,
  kmMaxPoints: 300,
  perMemory: 40,
  perXp: 1,
  /** For each level above the first (Explorer +100, Local Legend +200). */
  perLevelAboveFirst: 100,
  /** Finished the trip having spent no more than the daily budget × trip days, and did something. */
  underBudgetBonus: 200,
  /** Lowest score for each rank, best first. */
  ranks: [
    { rank: 'local-legend', title: 'Local Legend', emoji: '🌴', minScore: 2800 },
    { rank: 'explorer', title: 'Explorer', emoji: '🧭', minScore: 1500 },
    { rank: 'tourist', title: 'Tourist', emoji: '🧳', minScore: 0 },
  ],
} as const
