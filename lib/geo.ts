/**
 * Turning a GPS fix into "which of our homes is this?".
 *
 * Deliberately conservative: a match is a *suggestion* the user confirms, never
 * a silent assignment. Filing a jacket in the wrong house is worse than one
 * extra tap.
 */

export interface GeoPoint {
  lat: number
  lng: number
}

export interface GeoLocation extends Partial<GeoPoint> {
  id: string
  name: string
  emoji: string
  radius_m: number
}

const EARTH_RADIUS_M = 6_371_000

/** Great-circle distance in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface LocationMatch {
  location: GeoLocation
  distanceMeters: number
  /** Inside the location's declared radius. */
  withinRadius: boolean
}

/**
 * Closest configured location to a fix, with the ones that have no coordinates
 * skipped. Returns null when nothing has been geocoded yet.
 */
export function nearestLocation(
  point: GeoPoint,
  locations: readonly GeoLocation[],
): LocationMatch | null {
  let best: LocationMatch | null = null

  for (const location of locations) {
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') continue

    const distanceMeters = haversineMeters(point, {
      lat: location.lat,
      lng: location.lng,
    })

    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        location,
        distanceMeters,
        withinRadius: distanceMeters <= location.radius_m,
      }
    }
  }

  return best
}

export type LocationSuggestion =
  | { kind: 'confident'; match: LocationMatch }
  | { kind: 'nearby'; match: LocationMatch }
  | { kind: 'unknown'; nearest: LocationMatch | null }

/**
 * Three outcomes, each with different UI:
 *   confident — inside the radius; show a confirmable chip.
 *   nearby    — outside the radius but plausibly the same place (up to 4x the
 *               radius, capped at 2km); offer it, pre-selected but flagged.
 *   unknown   — open the location picker, offering "add a new home here".
 */
export function suggestLocation(
  point: GeoPoint,
  locations: readonly GeoLocation[],
): LocationSuggestion {
  const nearest = nearestLocation(point, locations)
  if (!nearest) return { kind: 'unknown', nearest: null }

  if (nearest.withinRadius) return { kind: 'confident', match: nearest }

  const slack = Math.min(nearest.location.radius_m * 4, 2_000)
  if (nearest.distanceMeters <= slack) return { kind: 'nearby', match: nearest }

  return { kind: 'unknown', nearest }
}

export function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} m`
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`
}
