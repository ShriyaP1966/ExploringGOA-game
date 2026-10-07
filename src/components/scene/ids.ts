import { createContext, useContext } from 'react'

/**
 * Each scene on the page (the main view, a Polaroid, the title screen) gets its own prefix for SVG
 * ids, so gradients from one scene are never picked up by another.
 */
export const SceneIdContext = createContext('scene')

export function useSceneIds() {
  const prefix = useContext(SceneIdContext)
  return {
    id: (name: string) => `${prefix}-${name}`,
    url: (name: string) => `url(#${prefix}-${name})`,
  }
}
