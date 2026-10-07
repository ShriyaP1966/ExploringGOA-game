import { LOCATIONS } from '../../data/locations'
import type { LocationId, Rating, Region } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ActivityItem } from './ActivityItem'
import { AskLocalButton } from './AskLocalButton'
import { FinalSunsetPanel } from './FinalSunsetPanel'
import { RentScooterRow } from './RentScooterRow'
import { TravelOptions } from './TravelOptions'

const REGION_LABEL: Record<Region, string> = { north: 'North Goa', central: 'Central Goa', south: 'South Goa' }

function RatingDots({ label, value }: { label: string; value: Rating }) {
  return (
    <div className="location-details__rating">
      <span>{label}</span>
      <span className="location-details__dots" aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'dot dot--on' : 'dot'} />
        ))}
      </span>
    </div>
  )
}

interface LocationDetailsProps {
  locationId: LocationId
  isCurrent: boolean
  /** Undiscovered places show no name or details, only how to get there. */
  isDiscovered: boolean
  side: 'left' | 'right'
  /** Shown for unexplored places the tourist map has hinted at. */
  mapHint?: string
  onClose: () => void
}

export function LocationDetails({ locationId, isCurrent, isDiscovered, side, mapHint, onClose }: LocationDetailsProps) {
  const location = LOCATIONS[locationId]

  if (!isDiscovered) {
    return (
      <aside className={`location-details location-details--${side}`} aria-label="Unexplored place">
        <header className="location-details__header">
          <h3>❓ Unexplored place</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close details">
            ✕
          </Button>
        </header>
        <p className="location-details__description">
          The fog hides what is here. Travel there to discover it.
        </p>
        {mapHint && <p className="location-details__hint">🗺️ Your map says: {mapHint}</p>}
        <TravelOptions to={locationId} />
      </aside>
    )
  }

  return (
    <aside className={`location-details location-details--${side}`} aria-label={`${location.name} details`}>
      <header className="location-details__header">
        <h3>
          {location.emoji} {location.name}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close details">
          ✕
        </Button>
      </header>

      <div className="location-details__badges">
        <Badge tone="ocean">{REGION_LABEL[location.region]}</Badge>
        {isCurrent && <Badge tone="sunset">📍 You are here</Badge>}
        {location.hasFood ? <Badge tone="palm">🍽️ Food available</Badge> : <Badge tone="coral">🚫 No food</Badge>}
      </div>

      <p className="location-details__description">{location.description}</p>

      <div className="location-details__ratings">
        <RatingDots label="Beauty" value={location.beauty} />
        <RatingDots label="Crowd" value={location.crowd} />
        <RatingDots label="Relaxing" value={location.relaxation} />
      </div>

      {isCurrent ? (
        <>
          <FinalSunsetPanel />
          <AskLocalButton />
          <RentScooterRow />
        </>
      ) : (
        <TravelOptions to={locationId} />
      )}

      <h4 className="location-details__subtitle">Things to do</h4>
      <ul className="location-details__activities">
        {location.activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} isHere={isCurrent} />
        ))}
      </ul>
    </aside>
  )
}
