import { LOCATIONS } from '../../data/locations'
import { formatClock } from '../../engine/clock'
import type { Memory } from '../../types'
import { SceneArt } from '../scene/LocationScene'

interface MemoryCardProps {
  memory: Memory
  /** Just made: a gentle glow and a "new" tag. */
  isNew?: boolean
  /** The trip's best memory (final screen). */
  isBest?: boolean
  /** Show the longer description under the caption (final screen). */
  withDescription?: boolean
}

/** A small, stable tilt per memory, so cards look tossed on a table but never shuffle between renders. */
function tiltFor(id: string): number {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const tilts = [-3.2, 2.4, -1.6, 3, -2.4, 1.4]
  return tilts[Math.abs(hash) % tilts.length]
}

/**
 * A memory as a Polaroid: the place, drawn at the moment it happened, with a handwritten caption,
 * the day and the location. Used in the memories panel and on the final My Goa Summer screen.
 */
export function MemoryCard({ memory, isNew = false, isBest = false, withDescription = false }: MemoryCardProps) {
  const place = LOCATIONS[memory.locationId].name
  const classes = ['polaroid', isNew && 'polaroid--new', isBest && 'polaroid--best', memory.storyId && 'polaroid--story']
  return (
    <figure
      className={classes.filter(Boolean).join(' ')}
      style={{ ['--tilt' as string]: `${tiltFor(memory.id)}deg` }}
      title={withDescription ? undefined : memory.description}
    >
      {isBest && <span className="polaroid__tape">⭐ Best memory</span>}
      {isNew && !isBest && <span className="polaroid__tape polaroid__tape--new">New!</span>}
      <div className="polaroid__photo">
        <SceneArt locationId={memory.locationId} minuteOfDay={memory.minuteOfDay} still />
        <span className="polaroid__sticker" aria-hidden="true">
          {memory.emoji ?? '📸'}
        </span>
      </div>
      <figcaption className="polaroid__caption">
        <span className="polaroid__title">
          {memory.title}
          {memory.photo && (
            <span className="polaroid__camera" title="Photo taken with your camera">
              {' '}
              📸
            </span>
          )}
        </span>
        <span className="polaroid__meta">
          Day {memory.day} · {formatClock(memory.minuteOfDay)} · {place}
        </span>
        {withDescription && memory.description && <span className="polaroid__description">{memory.description}</span>}
      </figcaption>
    </figure>
  )
}
