import { FINALE_RULES } from '../../engine/config'
import { assessFinalSunset, checkFinalSunset, qualityText } from '../../engine/finale'
import { dayRules } from '../../engine/days'
import { formatClock } from '../../engine/clock'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { Button } from '../ui/Button'

const QUALITY_LABEL = { legendary: '🌟 Legendary', golden: '✨ Golden', warm: '🧡 Warm', quiet: '🌙 Quiet' } as const

/** Day 3: choose this place for the final sunset. Shows, from the real state, what kind of ending you'd get. */
export function FinalSunsetPanel() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  if (!dayRules(state).finaleSunset || state.finalSunset) return null

  const check = checkFinalSunset(state)
  const preview = assessFinalSunset(state)
  const { factors } = preview
  const mark = (ok: boolean) => (ok ? '✓' : '✗')

  return (
    <section className="final-sunset" aria-label="Final sunset">
      <div className="final-sunset__row">
        <span className="final-sunset__title">🌇 Watch your final sunset here</span>
        <Button size="sm" variant="sunset" disabled={!check.ok} onClick={() => dispatch({ type: 'WATCH_FINAL_SUNSET' })}>
          Watch
        </Button>
      </div>
      {check.ok ? (
        <>
          <p className="final-sunset__hint">
            {state.clock.minuteOfDay < FINALE_RULES.waitUntil
              ? `You'll wait here until ${formatClock(FINALE_RULES.waitUntil)}. No cost, no energy.`
              : 'No cost, no energy.'}
          </p>
          <ul className="final-sunset__factors">
            <li>{mark(factors.arrivedBeforeSunset)} Here before sunset (6:30 PM)</li>
            <li>
              {mark(factors.energyLeft)} At least ⚡{FINALE_RULES.energyLeftAtLeast} energy left
            </li>
            <li>
              {mark(factors.memories >= FINALE_RULES.memoriesForOnePoint)} {factors.memories} memories (
              {FINALE_RULES.memoriesForOnePoint}+ for one point, {FINALE_RULES.memoriesForTwoPoints}+ for two)
            </li>
            <li>{mark(factors.selfDiscovered)} A place you discovered yourself</li>
            {factors.outOfResources && <li>⚠️ Out of energy or money: a quieter ending</li>}
          </ul>
          <p className="final-sunset__preview">
            Ending if you watch now: <strong>{QUALITY_LABEL[preview.quality]}</strong> ({preview.points}/5) ·{' '}
            {qualityText(preview.quality)}
          </p>
        </>
      ) : (
        <p className="activity__reason">{check.reason}</p>
      )}
    </section>
  )
}
