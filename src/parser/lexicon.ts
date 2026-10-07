import type { ActivityKind, Mood, PlaceType, TravelModeId } from '../types'

/**
 * The words and phrases the parser understands, as data. Phrases are matched on whole words after
 * normalising (lower case, contractions expanded, numbers as digits).
 */

export const MOOD_PHRASES: Record<Mood, string[]> = {
  beautiful: [
    'beautiful', 'scenic', 'pretty', 'gorgeous', 'stunning', 'picturesque', 'lovely', 'breathtaking',
    'view', 'views', 'nice view', 'best view', 'instagrammable',
  ],
  quiet: ['quiet', 'peaceful', 'calm', 'secluded', 'tranquil', 'serene', 'isolated', 'empty', 'deserted', 'silent'],
  relaxing: [
    'relaxing', 'relax', 'relaxed', 'chill', 'chilled', 'chilling', 'unwind', 'laid back', 'laidback', 'lazy',
    'restful', 'easy going', 'slow',
  ],
  lively: ['lively', 'party', 'parties', 'partying', 'nightlife', 'buzzing', 'vibrant', 'happening', 'energetic', 'fun'],
  authentic: [
    'local', 'authentic', 'offbeat', 'off the beaten path', 'off the beaten track', 'untouristy', 'non touristy',
    'hidden gem', 'real goa',
  ],
}

/** Words about crowds. Negated ("not too crowded") they become "avoid crowds"; on their own, a lively mood. */
export const CROWD_PHRASES = ['crowded', 'crowds', 'crowd', 'busy', 'packed', 'full of people', 'touristy']

export const ACTIVITY_PHRASES: Record<ActivityKind, string[]> = {
  eat: [
    'eat', 'eating', 'food', 'foods', 'meal', 'meals', 'lunch', 'dinner', 'breakfast', 'hungry', 'starving',
    'restaurant', 'restaurants', 'snack', 'snacks', 'thali', 'curry', 'seafood', 'bite', 'dine', 'dining', 'cafe',
  ],
  swim: ['swim', 'swimming', 'dip', 'bathe', 'bathing', 'in the sea', 'in the water'],
  shop: ['shop', 'shopping', 'shops', 'buy', 'buying', 'souvenir', 'souvenirs', 'market', 'markets', 'bargain', 'haggle'],
  photo: ['photo', 'photos', 'photograph', 'photographs', 'picture', 'pictures', 'pics', 'pic', 'selfie', 'selfies', 'snaps'],
  sunset: ['sunset', 'sunsets', 'sundown', 'golden hour'],
}

export const PLACE_TYPE_PHRASES: Record<PlaceType, string[]> = {
  beach: ['beach', 'beaches', 'seaside', 'shore', 'coast', 'sand'],
  town: ['town', 'city', 'village', 'streets', 'old town'],
  fort: ['fort', 'castle', 'ruins'],
  market: ['market', 'bazaar'],
}

export const TRAVEL_MODE_PHRASES: Record<TravelModeId, string[]> = {
  scooter: ['scooter', 'scooty', 'bike', 'moped', 'two wheeler', 'activa'],
  taxi: ['taxi', 'cab', 'car', 'uber', 'ola', 'drive me'],
  walk: ['walk', 'walking', 'on foot', 'stroll'],
}

export const TIRED_PHRASES = ['tired', 'exhausted', 'sleepy', 'worn out', 'knackered', 'drained', 'no energy', 'low on energy']

export const NEARBY_PHRASES = [
  'nearby', 'near by', 'near here', 'close by', 'close to here', 'around here', 'not far', 'walking distance',
  'closest', 'nearest',
]

export const CHEAP_PHRASES = ['cheap', 'cheaper', 'cheapest', 'inexpensive', 'affordable', 'budget', 'low cost', 'economical']

export const FREE_PHRASES = ['free', 'for free', 'no money', 'without spending', 'without paying', 'free of cost']

/** Words that flip the meaning of what follows (within a few words). */
export const NEGATORS = new Set(['not', 'no', 'never', 'without', 'avoid', 'avoiding', 'nothing', 'none', 'hate', 'less', 'fewer', 'away', 'skip'])

/** Words that end a negation's reach: "not crowded and beautiful" negates only "crowded". */
export const CLAUSE_BREAKS = new Set(['but', 'and', 'or', 'so', 'although', 'though', 'however', 'then', 'also'])

/** How far back (in words) a negation reaches: "is not too crowded". */
export const NEGATION_REACH = 3
