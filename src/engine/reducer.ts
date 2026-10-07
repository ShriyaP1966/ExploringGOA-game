import type { ActionResult, DayEndReason, GameAction, GameState } from '../types'
import { doActivity } from './activities'
import { mapCommand, type MappedCommand } from './actionMapper'
import { changedForReal, gateReason, recordCommand } from './commands'
import { beginDay, continueAfterSummary, endDay, isDayOver, passTime } from './days'
import { forceEvent, maybeTriggerEvent, resolveEvent } from './events'
import { watchFinalSunset } from './finale'
import { createInitialState } from './initialState'
import { activateItem } from './items'
import { acceptHelp, askLocal, declineHelp } from './localHelp'
import { recordMoment } from './memories'
import { discoverLocation, findClue } from './locations'
import { addItem, addXp, changeEnergy, receiveMoney, recordMemory, spendMoney } from './player'
import { nextRandom } from './random'
import { updateQuests } from './quests'
import { rest } from './rest'
import { restoreGame } from './save'
import { rentScooter, travel } from './travel'

/** Actions that work outside the 'playing' phase (moving between days, restarting). */
const PHASE_ACTIONS = new Set<GameAction['type']>(['BEGIN_DAY', 'CONTINUE_AFTER_SUMMARY', 'RESET_GAME', 'LOAD_GAME'])

function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SPEND_MONEY':
      return spendMoney(state, action.amount)
    case 'RECEIVE_MONEY':
      return receiveMoney(state, action.amount)
    case 'CHANGE_ENERGY':
      return changeEnergy(state, action.delta)
    case 'ADVANCE_TIME':
      return passTime(state, action.minutes)
    case 'ADD_XP':
      return addXp(state, action.amount)
    case 'ADD_ITEM':
      return addItem(state, action.itemId, action.quantity)
    case 'RECORD_MEMORY':
      return recordMemory(state, action.memory)
    case 'RECORD_MOMENT':
      return recordMoment(state, action.moment)
    case 'DISCOVER_LOCATION':
      return discoverLocation(state, action.locationId)
    case 'FIND_CLUE':
      return findClue(state, action.clueId)
    case 'TRAVEL':
      return travel(state, action.to, action.mode)
    case 'RENT_SCOOTER':
      return rentScooter(state)
    case 'DO_ACTIVITY':
      return doActivity(state, action.activityId)
    case 'REST':
      return rest(state)
    case 'ASK_LOCAL':
      return askLocal(state)
    case 'ACCEPT_HELP':
      return acceptHelp(state)
    case 'DECLINE_HELP':
      return declineHelp(state)
    case 'CHOOSE_EVENT_OPTION':
      return resolveEvent(state, action.choiceId)
    case 'FORCE_EVENT':
      return forceEvent(state, action.eventId)
    case 'WATCH_FINAL_SUNSET':
      return watchFinalSunset(state)
    case 'USE_ITEM':
      return activateItem(state, action.itemId)
    case 'END_DAY':
      // Closed by gameReducer below, after the final quest check of the day.
      return state
    case 'BEGIN_DAY':
      return beginDay(state)
    case 'CONTINUE_AFTER_SUMMARY':
      return continueAfterSummary(state)
    case 'COMMAND':
      // Handled by gameReducer below: a command becomes zero or more ordinary actions.
      return state
    case 'RESET_GAME':
      // A new trip gets a new seed, so chance rolls differ from the last one.
      return createInitialState(nextRandom(state.rngSeed)[1])
    case 'LOAD_GAME':
      return restoreGame(action.state)
  }
}

/** The only way game state changes. Each action's notice replaces the previous one. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  // A spoken or typed command: the engine turns it into ordinary actions, runs them through these
  // same rules (so every check still applies), and records what really changed.
  if (action.type === 'COMMAND') {
    // Whatever was said, the game must never crash: a mapping error becomes a polite refusal.
    let mapped: MappedCommand
    try {
      mapped = mapCommand(state, action.command)
    } catch {
      mapped = { kind: 'refuse', reason: 'Sorry, something went wrong understanding that. Nothing changed.' }
    }
    let after = state
    const results: ActionResult[] = []
    for (const next of mapped.kind === 'actions' ? mapped.actions : []) {
      const before = after
      after = gameReducer(after, next)
      // An action the reducer ignored outright (wrong screen, waiting event) leaves the state untouched.
      const result =
        after === before
          ? { action: next.type, ok: false, reason: gateReason(before) ?? 'That is not possible right now.' }
          : (after.lastAction ?? { action: next.type, ok: true, reason: 'Done.' })
      results.push(result)
      if (!result.ok) break // stop at the first refusal
    }
    return recordCommand(state, after, action.command, mapped, results)
  }

  // Gameplay only happens while playing; intro, summary and ending screens accept only phase actions.
  if (state.phase !== 'playing' && !PHASE_ACTIONS.has(action.type)) return state
  // While an event is waiting, the game waits for the player's choice.
  if (state.activeEvent && !['CHOOSE_EVENT_OPTION', 'RESET_GAME', 'LOAD_GAME'].includes(action.type)) return state

  // Notices and level-ups describe the last action only.
  const fresh =
    state.notice === null && state.levelUp === null && state.newMemoryIds.length === 0 && state.questUpdates.length === 0
  const base = fresh ? state : { ...state, notice: null, levelUp: null, newMemoryIds: [], questUpdates: [] }
  // Quests are checked automatically after every action while playing (before the day can end, so
  // rewards count today). News from overnight appears once the next day begins.
  const applied = applyAction(base, action)
  // The action's own result, judged before quests and events react: did the engine allow it, and why.
  const ok = changedForReal(base, applied) || (action.type === 'END_DAY' && base.phase === 'playing')
  // A reset or a loaded save starts from exactly that state, with no new history.
  if (action.type === 'LOAD_GAME') return applied
  const acted: GameState =
    action.type === 'RESET_GAME'
      ? applied
      : { ...applied, lastAction: { action: action.type, ok, reason: applied.notice ?? (ok ? 'Done.' : 'Nothing happened.') } }
  const updated = acted.phase === 'playing' ? updateQuests(acted) : acted

  // At most one event may follow a successful trip or activity.
  const travelled = action.type === 'TRAVEL' && acted.tripLog.length > base.tripLog.length
  const didActivity = action.type === 'DO_ACTIVITY' && acted.completedActivities.length > base.completedActivities.length
  const next = travelled
    ? maybeTriggerEvent(updated, 'trip')
    : didActivity
      ? maybeTriggerEvent(updated, 'activity')
      : updated

  // Does this action close the day? The player ending it, the final sunset, or reaching 10 PM.
  const endReason: DayEndReason | null =
    next.phase !== 'playing' || next.activeEvent
      ? null
      : action.type === 'END_DAY'
        ? 'player'
        : next.ending === 'final-sunset'
          ? 'final-sunset'
          : isDayOver(next)
            ? 'curfew'
            : null
  if (!endReason) return next

  // One last quest check as the day closes (e.g. a road trip not finished in time), so it shows on the summary.
  const closing = updateQuests(next, { dayEnding: true })
  // The action's own news (e.g. the final sunset, quest results) comes first; otherwise the day's goodnight.
  const ended = endDay(closing, endReason)
  return { ...ended, notice: closing.notice ?? ended.notice }
}
