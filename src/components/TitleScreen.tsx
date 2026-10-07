import { useCallback, useState } from 'react'
import { LOCATION_IDS, LOCATIONS } from '../data/locations'
import { formatClock } from '../engine/clock'
import { GAME_CONFIG } from '../engine/config'
import { useGameDispatch } from '../hooks/useGame'
import { readSave } from '../state/autosave'
import { Logo } from './brand/Logo'
import { formatRupees } from './format'
import { HowToPlay } from './help/HowToPlay'
import { SceneArt } from './scene/LocationScene'
import { Button } from './ui/Button'

/** The title screen shows Baga just before sunset. */
const TITLE_MINUTE = 18 * 60 + 5

const FEATURES = ['🎙️ Speak or type', `🏝️ ${LOCATION_IDS.length} places · ${GAME_CONFIG.tripDays} days`, '📔 Collect memories', '🌅 Catch the final sunset']

interface TitleScreenProps {
  onStart: () => void
}

/** Where a saved trip is, in a few words. */
function describeSave(state: NonNullable<ReturnType<typeof readSave>>['state']): string {
  if (state.phase === 'ended') return 'Trip complete: see your My Goa Summer'
  const when = state.phase === 'day-intro' ? `start of Day ${state.clock.day}` : `Day ${state.clock.day}, ${formatClock(state.clock.minuteOfDay)}`
  return `${when} · ${LOCATIONS[state.currentLocationId].name} · ${formatRupees(state.player.money)}`
}

/** The first thing players see: the logo over Baga at sunset, start or continue, and how to play. */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const dispatch = useGameDispatch()
  // Read once: the save can't change while the title screen is showing (autosave is off here).
  const [save] = useState(readSave)
  // With a trip saved, starting over asks once more, so a stray click can't lose it.
  const [confirming, setConfirming] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  const continueTrip = () => {
    if (!save) return
    dispatch({ type: 'LOAD_GAME', state: save.state })
    onStart()
  }
  const startAdventure = () => {
    if (save && !confirming) {
      setConfirming(true)
      return
    }
    dispatch({ type: 'RESET_GAME' })
    onStart()
  }

  return (
    <main className="title-screen">
      {/* Baga Beach at sunset, behind everything. */}
      <SceneArt locationId="baga" minuteOfDay={TITLE_MINUTE} className="title-screen__scene" />
      <div className="title-screen__card">
        <Logo />
        <p className="title-screen__motto">
          {GAME_CONFIG.motto.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </p>
        <p className="title-screen__tagline">{GAME_CONFIG.tagline}</p>

        <div className="title-screen__buttons">
          <Button size="lg" variant={save ? 'ghost' : 'sunset'} onClick={startAdventure}>
            {confirming ? 'Start over? Click again' : '🌴 Start adventure'}
          </Button>
          <Button size="lg" variant={save ? 'sunset' : 'ghost'} onClick={continueTrip} disabled={!save}>
            ▶️ Continue
          </Button>
        </div>
        <p className="title-screen__save" role="status">
          {confirming
            ? 'A new adventure replaces your saved trip.'
            : save
              ? `Saved: ${describeSave(save.state)}`
              : 'No saved trip yet. Your progress saves automatically.'}
        </p>

        <ul className="title-screen__features">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <button type="button" className="title-screen__how" onClick={() => setHelpOpen(true)}>
          ❓ How to play
        </button>
      </div>
      {helpOpen && <HowToPlay onClose={closeHelp} />}
    </main>
  )
}
