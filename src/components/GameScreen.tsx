import { useMemo, type CSSProperties } from 'react'
import { skyPhase } from '../engine/clock'
import { useGameState } from '../hooks/useGame'
import { DayOverlay } from './day/DayOverlay'
import { DevPanel } from './dev/DevPanel'
import { skyLook } from './scene/sky'
import { EventPopup } from './events/EventPopup'
import { ToastLayer } from './feedback/ToastLayer'
import { GameLayout } from './layout/GameLayout'
import { MainStage } from './layout/MainStage'
import { SidePanel } from './layout/SidePanel'
import { TopBar } from './layout/TopBar'
import { VoicePanel } from './voice/VoicePanel'
import { VoicePanelBoundary } from './voice/VoicePanelBoundary'

/** The developer panel exists in development builds, or on the live site with ?dev in the address. */
const DEV_TOOLS = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev')

export function GameScreen() {
  const { clock } = useGameState()
  // The whole screen shares the scene's light: the background sky blends through the day.
  const look = useMemo(() => skyLook(clock.minuteOfDay), [clock.minuteOfDay])
  const skyVars = {
    '--sky-top': look.top,
    '--sky-mid': look.middle,
    '--sky-horizon': look.horizon,
    '--sky-glow': look.glow,
    '--sun-x': `${Math.round(look.sunX * 100)}%`,
  } as CSSProperties
  return (
    <>
      <GameLayout
        sky={skyPhase(clock.minuteOfDay)}
        style={skyVars}
        topBar={<TopBar />}
        main={<MainStage />}
        side={<SidePanel />}
        voice={
          <VoicePanelBoundary>
            <VoicePanel />
          </VoicePanelBoundary>
        }
      />
      <DayOverlay />
      <EventPopup />
      <ToastLayer />
      {/* Hidden until Ctrl+Shift+D, and only in development or with ?dev in the URL (for recording a demo). */}
      {DEV_TOOLS && <DevPanel />}
    </>
  )
}
