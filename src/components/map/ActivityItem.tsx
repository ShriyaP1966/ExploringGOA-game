import { formatClock, formatDuration } from '../../engine/clock'
import { ITEMS } from '../../data/items'
import { activityHeat, isActivityDoneToday, isFinaleActivity, quoteActivity } from '../../engine/activities'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { Activity } from '../../types'
import { formatRupees } from '../format'
import { Button } from '../ui/Button'

function windowText(activity: Activity): string | null {
  const { availableFrom: from, availableUntil: until } = activity
  if (from !== undefined && until !== undefined) return `Starts ${formatClock(from)}–${formatClock(until)}`
  if (from !== undefined) return `From ${formatClock(from)}`
  if (until !== undefined) return `Until ${formatClock(until)}`
  return null
}

/** One activity. At your current location it can be done; the engine decides whether it is allowed. */
export function ActivityItem({ activity, isHere }: { activity: Activity; isHere: boolean }) {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const done = isActivityDoneToday(state, activity.id)
  const check = isHere ? quoteActivity(state, activity.id) : null
  const when = windowText(activity)
  const heat = isHere ? activityHeat(state, activity) : 0
  const tags = [
    activity.requiresItemId && `🔑 Needs ${ITEMS[activity.requiresItemId].emoji} ${ITEMS[activity.requiresItemId].name}`,
    activity.givesItemId && `🎁 Gives ${ITEMS[activity.givesItemId].emoji} ${ITEMS[activity.givesItemId].name}`,
    activity.memory && '📸 Photo moment',
    heat > 0 && `☀️ Midday heat ⚡−${heat}`,
  ].filter((tag): tag is string => Boolean(tag))

  return (
    <li className={`activity ${done ? 'activity--done' : ''}`}>
      <div className="activity__row">
        <div>
          <div className="activity__name">
            {activity.emoji} {activity.name}
            {done && ' ✓'}
          </div>
          <div className="activity__meta">
            <span>{activity.cost === 0 ? 'Free' : formatRupees(activity.cost)}</span>
            <span className={activity.energy >= 0 ? 'activity__gain' : 'activity__cost'}>
              ⚡ {activity.energy > 0 ? '+' : ''}
              {activity.energy}
            </span>
            <span>🕘 {formatDuration(activity.minutes)}</span>
            <span>✨ +{activity.xp} XP</span>
            {when && <span>⏰ {when}</span>}
          </div>
          {isFinaleActivity(state, activity) && <span className="activity__finale">🌅 Ends your trip on a high</span>}
          {tags.length > 0 && (
            <div className="activity__tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        {isHere && (
          <Button
            size="sm"
            variant={isFinaleActivity(state, activity) ? 'sunset' : 'primary'}
            disabled={!check?.ok}
            onClick={() => dispatch({ type: 'DO_ACTIVITY', activityId: activity.id })}
            aria-label={`Do: ${activity.name}`}
          >
            Do it
          </Button>
        )}
      </div>
      {check && !check.ok && !done && <p className="activity__reason">{check.reason}</p>}
    </li>
  )
}
