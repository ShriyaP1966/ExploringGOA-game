import { describe, expect, it } from 'vitest'
import type { GameAction, GameState } from '../types'
import { planJump, planSetEnergy, planSetMoney } from './devTools'
import { createInitialState } from './initialState'
import { gameReducer } from './reducer'
import { parseSave, SAVE_VERSION, serializeGame } from './save'

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
const played = () =>
  run(
    createInitialState(11),
    { type: 'BEGIN_DAY' },
    { type: 'TRAVEL', to: 'anjuna', mode: 'walk' },
    { type: 'DO_ACTIVITY', activityId: 'anjuna-flea-market' },
  )

describe('autosave', () => {
  it('a saved game loads back exactly, and play continues the same way', () => {
    const state = played()
    const file = parseSave(serializeGame(state, 1234))
    expect(file).toMatchObject({ version: SAVE_VERSION, savedAt: 1234 })
    const loaded = run(createInitialState(99), { type: 'LOAD_GAME', state: file!.state })
    expect(loaded).toEqual({ ...state, notice: null, levelUp: null, newMemoryIds: [], questUpdates: [] })
    // Same seed and state, same future.
    const next: GameAction = { type: 'TRAVEL', to: 'vagator', mode: 'walk' }
    expect(run(loaded, next).player).toEqual(run(state, next).player)
  })

  it('loads from any screen, even while an event waits', () => {
    const saved = played()
    const busy = run(createInitialState(), { type: 'BEGIN_DAY' }, { type: 'FORCE_EVENT', eventId: 'sudden-shower' })
    expect(run(busy, { type: 'LOAD_GAME', state: saved }).currentLocationId).toBe('anjuna')
    expect(run(createInitialState(), { type: 'LOAD_GAME', state: saved }).phase).toBe('playing')
  })

  it.each([
    ['nothing saved', null],
    ['not JSON', '{oops'],
    ['another version', JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 1, state: createInitialState() })],
    ['no state', JSON.stringify({ version: SAVE_VERSION, savedAt: 1 })],
    ['an unknown place', serializeGame({ ...createInitialState(), currentLocationId: 'atlantis' as never }, 1)],
    ['negative money', serializeGame({ ...createInitialState(), player: { ...createInitialState().player, money: -5 } }, 1)],
    ['day 9', serializeGame({ ...createInitialState(), clock: { day: 9, minuteOfDay: 600 } }, 1)],
    ['a strange phase', serializeGame({ ...createInitialState(), phase: 'party' as never }, 1)],
  ])('ignores a save with %s', (_label, text) => {
    expect(parseSave(text)).toBeNull()
  })

  it('fills in fields added after the save was made', () => {
    const { scoreBonuses: _dropped, ...older } = played()
    const file = parseSave(JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: older }))
    expect(file?.state.scoreBonuses).toEqual([])
    expect(file?.state.currentLocationId).toBe('anjuna')
  })
})

describe('developer tools plan real game actions', () => {
  const day1 = () => run(createInitialState(5), { type: 'BEGIN_DAY' })

  it('jumps forward to a day and time through the normal day cycle', () => {
    const plan = planJump(day1(), 3, 15 * 60 + 30)
    expect(plan.ok && plan.actions.map((a) => a.type)).toEqual([
      'END_DAY', 'CONTINUE_AFTER_SUMMARY', 'BEGIN_DAY', 'END_DAY', 'CONTINUE_AFTER_SUMMARY', 'BEGIN_DAY', 'ADVANCE_TIME',
    ])
    const after = run(day1(), ...(plan.ok ? plan.actions : []))
    expect(after).toMatchObject({ phase: 'playing', clock: { day: 3, minuteOfDay: 15 * 60 + 30 } })
    expect(after.daySummaries).toHaveLength(2)
  })

  it('jumps later on the same day by letting time pass', () => {
    const plan = planJump(day1(), 1, 13 * 60)
    expect(plan).toEqual({ ok: true, actions: [{ type: 'ADVANCE_TIME', minutes: 4 * 60 }] })
  })

  it('starts from the title or intro screens too', () => {
    const plan = planJump(createInitialState(), 2, 10 * 60)
    const after = run(createInitialState(), ...(plan.ok ? plan.actions : []))
    expect(after.clock).toEqual({ day: 2, minuteOfDay: 10 * 60 })
  })

  it('going back in time starts a fresh trip (time never runs backwards)', () => {
    const late = run(day1(), { type: 'ADVANCE_TIME', minutes: 8 * 60 })
    const plan = planJump(late, 1, 10 * 60)
    expect(plan.ok && plan.actions[0]).toEqual({ type: 'RESET_GAME' })
    const after = run(late, ...(plan.ok ? plan.actions : []))
    expect(after.clock).toEqual({ day: 1, minuteOfDay: 10 * 60 })
    expect(after.phase).toBe('playing')
  })

  it('refuses impossible targets and a waiting event, with a reason', () => {
    expect(planJump(day1(), 4, 600)).toEqual({ ok: false, reason: 'Choose a day from 1 to 3.' })
    expect(planJump(day1(), 2, 22 * 60)).toMatchObject({ ok: false, reason: expect.stringMatching(/9:00 AM to 9:59 PM/) })
    const busy = run(day1(), { type: 'FORCE_EVENT', eventId: 'scooter-trouble' })
    expect(planJump(busy, 2, 600)).toEqual({ ok: false, reason: 'An event is waiting: choose an option first.' })
  })

  it('sets money and energy with the real money and energy rules', () => {
    const down = planSetMoney(day1(), 1200)
    expect(down).toEqual({ ok: true, actions: [{ type: 'SPEND_MONEY', amount: 3800 }] })
    const up = planSetMoney(day1(), 9000)
    expect(up).toEqual({ ok: true, actions: [{ type: 'RECEIVE_MONEY', amount: 4000 }] })
    const rich = run(day1(), ...(up.ok ? up.actions : []))
    expect(rich.player.money).toBe(9000)
    expect(rich.player.stats.moneySpent).toBe(0) // receiving money is not spending
    expect(planSetMoney(day1(), -1).ok).toBe(false)

    const tired = planSetEnergy(day1(), 25)
    expect(run(day1(), ...(tired.ok ? tired.actions : [])).player.energy).toBe(25)
    expect(planSetEnergy(day1(), 101).ok).toBe(false)
    expect(planSetEnergy(day1(), 100)).toEqual({ ok: true, actions: [] })
  })

  it('the rules still apply: nothing changes outside play', () => {
    const intro = createInitialState()
    const plan = planSetMoney(intro, 100)
    expect(run(intro, ...(plan.ok ? plan.actions : []))).toBe(intro)
  })
})
