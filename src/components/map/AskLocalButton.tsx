import { LOCAL_HELP } from '../../engine/config'
import { checkAskLocal, localHelpChance } from '../../engine/localHelp'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { Button } from '../ui/Button'

/** Ask the people around you for help. Whether anyone helps is decided by the engine's chance roll. */
export function AskLocalButton() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const check = checkAskLocal(state)
  const chance = Math.round(localHelpChance(state) * 100)

  return (
    <div className="ask-local">
      <div className="ask-local__row">
        <span className="ask-local__label">
          🙋 Ask a local for help
          <span className="ask-local__meta">
            {' '}
            · {LOCAL_HELP.askMinutes} min · ~{chance}% chance
          </span>
        </span>
        <Button size="sm" variant="ghost" disabled={!check.ok} onClick={() => dispatch({ type: 'ASK_LOCAL' })}>
          Ask
        </Button>
      </div>
      {!check.ok && <p className="activity__reason">{check.reason}</p>}
    </div>
  )
}
