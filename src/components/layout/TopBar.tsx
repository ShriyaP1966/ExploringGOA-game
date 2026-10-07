import { useCallback, useState } from 'react'
import { LOCATIONS } from '../../data/locations'
import { formatClock, skyPhase } from '../../engine/clock'
import { ENERGY_MAX, GAME_CONFIG } from '../../engine/config'
import { dayInfo } from '../../engine/days'
import { levelInfo, xpProgress } from '../../engine/player'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { SkyPhase } from '../../types'
import { StatFloats } from '../feedback/StatFloats'
import { LogoMark } from '../brand/Logo'
import { HowToPlay } from '../help/HowToPlay'
import { formatRupees } from '../format'
import { skyLook } from '../scene/sky'
import { Button } from '../ui/Button'

const SKY_NAME: Record<SkyPhase, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  golden: 'Golden hour',
  sunset: 'Sunset',
  dusk: 'Dusk',
  night: 'Night',
}

/** A little dial: the sun (or moon) on its arc over the horizon. */
function SkyDial({ minuteOfDay }: { minuteOfDay: number }) {
  const look = skyLook(minuteOfDay)
  const night = look.moonOpacity > 0.5
  const x = 4 + look.sunX * 32
  const y = 4 + Math.min(1, look.sunY) * 22
  return (
    <svg className="hud-dial" viewBox="0 0 40 26" aria-hidden="true">
      <defs>
        <linearGradient id="hud-dial-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.top} />
          <stop offset="1" stopColor={look.horizon} />
        </linearGradient>
      </defs>
      <rect width="40" height="26" rx="8" fill="url(#hud-dial-sky)" />
      <path d="M4 20 Q20 0 36 20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="2 2" />
      {night ? (
        <g>
          <circle cx="28" cy="9" r="4.5" fill="#f4f1de" />
          <circle cx="30" cy="8" r="4" fill={look.top} />
        </g>
      ) : (
        <circle cx={x} cy={Math.min(y, 19)} r="4" fill={look.sunColor} stroke="#fff6d6" strokeWidth="1" />
      )}
      <rect y="20" width="40" height="6" fill={look.seaNear} opacity="0.85" />
    </svg>
  )
}

/** The game-style heads-up display: day, time, place, money, energy and level at a glance. */
export function TopBar() {
  const { clock, currentLocationId, phase, activeEvent, player } = useGameState()
  const dispatch = useGameDispatch()
  const [helpOpen, setHelpOpen] = useState(false)
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const location = LOCATIONS[currentLocationId]
  const day = dayInfo(clock.day)
  const level = levelInfo(player.level)
  const xp = xpProgress(player.xp)
  const energyPct = (player.energy / ENERGY_MAX) * 100
  const energyTone = player.energy <= 20 ? 'low' : player.energy <= 50 ? 'mid' : 'high'

  return (
    <header className="hud" aria-label="Trip status">
      <div className="hud__brand">
        <LogoMark size={40} className="hud__logo" />
        <div className="hud__brand-text">
          <h1 className="hud__title">{GAME_CONFIG.displayName}</h1>
          <span className="hud__day-title">
            {day.emoji} {day.title}
          </span>
        </div>
      </div>

      <div className="hud__chips">
        <div className="hud-chip" title={`Day ${clock.day} of ${GAME_CONFIG.tripDays}`}>
          <span className="hud-chip__label">Day</span>
          <span className="hud-pips" aria-label={`Day ${clock.day} of ${GAME_CONFIG.tripDays}`}>
            {Array.from({ length: GAME_CONFIG.tripDays }, (_, i) => (
              <span key={i} className={`hud-pip ${i + 1 < clock.day ? 'hud-pip--done' : i + 1 === clock.day ? 'hud-pip--now' : ''}`} />
            ))}
          </span>
          <span className="hud-chip__value">
            {clock.day}/{GAME_CONFIG.tripDays}
          </span>
        </div>

        <div className="hud-chip">
          <SkyDial minuteOfDay={clock.minuteOfDay} />
          <span className="hud-chip__stack">
            <span className="hud-chip__value">{formatClock(clock.minuteOfDay)}</span>
            <span className="hud-chip__label">{SKY_NAME[skyPhase(clock.minuteOfDay)]}</span>
          </span>
        </div>

        <div className="hud-chip hud-chip--place" title={location.name}>
          <span className="hud-icon" aria-hidden="true">
            {location.emoji}
          </span>
          <span className="hud-chip__value">{location.name}</span>
        </div>

        <div className="hud-chip hud-chip--money" title="Money">
          <span className="hud-coin" aria-hidden="true">
            ₹
          </span>
          <span className="hud-chip__value">{formatRupees(player.money).replace('₹', '').trim()}</span>
          <span className="visually-hidden">rupees</span>
          <StatFloats stat="money" />
        </div>

        <div className="hud-chip hud-chip--energy" title="Energy">
          <span className="hud-icon hud-icon--bolt" aria-hidden="true">
            ⚡
          </span>
          <span
            className="hud-bar"
            role="meter"
            aria-label="Energy"
            aria-valuenow={player.energy}
            aria-valuemin={0}
            aria-valuemax={ENERGY_MAX}
          >
            <span className={`hud-bar__fill hud-bar__fill--${energyTone}`} style={{ width: `${energyPct}%` }} />
          </span>
          <span className="hud-chip__value hud-chip__value--small">{player.energy}</span>
          <StatFloats stat="energy" />
        </div>

        <div className="hud-chip hud-chip--level" title={level.perk}>
          <span className="hud-badge" aria-hidden="true">
            {level.emoji}
          </span>
          <span className="hud-chip__stack">
            <span className="hud-chip__value">{level.title}</span>
            <span
              className="hud-bar hud-bar--xp"
              role="meter"
              aria-label={`${player.xp} XP`}
              aria-valuenow={xp.isMaxLevel ? 1 : xp.intoLevel}
              aria-valuemin={0}
              aria-valuemax={xp.isMaxLevel ? 1 : xp.levelSpan}
            >
              <span className="hud-bar__fill hud-bar__fill--xp" style={{ width: `${xp.isMaxLevel ? 100 : (xp.intoLevel / xp.levelSpan) * 100}%` }} />
            </span>
          </span>
          <span className="hud-chip__label">{player.xp} XP</span>
          <StatFloats stat="xp" />
        </div>

        <button type="button" className="hud-help" onClick={() => setHelpOpen(true)} aria-label="How to play" title="How to play">
          ?
        </button>

        <Button
          size="sm"
          variant="sunset"
          className="hud__end-day"
          disabled={phase !== 'playing' || activeEvent !== null}
          onClick={() => dispatch({ type: 'END_DAY' })}
        >
          🌙 End day
        </Button>
      </div>
      {helpOpen && <HowToPlay onClose={closeHelp} />}
    </header>
  )
}
