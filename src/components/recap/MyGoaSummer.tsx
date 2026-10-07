import { useMemo } from 'react'
import { tripRecap } from '../../engine/recap'
import { adventureScore } from '../../engine/score'
import { useCountUp } from '../../hooks/useCountUp'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { MemoryCard } from '../memories/MemoryCard'
import { Button } from '../ui/Button'

/** The final screen: the whole trip, read from the real game state, with the Adventure Score and rank. */
export function MyGoaSummer() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const recap = useMemo(() => tripRecap(state), [state])
  const score = useMemo(() => adventureScore(state), [state])
  const { value, done } = useCountUp(score.total)

  return (
    <div className="recap" role="dialog" aria-modal="true" aria-labelledby="recap-title">
      <header className="recap__header">
        <p className="day-card__eyebrow">Trip complete</p>
        <h2 id="recap-title" className="recap__title">
          ☀️ My Goa Summer
        </h2>
        <p className="recap__ending">
          <strong>{recap.endingTitle}</strong> · {recap.endingLine}
        </p>
      </header>

      <section className="recap__score" aria-label="Adventure Score">
        <div className="recap__score-main">
          <span className="recap__score-label">Adventure Score</span>
          <span className="recap__score-value" aria-live="polite" aria-atomic="true">
            {done ? score.total.toLocaleString('en-IN') : value.toLocaleString('en-IN')}
          </span>
          <span className={`recap__rank recap__rank--${score.rank.rank} ${done ? 'recap__rank--shown' : ''}`}>
            {score.rank.emoji} {score.rank.title}
          </span>
          {done && score.nextRank && (
            <span className="recap__next">
              {score.nextRank.pointsNeeded.toLocaleString('en-IN')} more points for {score.nextRank.rank.emoji}{' '}
              {score.nextRank.rank.title}
            </span>
          )}
        </div>
        <ul className="recap__breakdown">
          {score.lines.map((line) => (
            <li key={line.id}>
              <span>
                {line.emoji} {line.label}
              </span>
              <span className="recap__points">+{line.points.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recap-stats">
        <h3 id="recap-stats" className="recap__heading">
          📊 Your trip
        </h3>
        <div className="recap__stats">
          {recap.stats.map((stat) => (
            <div key={stat.id} className="day-stat">
              <span className="day-stat__label">
                {stat.emoji} {stat.label}
              </span>
              <span className="day-stat__value">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="recap-highlights">
        <h3 id="recap-highlights" className="recap__heading">
          💛 Your highlights
        </h3>
        <ul className="recap__highlights">
          {recap.highlights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recap-memories">
        <h3 id="recap-memories" className="recap__heading">
          📔 Memories ({recap.memories.length})
        </h3>
        {recap.memories.length === 0 ? (
          <p className="recap__muted">No memories this time. Goa will still be here next summer.</p>
        ) : (
          <ul className="recap__memories polaroid-grid polaroid-grid--large">
            {recap.memories.map((memory) => (
              <li key={memory.id}>
                <MemoryCard memory={memory} isBest={memory.id === recap.bestMemory?.id} withDescription />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="recap__final">{recap.finalMessage}</p>

      <div className="recap__actions">
        <Button size="lg" variant="sunset" onClick={() => dispatch({ type: 'RESET_GAME' })}>
          🔁 Play again
        </Button>
      </div>
    </div>
  )
}
