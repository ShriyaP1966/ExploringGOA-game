import { useEffect, useReducer, type ReactNode } from 'react'
import { createInitialState } from '../engine/initialState'
import { newSeed } from '../engine/random'
import { gameReducer } from '../engine/reducer'
import { writeSave } from './autosave'
import { GameDispatchContext, GameStateContext } from './gameContext'

interface GameProviderProps {
  children: ReactNode
  /** Save after every action. Off on the title screen, so an old save survives until you choose. */
  autosave?: boolean
}

/** Holds the single game state. Components send actions; only the engine reducer changes state. */
export function GameProvider({ children, autosave = false }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState(newSeed()))

  // Every action produces a new state: save it.
  useEffect(() => {
    if (autosave) writeSave(state)
  }, [state, autosave])

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  )
}
