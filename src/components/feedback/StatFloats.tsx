import { useEffect } from 'react'
import { useChangeFeed } from '../../hooks/useChangeFeed'
import { useGameState } from '../../hooks/useGame'
import type { GameState } from '../../types'
import { formatDelta, statDeltas, type Stat, type StatDelta } from './changes'

/** How long a floating number stays (the CSS animation is a little shorter). */
const FLOAT_MS = 1300

function Float({ id, delta, dismiss }: { id: number; delta: StatDelta; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), FLOAT_MS)
    return () => clearTimeout(timer)
  }, [id, dismiss])
  return (
    <span className={`stat-float stat-float--${delta.amount > 0 ? 'up' : 'down'} stat-float--${delta.stat}`}>{formatDelta(delta)}</span>
  )
}

const forStat = (stat: Stat) => (prev: GameState, next: GameState) => statDeltas(prev, next).filter((d) => d.stat === stat)
const DIFFS: Record<Stat, (prev: GameState, next: GameState) => StatDelta[]> = {
  money: forStat('money'),
  energy: forStat('energy'),
  xp: forStat('xp'),
}

/** "+₹500" or "−20" rising from a HUD chip when that stat changes. Decorative: the HUD value itself is the source of truth. */
export function StatFloats({ stat }: { stat: Stat }) {
  const state = useGameState()
  const { items, dismiss } = useChangeFeed(state, DIFFS[stat], 3)
  return (
    <span className="stat-floats" aria-hidden="true">
      {items.map(({ id, item }) => (
        <Float key={id} id={id} delta={item} dismiss={dismiss} />
      ))}
    </span>
  )
}
