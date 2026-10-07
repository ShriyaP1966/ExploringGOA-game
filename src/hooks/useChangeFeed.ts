import { useCallback, useState } from 'react'
import type { GameState } from '../types'

export interface FeedItem<T> {
  id: number
  item: T
}

/**
 * Turns game state changes into a short-lived feed (floating numbers, toasts). `diff` compares the
 * previous and the new state; whatever it returns is added to the feed until dismissed. Compared
 * during render (React's "adjusting state when a prop changes" pattern), so there is no extra pass.
 */
export function useChangeFeed<T>(state: GameState, diff: (prev: GameState, next: GameState) => T[], max = 6) {
  const [prev, setPrev] = useState(state)
  const [items, setItems] = useState<FeedItem<T>[]>([])
  const [nextId, setNextId] = useState(0)

  if (prev !== state) {
    setPrev(state)
    const fresh = diff(prev, state)
    if (fresh.length > 0) {
      setItems((current) => [...current, ...fresh.map((item, i) => ({ id: nextId + i, item }))].slice(-max))
      setNextId(nextId + fresh.length)
    }
  }

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((x) => x.id !== id)), [])
  return { items, dismiss }
}
