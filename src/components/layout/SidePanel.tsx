import { LOCATION_IDS } from '../../data/locations'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { MemoriesPanel } from '../memories/MemoriesPanel'
import { QuestLogPanel } from '../quests/QuestLogPanel'
import { GAME_CONFIG } from '../../engine/config'
import { levelInfo, xpProgress } from '../../engine/player'
import { hasScooterToday } from '../../engine/travel'
import { useGameState } from '../../hooks/useGame'
import { formatRupees } from '../format'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Panel } from '../ui/Panel'

interface MeterProps {
  label: string
  value: number
  max: number
  tone: 'palm' | 'sunset'
}

function Meter({ label, value, max, tone }: MeterProps) {
  return (
    <div className="meter">
      <div className="meter__label">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="meter__track" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  )
}

export function SidePanel() {
  const state = useGameState()
  const { player } = state
  const scooter = hasScooterToday(state)
  const xp = xpProgress(player.xp)
  const level = levelInfo(player.level)
  const nextLevel = levelInfo(Math.min(player.level + 1, GAME_CONFIG.maxLevel))

  return (
    <Panel title="Your trip" className="side-panel">
      <div className="side-panel__stack">
        {/* Money and energy live in the HUD; this card holds the details. */}
        <Card title="📊 Trip progress">
          <div className="stats">
            <div className="level-box">
              <div className="stats__row">
                <span className="level-box__title">
                  {level.emoji} {level.title}
                </span>
                <Badge tone="sunset">
                  Level {player.level} of {GAME_CONFIG.maxLevel}
                </Badge>
              </div>
              {xp.isMaxLevel ? (
                <div className="stats__row stats__row--small">
                  <span>✨ {player.xp} XP</span>
                  <span>Top level reached</span>
                </div>
              ) : (
                <Meter
                  label={`✨ ${player.xp} XP · next: ${nextLevel.title} at ${nextLevel.minXp}`}
                  value={xp.intoLevel}
                  max={xp.levelSpan}
                  tone="sunset"
                />
              )}
              <p className="level-box__perk">🎁 {level.perk}</p>
            </div>
            <div className="stats__row stats__row--small">
              <span>🗺️ Places discovered</span>
              <span>
                {player.stats.placesDiscovered} / {LOCATION_IDS.length}
              </span>
            </div>
            <div className="stats__row stats__row--small">
              <span>🛵 Distance traveled</span>
              <span>{player.stats.kmTraveled} km</span>
            </div>
            <div className="stats__row stats__row--small">
              <span>🔑 Scooter</span>
              <span>{scooter ? 'Rented for today' : 'Not rented'}</span>
            </div>
            <div className="stats__row stats__row--small">
              <span>🧾 Total spent</span>
              <span>{formatRupees(player.stats.moneySpent)}</span>
            </div>
          </div>
        </Card>

        <QuestLogPanel />

        <InventoryPanel />

        <MemoriesPanel />

      </div>
    </Panel>
  )
}
