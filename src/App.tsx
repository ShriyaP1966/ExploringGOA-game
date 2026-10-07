import { useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { TitleScreen } from './components/TitleScreen'
import { VoicePanel } from './components/voice/VoicePanel'
import { VoicePanelBoundary } from './components/voice/VoicePanelBoundary'
import { GameProvider } from './state/GameProvider'

type Screen = 'title' | 'game'

function App() {
  const [screen, setScreen] = useState<Screen>('title')

  // One game state for every screen, so the voice panel works everywhere.
  return (
    // Autosave starts once you leave the title screen, so the save you could continue isn't overwritten first.
    <GameProvider autosave={screen === 'game'}>
      {screen === 'title' ? (
        <div className="title-shell">
          <TitleScreen onStart={() => setScreen('game')} />
          <VoicePanelBoundary>
            <VoicePanel />
          </VoicePanelBoundary>
        </div>
      ) : (
        <GameScreen />
      )}
    </GameProvider>
  )
}

export default App
