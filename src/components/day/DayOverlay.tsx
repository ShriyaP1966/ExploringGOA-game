import { ACTIVITY_NAMES } from './activityNames'
import { LOCATIONS } from '../../data/locations'
import { dayInfo } from '../../engine/days'
import { BUDGET_RULES, GAME_CONFIG, XP_REWARDS } from '../../engine/config'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { DaySummary } from '../../types'
import { fillTemplate, formatRupees } from '../format'
import { DaySky } from './DaySky'
import { MyGoaSummer } from '../recap/MyGoaSummer'
import { Button } from '../ui/Button'

function DayIntro() {
  const { clock } = useGameState()
  const dispatch = useGameDispatch()
  const info = dayInfo(clock.day)

  return (
    <div className="day-card day-card--with-sky" role="dialog" aria-modal="true" aria-labelledby="day-title">
      <DaySky variant="sunrise" />
      <p className="day-card__eyebrow">
        Day {info.day} of {GAME_CONFIG.tripDays}
        {info.day === 1 && ' · How to play'}
      </p>
      <h2 id="day-title" className="day-card__title">
        {info.emoji} {info.title}
      </h2>
      <p className="day-card__tagline">{info.tagline}</p>
      <ul className="day-card__list">
        {info.intro.map((line) => (
          <li key={line}>{fillTemplate(line)}</li>
        ))}
      </ul>
      <div className="day-card__actions">
        <Button size="lg" onClick={() => dispatch({ type: 'BEGIN_DAY' })}>
          {info.day === 1 ? 'Start exploring' : `Start Day ${info.day}`}
        </Button>
      </div>
    </div>
  )
}

const END_REASON: Record<DaySummary['endedBy'], string> = {
  curfew: 'It is 10 PM: time to head back and sleep.',
  player: 'You called it a day.',
  'final-sunset': 'You watched the final sunset of your trip.',
}

function SummaryCard({ summary }: { summary: DaySummary }) {
  const dispatch = useGameDispatch()
  const { questUpdates } = useGameState()
  const info = dayInfo(summary.day)
  const names = (ids: string[]) => ids.map((id) => ACTIVITY_NAMES[id] ?? id).join(', ')

  return (
    <div className="day-card day-card--with-sky" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <DaySky variant="sunset" />
      <p className="day-card__eyebrow">End of Day {summary.day}</p>
      <h2 id="summary-title" className="day-card__title">
        {info.emoji} {info.title}: day summary
      </h2>
      <p className="day-card__tagline">{END_REASON[summary.endedBy]}</p>

      <div className="day-card__stats">
        <div className="day-stat">
          <span className="day-stat__label">💸 Spent today</span>
          <span className="day-stat__value">{formatRupees(summary.moneySpent)}</span>
        </div>
        <div className="day-stat">
          <span className="day-stat__label">💰 Money left</span>
          <span className="day-stat__value">{formatRupees(summary.moneyLeft)}</span>
        </div>
        <div className="day-stat">
          <span className="day-stat__label">✨ XP earned</span>
          <span className="day-stat__value">
            {summary.xpEarned >= 0 ? '+' : '−'}
            {Math.abs(summary.xpEarned)}
          </span>
        </div>
        <div className="day-stat">
          <span className="day-stat__label">🛵 Travelled</span>
          <span className="day-stat__value">{summary.kmTraveled} km</span>
        </div>
      </div>

      {questUpdates.length > 0 && (
        <div className="day-card__section">
          <h3>📜 Quest news</h3>
          {questUpdates.map((update, i) => (
            <p key={i}>{update.text}</p>
          ))}
        </div>
      )}

      {summary.underBudget && (
        <p className="day-card__bonus">
          💚 You stayed within the daily budget of {formatRupees(BUDGET_RULES.dailyBudget)}: +{XP_REWARDS.underBudgetDay} XP
        </p>
      )}

      <div className="day-card__section">
        <h3>🗺️ Discovered</h3>
        <p>
          {summary.discovered.length
            ? summary.discovered.map((id) => `${LOCATIONS[id].emoji} ${LOCATIONS[id].name}`).join(', ')
            : 'No new places today.'}
        </p>
      </div>
      <div className="day-card__section">
        <h3>🎟️ Things you did</h3>
        <p>{summary.activityIds.length ? names(summary.activityIds) : 'No activities today.'}</p>
      </div>

      <div className="day-card__actions">
        {/* The trip's last day goes straight to the My Goa Summer recap, so a summary always leads to sleep. */}
        <Button size="lg" onClick={() => dispatch({ type: 'CONTINUE_AFTER_SUMMARY' })}>
          Sleep · wake with ⚡{summary.nextMorningEnergy}
        </Button>
      </div>
    </div>
  )
}

/** Covers the game between days: the intro (with the tutorial on Day 1), the summary, and the My Goa Summer recap. */
export function DayOverlay() {
  const { phase, daySummaries } = useGameState()
  if (phase === 'playing') return null

  return (
    <div className="day-overlay">
      {phase === 'day-intro' && <DayIntro />}
      {phase === 'day-summary' && <SummaryCard summary={daySummaries[daySummaries.length - 1]} />}
      {phase === 'ended' && <MyGoaSummer />}
    </div>
  )
}
