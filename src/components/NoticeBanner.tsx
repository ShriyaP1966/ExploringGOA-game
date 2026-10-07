import { useGameState } from '../hooks/useGame'

/** Shows the result of the last action (a trip, a refusal, a discovery). The engine writes it; this only displays it. */
export function NoticeBanner() {
  const { notice } = useGameState()
  return (
    <div className="notice-banner" role="status" aria-live="polite">
      {notice && <p className="notice-banner__text">{notice}</p>}
    </div>
  )
}
