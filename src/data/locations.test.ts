import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { LOCATIONS, LOCATION_IDS } from './locations'

const all = LOCATION_IDS.map((id) => LOCATIONS[id])

describe('location data', () => {
  it('has the five locations in the right regions', () => {
    const byRegion = (region: string) => all.filter((l) => l.region === region).map((l) => l.id)
    expect(byRegion('north')).toEqual(['baga', 'anjuna', 'vagator'])
    expect(byRegion('central')).toEqual(['fontainhas'])
    expect(byRegion('south')).toEqual(['palolem'])
  })

  it('keys every location by its own id', () => {
    for (const id of LOCATION_IDS) expect(LOCATIONS[id].id).toBe(id)
  })

  it('starts with only Baga discovered', () => {
    expect(all.filter((l) => l.startsDiscovered).map((l) => l.id)).toEqual(['baga'])
  })

  it('hides only Palolem behind a clue', () => {
    expect(all.filter((l) => l.revealedByClue).map((l) => l.id)).toEqual(['palolem'])
    expect(LOCATIONS.palolem.revealedByClue).toBe('palolem-clue')
  })

  it('gives every location at least three valid activities', () => {
    for (const location of all) {
      expect(location.activities.length).toBeGreaterThanOrEqual(3)
      for (const activity of location.activities) {
        expect(activity.cost).toBeGreaterThanOrEqual(0)
        expect(activity.minutes).toBeGreaterThan(0)
        expect(activity.xp).toBeGreaterThan(0)
        expect(Math.abs(activity.energy)).toBeLessThanOrEqual(30)
      }
    }
  })

  it('uses unique activity ids across all locations', () => {
    const ids = all.flatMap((l) => l.activities.map((a) => a.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only gives or requires items that exist', () => {
    for (const activity of all.flatMap((l) => l.activities)) {
      if (activity.givesItemId) expect(ITEMS[activity.givesItemId]).toBeDefined()
      if (activity.requiresItemId) expect(ITEMS[activity.requiresItemId]).toBeDefined()
    }
  })

  it('gives every location a map hint that does not name it', () => {
    for (const location of all) {
      expect(location.mapHint.length).toBeGreaterThan(10)
      expect(location.mapHint).not.toContain(location.name.split(' ')[0])
    }
  })

  it('offers a paid meal wherever food is available, and none where it is not', () => {
    const hasMeal = (id: (typeof LOCATION_IDS)[number]) =>
      LOCATIONS[id].activities.some((a) => a.meal && a.cost > 0)
    for (const location of all) expect(hasMeal(location.id)).toBe(location.hasFood)
  })

  it('makes Palolem the most relaxing and Baga the most crowded', () => {
    expect(LOCATIONS.palolem.relaxation).toBe(5)
    expect(Math.max(...all.map((l) => l.crowd))).toBe(LOCATIONS.baga.crowd)
  })
})
