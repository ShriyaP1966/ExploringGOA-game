import { LOCATION_IDS, LOCATIONS } from '../../data/locations'

/** Activity id -> "emoji name", for summaries. */
export const ACTIVITY_NAMES: Record<string, string> = Object.fromEntries(
  LOCATION_IDS.flatMap((id) => LOCATIONS[id].activities.map((a) => [a.id, `${a.emoji} ${a.name}`])),
)
