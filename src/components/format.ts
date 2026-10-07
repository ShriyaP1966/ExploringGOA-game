import { LOCATION_IDS } from '../data/locations'
import { GAME_CONFIG, STARTING_VALUES } from '../engine/config'

export function formatRupees(amount: number): string {
  return `₹ ${amount.toLocaleString('en-IN')}`
}

/**
 * Fills placeholders in game text from the real configuration, so text never goes out of date:
 * {startMoney} → "₹5,000", {tripDays} → "3", {placeCount} → "5".
 */
export function fillTemplate(text: string): string {
  return text
    .replaceAll('{startMoney}', `₹${STARTING_VALUES.money.toLocaleString('en-IN')}`)
    .replaceAll('{tripDays}', String(GAME_CONFIG.tripDays))
    .replaceAll('{placeCount}', String(LOCATION_IDS.length))
}
