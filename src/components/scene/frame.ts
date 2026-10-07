import { HORIZON, mix, type SkyLook } from './sky'

/** Every scene is drawn in this frame and scaled to fit (cropping the sides, never the ground). */
export const W = 960
export const H = 480
export const HZ = Math.round(H * HORIZON)

/** Land far away takes on the colour of the sky near the horizon (aerial perspective). */
export const far = (look: SkyLook, colour: string, amount = 0.45) => mix(colour, look.horizon, amount)
/** Land in the scene is lit by the sky: darker and bluer at night, warmer at sunset. */
export const lit = (look: SkyLook, colour: string) => mix(colour, look.tint, look.tintOpacity * 0.9)
