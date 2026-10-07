import type { CSSProperties, ReactNode } from 'react'
import type { SkyPhase } from '../../types'

interface GameLayoutProps {
  topBar: ReactNode
  main: ReactNode
  side: ReactNode
  voice: ReactNode
  /** Time-of-day colour for the background. */
  sky?: SkyPhase
  /** Live sky colours (CSS variables) for the background. */
  style?: CSSProperties
}

// Screen frame: top bar, large main stage, side panel, and a permanent voice area at the bottom.
export function GameLayout({ topBar, main, side, voice, sky, style }: GameLayoutProps) {
  return (
    <div className="game-layout" data-sky={sky} style={style}>
      <div className="game-layout__top">{topBar}</div>
      <main className="game-layout__main">{main}</main>
      <aside className="game-layout__side">{side}</aside>
      <div className="game-layout__voice">{voice}</div>
    </div>
  )
}
