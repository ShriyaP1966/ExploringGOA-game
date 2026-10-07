import type { ReactElement } from 'react'
import type { LocationId } from '../../types'
import { AnjunaScene, BagaScene, FontainhasScene, PalolemScene, VagatorScene, type SceneProps } from './scenes'

/** Every location's scene, drawn over the shared sky. */
export const SCENES: Record<LocationId, (props: SceneProps) => ReactElement> = {
  baga: BagaScene,
  anjuna: AnjunaScene,
  vagator: VagatorScene,
  fontainhas: FontainhasScene,
  palolem: PalolemScene,
}
