import { describe, expect, it } from 'vitest'
import { HORIZON, mix, skyLook, SUNRISE, SUNSET } from './sky'

const h = (hour: number, minute = 0) => hour * 60 + minute

describe('the sky through the day', () => {
  it('blends colours smoothly', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('moves the sun along an arc: low in the morning, high at midday, at the horizon at sunset', () => {
    const morning = skyLook(h(9))
    const noon = skyLook(h(12, 30))
    const sunset = skyLook(SUNSET)
    expect(noon.sunY).toBeLessThan(morning.sunY)
    expect(morning.sunX).toBeLessThan(noon.sunX)
    expect(noon.sunX).toBeLessThan(sunset.sunX)
    expect(sunset.sunY).toBeCloseTo(HORIZON)
    expect(skyLook(h(21)).sunY).toBeGreaterThan(1) // gone
    expect(skyLook(SUNRISE).sunX).toBeCloseTo(0.08)
  })

  it('brings out the moon, stars and lamps only after dark', () => {
    for (const minute of [h(9), h(13), h(16)]) {
      expect(skyLook(minute)).toMatchObject({ moonOpacity: 0, starOpacity: 0, lamps: 0 })
    }
    expect(skyLook(h(21, 30))).toMatchObject({ moonOpacity: 1, starOpacity: 1, lamps: 1 })
  })

  it('warms at golden hour and cools at night', () => {
    expect(skyLook(h(13)).tintOpacity).toBe(0)
    expect(skyLook(h(18, 30)).tintOpacity).toBeGreaterThan(0.2)
    expect(skyLook(h(22)).tintOpacity).toBeGreaterThan(skyLook(h(18, 30)).tintOpacity)
  })

  it('gives valid colours for every minute of the game day', () => {
    for (let minute = h(9); minute <= h(22); minute += 7) {
      const look = skyLook(minute)
      for (const colour of [look.top, look.middle, look.horizon, look.seaFar, look.seaNear, look.glow, look.tint]) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })
})
