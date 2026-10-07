import { useEffect } from 'react'
import { useChangeFeed } from '../../hooks/useChangeFeed'
import { useGameState } from '../../hooks/useGame'
import { toastsFor, type ToastKind, type ToastSpec } from './changes'

/** How long each kind of toast stays: XP is a quick blip; news gets time to be read. */
const TOAST_MS: Record<ToastKind, number> = {
  xp: 2600,
  discovery: 5000,
  quest: 5500,
  level: 6000,
  memory: 5000,
}

function Toast({ id, toast, dismiss }: { id: number; toast: ToastSpec; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), TOAST_MS[toast.kind])
    return () => clearTimeout(timer)
  }, [id, toast.kind, dismiss])

  return (
    <li className={`toast toast--${toast.kind}`} style={{ ['--toast-ms' as string]: `${TOAST_MS[toast.kind]}ms` }}>
      <span className="toast__icon" aria-hidden="true">
        {toast.icon}
      </span>
      <span className="toast__body">
        <span className="toast__title">{toast.title}</span>
        {toast.text && <span className="toast__text">{toast.text}</span>}
      </span>
      <button type="button" className="toast__close" onClick={() => dismiss(id)} aria-label="Dismiss">
        ✕
      </button>
    </li>
  )
}

/**
 * Toasts for discoveries, quest steps, XP, level-ups and memories, stacked in the top corner.
 * They only describe what the engine already did; nothing here changes the game.
 */
export function ToastLayer() {
  const state = useGameState()
  const { items, dismiss } = useChangeFeed(state, toastsFor, 5)
  return (
    <ol className="toasts" role="status" aria-live="polite" aria-label="Notifications">
      {items.map(({ id, item }) => (
        <Toast key={id} id={id} toast={item} dismiss={dismiss} />
      ))}
    </ol>
  )
}
