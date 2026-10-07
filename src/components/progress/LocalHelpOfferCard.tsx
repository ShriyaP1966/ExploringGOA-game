import { XP_REWARDS } from '../../engine/config'
import { offerText } from '../../engine/localHelp'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { Button } from '../ui/Button'

/** A local's offer of help, waiting for the player to accept or decline. */
export function LocalHelpOfferCard() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  if (!state.pendingHelp) return null

  return (
    <div className="help-offer" role="dialog" aria-label="A local offers help">
      <p className="help-offer__text">{offerText(state, state.pendingHelp)}</p>
      <div className="help-offer__actions">
        <Button size="sm" variant="sunset" onClick={() => dispatch({ type: 'ACCEPT_HELP' })}>
          Accept (+{XP_REWARDS.acceptLocalHelp} XP)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'DECLINE_HELP' })}>
          No thanks
        </Button>
      </div>
    </div>
  )
}
