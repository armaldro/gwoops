/**
 * Location colours.
 *
 * Each home gets one colour, used consistently in chips, charts, timelines and
 * labels — so "where is this?" is answerable at a glance rather than by
 * reading. Values live in app/globals.css so they adapt to dark mode.
 */

export const LOCATION_COLORS = [
  'clay', 'sage', 'indigo', 'plum', 'ochre', 'teal',
] as const

export type LocationColor = (typeof LOCATION_COLORS)[number]

export function locationColorVar(color: string | null | undefined): string {
  const safe = (LOCATION_COLORS as readonly string[]).includes(color ?? '')
    ? color
    : 'clay'
  return `var(--loc-${safe})`
}

/** Next unused colour, so two homes never share one until all six are taken. */
export function nextLocationColor(used: readonly string[]): LocationColor {
  return LOCATION_COLORS.find((c) => !used.includes(c)) ?? LOCATION_COLORS[0]
}
