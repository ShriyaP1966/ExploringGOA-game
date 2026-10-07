import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { LOCATIONS } from '../../data/locations'
import { formatClock } from '../../engine/clock'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { describeBudget, describeConstraint, MAX_COMMAND_LENGTH, parseCommand } from '../../parser'
import type { CommandChanges, CommandOutcome, CommandRecord, GameClock } from '../../types'
import { formatRupees } from '../format'
import { VOICE_FILL_EVENT } from './fillVoiceInput'

const EMPTY = '—'

const OUTCOME_LABEL: Record<CommandOutcome, string> = {
  success: '✅ Done',
  refused: '⛔ Refused',
  answered: '💬 Answer',
  'not-understood': "❓ Didn't understand",
}

const when = (clock: GameClock) => `Day ${clock.day} · ${formatClock(clock.minuteOfDay)}`

/** Elements that legitimately take typing focus away from the voice input. */
function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

function signed(n: number, unit = ''): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${unit}${Math.abs(n).toLocaleString('en-IN')}`
}

function ChangeList({ changes }: { changes: CommandChanges }) {
  const { location, money, energy, time, quests, discoveries } = changes
  const rows: { label: string; text: string | null }[] = [
    {
      label: '📍 Location',
      text: location && `${LOCATIONS[location.from].name} → ${LOCATIONS[location.to].name}`,
    },
    { label: '💰 Money', text: money && `${formatRupees(money.to)} (${signed(money.to - money.from, '₹')})` },
    { label: '⚡ Energy', text: energy && `${energy.to} (${signed(energy.to - energy.from)})` },
    { label: '🕘 Time', text: time && `${when(time.from)} → ${when(time.to)}` },
    { label: '📜 Quests', text: quests.length ? quests.join(' · ') : null },
    { label: '🗺️ Discoveries', text: discoveries.length ? discoveries.join(' · ') : null },
  ]
  return (
    <ul className="voice-changes">
      {rows.map((row) => (
        <li key={row.label} className={row.text ? 'voice-changes__changed' : 'voice-changes__unchanged'}>
          {row.label}: {row.text ?? 'no change'}
        </li>
      ))}
    </ul>
  )
}

/** A brief "thinking" mark shown while a section is about to appear (decorative). */
function Thinking() {
  return (
    <span className="voice-thinking" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

/**
 * The three result sections. For a new command they reveal one after another (said → understood →
 * happened) in well under a second; the text is in the page from the start, so screen readers get it at once.
 */
function Results({ record, reveal }: { record: CommandRecord; reveal: boolean }) {
  const { parsed } = record
  return (
    <div className={`voice-results ${reveal ? 'voice-results--reveal' : ''}`} aria-live="polite">
      <section className="voice-section voice-section--said" aria-label="What you said">
        <h3 className="voice-section__title">🗣️ What you said</h3>
        <p className="voice-section__quote">“{parsed.raw}”</p>
        <p className="voice-section__meta">{when(record.at)}</p>
      </section>

      <section className="voice-section voice-section--understood" aria-label="What the game understood">
        {reveal && <Thinking />}
        <h3 className="voice-section__title">🧠 What the game understood</h3>
        {record.notes.map((note) => (
          <p key={note} className="voice-section__note voice-section__note--first">
            ℹ️ {note}
          </p>
        ))}
        <dl className="voice-fields">
          <dt>Intent</dt>
          <dd>
            {parsed.intent}
            {parsed.alternatives.length > 1 && (
              <span className="voice-fields__alt">
                {' '}
                (next: {parsed.alternatives[1].intent} {parsed.alternatives[1].score})
              </span>
            )}
          </dd>
          <dt>Destination</dt>
          <dd>{parsed.destination ? LOCATIONS[parsed.destination].name : EMPTY}</dd>
          <dt>Travel by</dt>
          <dd>{parsed.travelMode ?? EMPTY}</dd>
          <dt>Budget</dt>
          <dd>{parsed.budget ? describeBudget(parsed.budget) : EMPTY}</dd>
          <dt>Mood</dt>
          <dd>{parsed.moods.length ? parsed.moods.join(', ') : EMPTY}</dd>
          <dt>Activity</dt>
          <dd>{parsed.activities.length ? parsed.activities.join(', ') : EMPTY}</dd>
          <dt>Constraints</dt>
          <dd>{parsed.constraints.length ? parsed.constraints.map(describeConstraint).join(', ') : EMPTY}</dd>
          <dt>Parser</dt>
          <dd>
            {parsed.parser} · {Math.round(parsed.confidence * 100)}% sure
          </dd>
        </dl>
      </section>

      <section className="voice-section voice-section--happened" aria-label="What happened">
        {reveal && <Thinking />}
        <h3 className="voice-section__title">
          ⚡ What happened{' '}
          <span className={`voice-outcome voice-outcome--${record.outcome}`}>{OUTCOME_LABEL[record.outcome]}</span>
        </h3>
        <p className="voice-section__result">{record.result}</p>
        {record.actions.length > 0 && (
          <p className="voice-section__meta">Engine ran: {record.actions.join(' → ')}</p>
        )}
        <ChangeList changes={record.changes} />
      </section>
    </div>
  )
}

/**
 * The heart of the game: one always-focused input for typing or dictating (e.g. with Wispr Flow).
 * It only parses and dispatches a COMMAND; the engine decides what happens.
 */
export function VoicePanel() {
  const state = useGameState()
  const { commandLog, phase, activeEvent } = state
  const dispatch = useGameDispatch()
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))

  // Keep the input focused: on load, after any click or button press elsewhere, when the window
  // regains focus, and whenever focus would otherwise land on nothing (e.g. the focused button
  // disappeared with its overlay). Keyboard users who Tab to a control are left alone until they use it.
  useEffect(() => {
    focusInput()
    const input = inputRef.current
    const onClick = (e: MouseEvent) => {
      if (!isTextField(e.target)) focusInput()
    }
    const onBlur = (e: FocusEvent) => {
      if (e.relatedTarget === null) focusInput()
    }
    const onFocusOut = (e: FocusEvent) => {
      // A focused control elsewhere was removed or blurred into nothing: come back to the input.
      if (e.target !== input && e.relatedTarget === null) focusInput()
    }
    // Escape closes overlays without a click, so it also brings focus back here.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTextField(document.activeElement)) focusInput()
    }
    // An example clicked in How to play: put it in the box, ready to send.
    const onFill = (e: Event) => {
      setText((e as CustomEvent<string>).detail)
      focusInput()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keyup', onKey)
    input?.addEventListener('blur', onBlur)
    window.addEventListener('focus', focusInput)
    window.addEventListener(VOICE_FILL_EVENT, onFill)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keyup', onKey)
      input?.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', focusInput)
      window.removeEventListener(VOICE_FILL_EVENT, onFill)
    }
  }, [])

  // ...and whenever a new screen or popup appears, or a command finishes.
  useEffect(() => {
    focusInput()
  }, [phase, activeEvent, commandLog.length])

  // Overlays stop just above the panel; tell them how tall it is.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const update = () =>
      document.documentElement.style.setProperty(
        '--voice-panel-height',
        `${Math.max(0, window.innerHeight - panel.getBoundingClientRect().top)}px`,
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    // The parser may read (never change) a little game context, so the same words can mean different things.
    const context = {
      currentLocationId: state.currentLocationId,
      pendingQuestion: state.activeEvent !== null || state.pendingHelp !== null,
      hasScooterToday: state.scooterRentedOnDay === state.clock.day,
    }
    dispatch({ type: 'COMMAND', command: parseCommand(text, context) })
    setText('')
    setSelectedId(null) // show the newest result
    focusInput()
  }

  const latest = commandLog[commandLog.length - 1]
  const shown = commandLog.find((c) => c.id === selectedId) ?? latest

  return (
    <section ref={panelRef} className="voice-panel" aria-label="Voice and text commands">
      <form className="voice-panel__form" onSubmit={submit}>
        <span className="voice-panel__mic" aria-hidden="true" title="Dictate with Wispr Flow, or type">
          🎙️
        </span>
        <input
          ref={inputRef}
          className="voice-panel__input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say or type what you want to do, then press Enter… e.g. “take a scooter to Anjuna before sunset”"
          aria-label="Command: say or type what you want to do, then press Enter"
          autoComplete="off"
          maxLength={MAX_COMMAND_LENGTH}
          spellCheck={false}
        />
      </form>

      {shown ? (
        // A new command replays the reveal; picking an older one from the history just shows it.
        <Results key={shown.id} record={shown} reveal={selectedId === null && shown.id === latest?.id} />
      ) : (
        <p className="voice-panel__hint">
          The input is always ready: dictate with Wispr Flow or type, then press Enter. You'll see what you said, what the
          game understood, and what happened.
        </p>
      )}

      {commandLog.length > 0 && (
        <div className="voice-history" aria-label="Recent commands">
          <span className="voice-history__label">Recent:</span>
          {[...commandLog].reverse().map((record) => (
            <button
              key={record.id}
              type="button"
              className={`voice-history__item ${record.id === shown?.id ? 'voice-history__item--selected' : ''}`}
              onClick={() => setSelectedId(record.id)}
              title={record.parsed.raw}
            >
              {record.parsed.raw}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
