import type { PlaceType } from './command'
import type { ItemId } from './item'
import type { MemoryInput } from './memory'

export type LocationId = 'baga' | 'anjuna' | 'vagator' | 'fontainhas' | 'palolem'

export type Region = 'north' | 'central' | 'south'

/** 1 = very low, 5 = very high. */
export type Rating = 1 | 2 | 3 | 4 | 5

export type ClueId = 'palolem-clue' | 'sunset-clue'

export interface Activity {
  id: string
  name: string
  emoji: string
  description: string
  /** Rupees. */
  cost: number
  /** Change in energy: negative tires you out, positive (meals, rest) restores you. */
  energy: number
  minutes: number
  xp: number
  /** Earliest start time (minutes since midnight). */
  availableFrom?: number
  /** Latest start time (minutes since midnight). */
  availableUntil?: number
  /** Watching the sunset. On the final day this can trigger the ending. */
  isSunset?: boolean
  /** Indoors or in the shade: no midday heat penalty. */
  indoor?: boolean
  /** Item you get (e.g. a ticket you buy, a shell you find). */
  givesItemId?: ItemId
  /** Item you need to do this. */
  requiresItemId?: ItemId
  /** The required item is used up (e.g. a ticket). */
  consumesRequiredItem?: boolean
  /** A special moment: becomes a photo memory if you have a camera. */
  memory?: MemoryInput
  /** A real meal (not just a rest that restores energy). */
  meal?: boolean
  /** A memorable meal (can create the Best Meal memory). */
  greatMeal?: boolean
  /** Something you learn here, e.g. from a conversation. */
  givesClueId?: ClueId
  /** Words a player might use for this activity ("parasailing", "shells"), matched as whole words after normalising. */
  keywords?: string[]
  /** A place this marks on your map. */
  hintsLocationId?: LocationId
}

export interface Location {
  id: LocationId
  name: string
  /** Other names players use (nicknames, local spellings, landmarks), lower case. */
  aliases: string[]
  emoji: string
  region: Region
  /** What kind of place it is, for requests like "a quiet beach". */
  kinds: PlaceType[]
  description: string
  beauty: Rating
  crowd: Rating
  relaxation: Rating
  hasFood: boolean
  activities: Activity[]
  startsDiscovered: boolean
  /** What the tourist map says about this place before you have been there (no name). */
  mapHint: string
  /** If set, the location is completely hidden (not even on the map) until this clue is found. */
  revealedByClue?: ClueId
  /** Position on the map, as percentages of its width and height. */
  mapPosition: { x: number; y: number }
}
