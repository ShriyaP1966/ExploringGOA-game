import { useContext } from 'react'
import { GameDispatchContext, GameStateContext } from '../state/gameContext'

export function useGameState() {
  const state = useContext(GameStateContext)
  if (!state) throw new Error('useGameState must be used inside <GameProvider>')
  return state
}

export function useGameDispatch() {
  const dispatch = useContext(GameDispatchContext)
  if (!dispatch) throw new Error('useGameDispatch must be used inside <GameProvider>')
  return dispatch
}
