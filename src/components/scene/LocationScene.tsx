import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LOCATIONS } from '../../data/locations'
import { formatClock, skyPhase } from '../../engine/clock'
import { useGameState } from '../../hooks/useGame'
import type { LocationId, SkyPhase } from '../../types'
import { H, W } from './frame'
import { SceneIdContext } from './ids'
import { SceneDefs, SkyBackdrop } from './parts'
import { SCENES } from './registry'
import { skyLook } from './sky'

const LIGHT_NAME: Record<SkyPhase, string> = {
  morning: '🌤️ Morning',
  afternoon: '☀️ Afternoon',
  golden: '🌇 Golden hour',
  sunset: '🌅 Sunset',
  dusk: '🌆 Dusk',
  night: '🌙 Night',
}

/** How far the mirrored side copies overlap the scene's edges (scene units). */
const SEAM_OVERLAP = 4

/** Never show less than this much of the scene's height, so landmarks stay whole. */
const MIN_VISIBLE_HEIGHT = 380

/**
 * Which part of the scene to show for the stage's shape. The ground is always kept; a wide stage
 * shows a little less sky and extends sideways (the scene's edges are mirrored, so they join up);
 * a tall, narrow one crops the sides.
 */
function frameFor(aspect: number) {
  const visH = Math.min(H, Math.max(MIN_VISIBLE_HEIGHT, W / aspect))
  const visW = visH * aspect
  return { x: (W - visW) / 2, y: H - visH, w: visW, h: visH }
}

interface SceneArtProps {
  locationId: LocationId
  minuteOfDay: number
  className?: string
  /** A still picture (no drifting clouds or swaying palms), e.g. for Polaroid thumbnails. */
  still?: boolean
}

/** A location's scene at a time of day, filling its box (also used behind the title screen). */
export function SceneArt({ locationId, minuteOfDay, className = '', still = false }: SceneArtProps) {
  // Every scene on the page gets its own SVG ids, so gradients never leak between pictures.
  const prefix = `scene${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const look = useMemo(() => skyLook(minuteOfDay), [minuteOfDay])
  const Scene = SCENES[locationId]
  const ref = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState(W / H)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setAspect(width / height)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const frame = frameFor(aspect)

  return (
    <div ref={ref} className={`scene ${still ? 'scene--still' : ''} ${className}`.trim()}>
      <svg
        className="scene__art"
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <SceneIdContext.Provider value={prefix}>
          <SceneDefs look={look} />
          <SkyBackdrop look={look} top={frame.y} />
          <g id={`${prefix}-body`}>
            <Scene look={look} />
          </g>
        </SceneIdContext.Provider>
        {frame.x < 0 && (
          <>
            {/* Mirrored copies extend the scene sideways. They overlap the edge by a few units, so each
                copy's soft (anti-aliased) edge sits over solid picture and no seam shows. */}
            <use href={`#${prefix}-body`} transform={`translate(${SEAM_OVERLAP} 0) scale(-1 1)`} />
            <use href={`#${prefix}-body`} transform={`translate(${2 * W - SEAM_OVERLAP} 0) scale(-1 1)`} />
          </>
        )}
      </svg>
    </div>
  )
}

/** Where you are, drawn as a living scene lit by the time of day. Pure illustration: no game rules. */
export function LocationScene() {
  const { currentLocationId, clock } = useGameState()
  const location = LOCATIONS[currentLocationId]
  const phase = skyPhase(clock.minuteOfDay)

  return (
    <figure className="scene-figure" aria-label={`${location.name}, ${LIGHT_NAME[phase].split(' ').slice(1).join(' ')}`}>
      {/* Keyed by place: arriving somewhere new eases the new scene in. */}
      <SceneArt key={currentLocationId} locationId={currentLocationId} minuteOfDay={clock.minuteOfDay} className={`scene--${phase} scene--arrive`} />
      <figcaption className="scene__caption">
        <span className="scene__place">
          <span aria-hidden="true">{location.emoji}</span> {location.name}
        </span>
        <span className="scene__time">
          {LIGHT_NAME[phase]} · {formatClock(clock.minuteOfDay)}
        </span>
        <span className="scene__description">{location.description}</span>
      </figcaption>
    </figure>
  )
}
