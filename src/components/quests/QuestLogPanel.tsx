import { LOCATIONS } from '../../data/locations'
import { TRAVEL_MODES } from '../../data/travel'
import {
  currentAttempt,
  currentStep,
  placesVisitedToday,
  questById,
  regionsVisitedToday,
  rewardText,
  tripsToday,
} from '../../engine/quests'
import { useGameState } from '../../hooks/useGame'
import type { QuestProgress, QuestStatus } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

const STATUS: Record<QuestStatus, { label: string; tone: 'ocean' | 'palm' | 'sunset' | 'coral' | 'sand' }> = {
  'not-started': { label: 'Not started', tone: 'sand' },
  active: { label: 'Active', tone: 'ocean' },
  completed: { label: 'Completed', tone: 'palm' },
  failed: { label: 'Failed', tone: 'coral' },
}

/** Active quests first, then ones waiting for a retry, then finished ones. */
function sortKey(p: QuestProgress): number {
  if (p.status === 'active') return 0
  if (p.status === 'failed' && p.retryPending) return 1
  if (p.status === 'not-started') return 3
  return 2
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Today's trips as legs of a road trip, plus places and regions so far. */
function TripLegs() {
  const state = useGameState()
  const legs = tripsToday(state)
  return (
    <div className="quest__legs">
      <p className="quest__legs-title">
        🧭 Today: {plural(placesVisitedToday(state).length, 'place')} · {plural(regionsVisitedToday(state).length, 'region')}
      </p>
      {legs.length === 0 ? (
        <p className="quest__legs-empty">No legs yet.</p>
      ) : (
        <ol className="quest__legs-list">
          {legs.map((leg, i) => (
            <li key={`${leg.minuteOfDay}-${leg.to}`}>
              Leg {i + 1}: {TRAVEL_MODES[leg.mode].emoji} {LOCATIONS[leg.from].name} → {LOCATIONS[leg.to].name}
              {leg.mode !== 'scooter' && <span className="quest__legs-note"> (not by scooter)</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** A checkmark that draws itself the moment it appears (when a step is completed). */
function CheckMark() {
  return (
    <svg className="check" viewBox="0 0 20 20">
      <circle className="check__circle" cx="10" cy="10" r="9" />
      <path className="check__tick" d="M5.5 10.5 L8.8 13.6 L14.6 7" />
    </svg>
  )
}

function QuestEntry({ progress }: { progress: QuestProgress }) {
  const { finalSunset } = useGameState()
  const quest = questById(progress.questId)
  const attempt = currentAttempt(quest, progress)
  const nextAttempt = quest.attempts[progress.attempt + 1]
  const step = currentStep(quest, progress)
  const status = STATUS[progress.status]
  const doneCount = quest.steps.filter((s) => progress.completedStepIds.includes(s.id)).length

  return (
    <article className={`ticket quest quest--${progress.status}`}>
      {/* The ticket stub: the quest's emblem and how far along it is. */}
      <div className="ticket__stub" aria-hidden="true">
        <span className="ticket__emblem">{quest.emoji}</span>
        <span className="ticket__count">
          {doneCount}/{quest.steps.length}
        </span>
      </div>
      <div className="ticket__main">
        <header className="quest__header">
          <h4 className="quest__title">{quest.title}</h4>
          <Badge tone={status.tone}>{progress.retryPending ? 'Retry pending' : status.label}</Badge>
        </header>
        <p className="quest__objective">{quest.objective}</p>
        {progress.attempt > 0 && <p className="quest__attempt">🔁 {attempt.label}</p>}
        <div
          className="ticket__progress"
          role="progressbar"
          aria-label={`${quest.title}: ${doneCount} of ${quest.steps.length} steps done`}
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={quest.steps.length}
        >
          <span className="ticket__progress-fill" style={{ width: `${(doneCount / quest.steps.length) * 100}%` }} />
        </div>

        <ol className="quest__steps">
          {quest.steps.map((s) => {
            const done = progress.completedStepIds.includes(s.id)
            const isCurrent = progress.status === 'active' && s.id === step?.id
            return (
              <li key={s.id} className={`quest-step ${done ? 'quest-step--done' : ''} ${isCurrent ? 'quest-step--current' : ''}`}>
                <span className="quest-step__mark" aria-hidden="true">
                  {done ? <CheckMark /> : <span className={`quest-step__dot ${isCurrent ? 'quest-step__dot--current' : ''}`} />}
                </span>
                <span>
                  {s.description}
                  <span className="visually-hidden">{done ? ' (done)' : isCurrent ? ' (current step)' : ''}</span>
                </span>
              </li>
            )
          })}
        </ol>

        {quest.tracksTrips && progress.status === 'active' && <TripLegs />}

        {progress.status === 'failed' ? (
          <>
            <p className="quest__consequence">⚠️ {attempt.consequence}</p>
            {progress.retryPending && nextAttempt && (
              <p className="quest__reward">🎁 Retry reward: {rewardText(quest.id, nextAttempt)}</p>
            )}
          </>
        ) : (
          <p className="quest__reward">
            🎁 {progress.status === 'completed' ? 'Earned' : 'Reward'}:{' '}
            {rewardText(quest.id, attempt, progress.status === 'completed' ? finalSunset : null)}
          </p>
        )}
      </div>
    </article>
  )
}

export function QuestLogPanel() {
  const { quests } = useGameState()
  const shown = [...quests].sort((a, b) => sortKey(a) - sortKey(b))

  return (
    <Card title="📜 Quest log">
      {shown.length === 0 ? (
        <p className="side-panel__muted">No quests yet.</p>
      ) : (
        <div className="quest-log">
          {shown.map((progress) => (
            <QuestEntry key={progress.questId} progress={progress} />
          ))}
        </div>
      )}
    </Card>
  )
}
