import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  haversineMeters,
  nearestLocation,
  suggestLocation,
  type GeoLocation,
} from './geo'

const SINGAPORE = { lat: 1.3521, lng: 103.8198 }
const BALI = { lat: -8.4095, lng: 115.1889 }

const homes: GeoLocation[] = [
  { id: 'sg', name: 'Singapore flat', emoji: '🏙️', radius_m: 150, ...SINGAPORE },
  { id: 'bali', name: 'Bali villa', emoji: '🌴', radius_m: 300, ...BALI },
  { id: 'nowhere', name: 'Not geocoded yet', emoji: '📦', radius_m: 150 },
]

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(SINGAPORE, SINGAPORE)).toBe(0)
  })

  it('matches the known Singapore–Bali distance (~1663 km) to within 1%', () => {
    const km = haversineMeters(SINGAPORE, BALI) / 1000
    expect(km).toBeGreaterThan(1646)
    expect(km).toBeLessThan(1680)
  })

  it('is symmetric', () => {
    expect(haversineMeters(SINGAPORE, BALI)).toBeCloseTo(
      haversineMeters(BALI, SINGAPORE),
      6,
    )
  })
})

describe('nearestLocation', () => {
  it('picks the closer home', () => {
    expect(nearestLocation(SINGAPORE, homes)?.location.id).toBe('sg')
    expect(nearestLocation(BALI, homes)?.location.id).toBe('bali')
  })

  it('skips locations without coordinates', () => {
    const onlyUngeocoded = [homes[2]]
    expect(nearestLocation(SINGAPORE, onlyUngeocoded)).toBeNull()
  })

  it('returns null when there are no locations at all', () => {
    expect(nearestLocation(SINGAPORE, [])).toBeNull()
  })
})

describe('suggestLocation', () => {
  it('is confident when standing inside the radius', () => {
    const result = suggestLocation({ lat: 1.35215, lng: 103.81985 }, homes)
    expect(result.kind).toBe('confident')
  })

  it('offers a nearby match just outside the radius', () => {
    // ~400m north of the Singapore flat, radius 150m, slack 600m.
    const result = suggestLocation({ lat: 1.3557, lng: 103.8198 }, homes)
    expect(result.kind).toBe('nearby')
  })

  it('gives up rather than guessing when far from every home', () => {
    const result = suggestLocation({ lat: 48.8566, lng: 2.3522 }, homes)
    expect(result.kind).toBe('unknown')
    // ...but still reports what the closest home was, for the UI copy.
    expect(result.kind === 'unknown' && result.nearest?.location.id).toBe('sg')
  })

  it('is unknown when nothing has coordinates', () => {
    const result = suggestLocation(SINGAPORE, [homes[2]])
    expect(result).toEqual({ kind: 'unknown', nearest: null })
  })
})

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(240.4)).toBe('240 m')
  })

  it('uses one decimal for short distances', () => {
    expect(formatDistance(1500)).toBe('1.5 km')
  })

  it('drops the decimal for long distances', () => {
    expect(formatDistance(1_600_000)).toBe('1600 km')
  })
})
