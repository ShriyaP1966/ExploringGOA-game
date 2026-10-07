import { useEffect, useState } from 'react'
import { EVENTS } from '../../data/events'
import { ITEMS } from '../../data/items'
import { LOCATIONS, LOCATION_IDS } from '../../data/locations'
import { formatClock } from '../../engine/clock'
import { gateReason } from '../../engine/commands'
import { DAY_START_MINUTE, ENERGY_MAX, GAME_CONFIG } from '../../engine/config'
import { LATEST_JUMP_MINUTE, planJump, planSetEnergy, planSetMoney, type DevPlan } from '../../engine/devTools'
import { isLocationDiscovered } from '../../engine/locations'
import { gameReducer } from '../../engine/reducer'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import type { EventId, GameAction } from '../../types'
import { formatRupees } from '../format'
import { Button } from '../ui/Button'

/** Ctrl+Shift+D (any case, any keyboard layout's D key). */
const isToggle = (e: KeyboardEvent) => e.ctrlKey && e.shiftKey && !e.altKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')

const toTimeInput = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const fromTimeInput = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/**
 * Hidden developer panel for testing and recording. Opens with Ctrl+Shift+D and is never rendered
 * otherwise. Everything it does is ordinary game actions sent through the same reducer as play.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isToggle(e)) {
        e.preventDefault() // the browser's own Ctrl+Shift+D (bookmark all tabs)
        e.stopPropagation()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return open ? <DevPanelBody onClose={() => setOpen(false)} /> : null
}

function DevPanelBody({ onClose }: { onClose: () => void }) {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const [day, setDay] = useState(state.clock.day)
  const [time, setTime] = useState(toTimeInput(Math.max(DAY_START_MINUTE, Math.min(LATEST_JUMP_MINUTE, state.clock.minuteOfDay))))
  const [money, setMoney] = useState(String(state.player.money))
  const [energy, setEnergy] = useState(String(state.player.energy))
  const [itemId, setItemId] = useState(Object.keys(ITEMS)[0])
  const [quantity, setQuantity] = useState('1')
  const [eventId, setEventId] = useState<EventId>(EVENTS[0].id)
  const [result, setResult] = useState<string | null>(null)

  /** Sends the actions, and reports what the rules made of them (the same pure reducer, run ahead). */
  const send = (label: string, plan: DevPlan) => {
    if (!plan.ok) return setResult(`✗ ${label}: ${plan.reason}`)
    if (plan.actions.length === 0) return setResult(`✓ ${label}: nothing to change.`)
    const after = plan.actions.reduce(gameReducer, state)
    plan.actions.forEach((action) => dispatch(action))
    const refused = after.lastAction && !after.lastAction.ok ? after.lastAction.reason : after === state ? gateReason(state) : null
    setResult(
      refused
        ? `✗ ${label}: ${refused}`
        : `✓ ${label} · ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'}: ${[...new Set(plan.actions.map((a) => a.type))].join(', ')}`,
    )
  }
  const one = (action: GameAction): DevPlan => ({ ok: true, actions: [action] })

  const undiscovered = LOCATION_IDS.filter((id) => !isLocationDiscovered(state, id))
  const blocked = gateReason(state)

  return (
    <aside className="dev-panel" aria-label="Developer panel">
      <header className="dev-panel__header">
        <strong>🛠️ Developer panel</strong>
        <button type="button" className="dev-panel__close" onClick={onClose} aria-label="Close developer panel">
          ✕
        </button>
      </header>
      <p className="dev-panel__note">
        Ctrl+Shift+D to hide · real game actions only · Day {state.clock.day}, {formatClock(state.clock.minuteOfDay)} ·{' '}
        {formatRupees(state.player.money)} · ⚡{state.player.energy} · {state.phase}
      </p>
      {blocked && <p className="dev-panel__warning">⚠️ {blocked} Only the jump works until then.</p>}

      <section className="dev-panel__row">
        <label>
          Day
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: GAME_CONFIG.tripDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time
          <input
            type="time"
            value={time}
            min={toTimeInput(DAY_START_MINUTE)}
            max={toTimeInput(LATEST_JUMP_MINUTE)}
            step={300}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <Button size="sm" onClick={() => send(`Jump to Day ${day}, ${time}`, planJump(state, day, fromTimeInput(time)))}>
          Jump
        </Button>
      </section>

      <section className="dev-panel__row">
        <label>
          Money ₹
          <input type="number" min={0} step={100} value={money} onChange={(e) => setMoney(e.target.value)} />
        </label>
        <Button size="sm" onClick={() => send(`Money ₹${money}`, planSetMoney(state, Number(money)))}>
          Set
        </Button>
        <label>
          Energy
          <input type="number" min={0} max={ENERGY_MAX} value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </label>
        <Button size="sm" onClick={() => send(`Energy ${energy}`, planSetEnergy(state, Number(energy)))}>
          Set
        </Button>
      </section>

      <section className="dev-panel__row">
        <label>
          Item
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {Object.values(ITEMS).map((item) => (
              <option key={item.id} value={item.id}>
                {item.emoji} {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ×
          <input type="number" min={1} max={9} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <Button
          size="sm"
          onClick={() => send(`Give ${ITEMS[itemId].name}`, one({ type: 'ADD_ITEM', itemId, quantity: Number(quantity) }))}
        >
          Give
        </Button>
      </section>

      <section className="dev-panel__row">
        <label>
          Event
          <select value={eventId} onChange={(e) => setEventId(e.target.value as EventId)}>
            {EVENTS.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={() => send(`Trigger ${eventId}`, one({ type: 'FORCE_EVENT', eventId }))}>
          Trigger
        </Button>
      </section>

      <section className="dev-panel__row dev-panel__row--wrap">
        <span>Discover:</span>
        {undiscovered.length === 0 && <span className="dev-panel__muted">every place is discovered</span>}
        {undiscovered.map((id) => (
          <Button
            key={id}
            size="sm"
            variant="ghost"
            onClick={() => send(`Discover ${LOCATIONS[id].name}`, one({ type: 'DISCOVER_LOCATION', locationId: id }))}
          >
            {LOCATIONS[id].emoji} {LOCATIONS[id].name}
          </Button>
        ))}
        {undiscovered.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              send('Discover all', { ok: true, actions: undiscovered.map((id) => ({ type: 'DISCOVER_LOCATION', locationId: id })) })
            }
          >
            All
          </Button>
        )}
      </section>

      {result && (
        <p className="dev-panel__result" role="status">
          {result}
        </p>
      )}
    </aside>
  )
}
