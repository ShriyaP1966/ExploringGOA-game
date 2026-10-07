import { createContext, type Dispatch } from 'react'
import type { GameAction, GameState } from '../types'

export const GameStateContext = createContext<GameState | null>(null)
export const GameDispatchContext = createContext<Dispatch<GameAction> | null>(null)
