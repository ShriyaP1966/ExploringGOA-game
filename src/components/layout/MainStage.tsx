import { useState } from 'react'
import { WorldMap } from '../map/WorldMap'
import { LocationScene } from '../scene/LocationScene'
import { NoticeBanner } from '../NoticeBanner'
import { LocalHelpOfferCard } from '../progress/LocalHelpOfferCard'
import { Panel } from '../ui/Panel'
import { TabBar } from '../ui/TabBar'

const STAGE_TABS = [
  { id: 'scene', label: '🏝️ Scene' },
  { id: 'map', label: '🗺️ Map' },
] as const

type StageTab = (typeof STAGE_TABS)[number]['id']

export function MainStage() {
  // The scene of where you are is the main view; the map (for planning and clicking) is one tab away.
  const [tab, setTab] = useState<StageTab>('scene')

  return (
    <Panel
      title={tab === 'map' ? 'Map of Goa' : 'Where you are'}
      ariaLabel="Map and scenes"
      className="main-stage"
      actions={<TabBar tabs={STAGE_TABS} activeId={tab} onChange={setTab} ariaLabel="Main view" />}
    >
      <div className={`main-stage__body main-stage__body--${tab}`}>
        {/* The last action's result and any offer waiting for an answer. Other news arrives as toasts. */}
        <div className="main-stage__news">
          <NoticeBanner />
          <LocalHelpOfferCard />
        </div>
        {/* Keyed by tab, so switching views fades the new one in. */}
        <div key={tab} className="stage-view">
          {tab === 'map' ? <WorldMap /> : <LocationScene />}
        </div>
      </div>
    </Panel>
  )
}
