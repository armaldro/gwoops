/**
 * Balancing belongings across homes.
 *
 * This is deliberately plain TypeScript rather than something the model works
 * out in prose. Claude chooses the strategy, explains the result and handles
 * the judgement calls; the counting happens here, where it is deterministic
 * and testable.
 *
 * The core idea is stratification. "Twelve pairs of shoes, six each" is a bad
 * answer if one home gets every pair of boots and the other gets every sandal.
 * So items are grouped into strata by the attributes that actually matter for
 * that category (declared as `balanceBy` in lib/categories/schemas.ts), and
 * each stratum is balanced independently.
 */

import type { Attributes } from '@/lib/categories/schemas'

export interface DistributableItem {
  id: string
  name: string
  categorySlug: string
  locationId: string | null
  attributes: Attributes
  quantity: number
  /** Excluded from moves: in transit, on an active packing list, or user-pinned. */
  pinned?: boolean
  /** Items in the same bundle move together. */
  bundleId?: string | null
}

export interface DistributionTarget {
  id: string
  name: string
  /** Relative share of the total. Equal weights = an even split. */
  weight?: number
}

export interface DistributionOptions {
  /** Attribute keys to balance within. Defaults to the category's own. */
  balanceBy?: readonly string[]
  /**
   * How strongly to prefer leaving an item where it already is. 1 means a move
   * must make a stratum strictly better; 0 reshuffles freely.
   */
  inertia?: number
}

export interface Assignment {
  itemId: string
  name: string
  fromLocationId: string | null
  toLocationId: string
  stratum: string
  moved: boolean
  reason: string
}

export interface LocationTally {
  locationId: string
  name: string
  before: number
  after: number
  target: number
}

export interface DistributionResult {
  assignments: Assignment[]
  moves: Assignment[]
  perLocation: LocationTally[]
  /** Items that could not be placed, with why. */
  unplaceable: { itemId: string; name: string; reason: string }[]
  /** Facts for Claude to narrate. Never pre-written prose. */
  facts: {
    totalItems: number
    movableItems: number
    pinnedItems: number
    strata: { key: string; count: number; spread: Record<string, number> }[]
    /** Strata too small to divide evenly, e.g. one winter coat, two homes. */
    indivisibleStrata: string[]
  }
}

const UNSPECIFIED = '—'

/** Stable stratum key, e.g. "boots|winter". */
export function stratumKey(
  item: DistributableItem,
  balanceBy: readonly string[],
): string {
  if (balanceBy.length === 0) return 'all'
  return balanceBy
    .map((key) => {
      const value = item.attributes[key]
      if (value === undefined || value === '') return UNSPECIFIED
      // Multi-valued attributes (season: [summer, tropical]) collapse to their
      // first value so an item lands in exactly one stratum.
      return Array.isArray(value) ? (value[0] ?? UNSPECIFIED) : String(value)
    })
    .join('|')
}

/**
 * Largest-remainder apportionment: hand out `count` places across weighted
 * targets so the totals differ by at most one and the rounding does not
 * systematically favour whoever is first in the list.
 */
export function apportion(
  count: number,
  targets: readonly DistributionTarget[],
): Map<string, number> {
  const quotas = new Map<string, number>()
  if (targets.length === 0 || count <= 0) {
    for (const t of targets) quotas.set(t.id, 0)
    return quotas
  }

  const totalWeight = targets.reduce((sum, t) => sum + (t.weight ?? 1), 0)
  const exact = targets.map((t) => ({
    id: t.id,
    exact: (count * (t.weight ?? 1)) / totalWeight,
  }))

  let assigned = 0
  for (const e of exact) {
    const floor = Math.floor(e.exact)
    quotas.set(e.id, floor)
    assigned += floor
  }

  // Distribute the remainder to the largest fractional parts.
  const remainders = exact
    .map((e) => ({ id: e.id, frac: e.exact - Math.floor(e.exact) }))
    .sort((a, b) => b.frac - a.frac)

  let i = 0
  while (assigned < count && remainders.length > 0) {
    const target = remainders[i % remainders.length]
    quotas.set(target.id, (quotas.get(target.id) ?? 0) + 1)
    assigned += 1
    i += 1
  }

  return quotas
}

export function distribute(
  items: readonly DistributableItem[],
  targets: readonly DistributionTarget[],
  options: DistributionOptions = {},
): DistributionResult {
  const balanceBy = options.balanceBy ?? []
  const targetIds = new Set(targets.map((t) => t.id))

  const perLocation = new Map<string, LocationTally>(
    targets.map((t) => [
      t.id,
      { locationId: t.id, name: t.name, before: 0, after: 0, target: 0 },
    ]),
  )

  const assignments: Assignment[] = []
  const unplaceable: DistributionResult['unplaceable'] = []

  if (targets.length === 0) {
    return {
      assignments: [],
      moves: [],
      perLocation: [],
      unplaceable: items.map((i) => ({
        itemId: i.id,
        name: i.name,
        reason: 'No destination homes were given.',
      })),
      facts: {
        totalItems: items.length,
        movableItems: 0,
        pinnedItems: 0,
        strata: [],
        indivisibleStrata: [],
      },
    }
  }

  // Count everything against "before", pinned included — the starting picture
  // has to be honest even for items that will not move.
  for (const item of items) {
    if (item.locationId && perLocation.has(item.locationId)) {
      perLocation.get(item.locationId)!.before += 1
    }
  }

  const pinned = items.filter((i) => i.pinned)
  const movable = items.filter((i) => !i.pinned)

  // Pinned items occupy their current home and are never reassigned.
  for (const item of pinned) {
    if (item.locationId && perLocation.has(item.locationId)) {
      perLocation.get(item.locationId)!.after += 1
      assignments.push({
        itemId: item.id,
        name: item.name,
        fromLocationId: item.locationId,
        toLocationId: item.locationId,
        stratum: stratumKey(item, balanceBy),
        moved: false,
        reason: 'Pinned — left where it is.',
      })
    } else {
      unplaceable.push({
        itemId: item.id,
        name: item.name,
        reason: 'Pinned to a home outside this plan.',
      })
    }
  }

  // Bundles move as one unit, so represent each bundle by its first member and
  // carry the rest along.
  const groups = groupByBundle(movable)

  const strata = new Map<string, typeof groups>()
  for (const group of groups) {
    const key = stratumKey(group.representative, balanceBy)
    const bucket = strata.get(key)
    if (bucket) bucket.push(group)
    else strata.set(key, [group])
  }

  const strataFacts: DistributionResult['facts']['strata'] = []
  const indivisible: string[] = []

  // Deterministic stratum order so the same inventory always yields the same
  // plan — a plan that shuffles between runs is not a plan anyone trusts.
  for (const key of [...strata.keys()].sort()) {
    const groupsInStratum = strata.get(key)!
    const unitCount = groupsInStratum.reduce((n, g) => n + g.items.length, 0)
    const quotas = apportion(unitCount, targets)

    if (unitCount > 0 && unitCount < targets.length) {
      indivisible.push(key)
    }

    // Seed each home with what it already holds in this stratum, capped at its
    // quota. Ties break toward staying put, which is what makes the output a
    // short list of moves rather than a full reshuffle.
    const remaining = new Map(quotas)
    const placed = new Set<string>()

    if ((options.inertia ?? 1) > 0) {
      for (const group of groupsInStratum) {
        const home = group.representative.locationId
        if (!home || !targetIds.has(home)) continue
        const left = remaining.get(home) ?? 0
        if (left >= group.items.length) {
          remaining.set(home, left - group.items.length)
          placed.add(group.key)
          for (const item of group.items) {
            perLocation.get(home)!.after += 1
            assignments.push({
              itemId: item.id,
              name: item.name,
              fromLocationId: item.locationId,
              toLocationId: home,
              stratum: key,
              moved: false,
              reason: 'Already here, and this home is not over its share.',
            })
          }
        }
      }
    }

    // Place whatever is left into the emptiest home that still has room.
    for (const group of groupsInStratum) {
      if (placed.has(group.key)) continue

      const destination = pickDestination(remaining, group.items.length, targets)
      if (!destination) {
        for (const item of group.items) {
          unplaceable.push({
            itemId: item.id,
            name: item.name,
            reason: 'No home had room left in this group.',
          })
        }
        continue
      }

      remaining.set(destination, (remaining.get(destination) ?? 0) - group.items.length)
      for (const item of group.items) {
        const moved = item.locationId !== destination
        perLocation.get(destination)!.after += 1
        assignments.push({
          itemId: item.id,
          name: item.name,
          fromLocationId: item.locationId,
          toLocationId: destination,
          stratum: key,
          moved,
          reason: moved
            ? group.items.length > 1
              ? 'Moved with the rest of its bundle to even out this group.'
              : 'Moved to even out this group.'
            : 'Already here.',
        })
      }
    }

    const spread: Record<string, number> = {}
    for (const target of targets) spread[target.name] = quotas.get(target.id) ?? 0
    strataFacts.push({ key, count: unitCount, spread })
  }

  // Overall target counts, for the before/after table.
  const overall = apportion(items.length, targets)
  for (const [id, quota] of overall) {
    const tally = perLocation.get(id)
    if (tally) tally.target = quota
  }

  const ordered = assignments.sort((a, b) => a.name.localeCompare(b.name))

  return {
    assignments: ordered,
    moves: ordered.filter((a) => a.moved),
    perLocation: targets.map((t) => perLocation.get(t.id)!),
    unplaceable,
    facts: {
      totalItems: items.length,
      movableItems: movable.length,
      pinnedItems: pinned.length,
      strata: strataFacts,
      indivisibleStrata: indivisible,
    },
  }
}

interface Group {
  key: string
  representative: DistributableItem
  items: DistributableItem[]
}

function groupByBundle(items: readonly DistributableItem[]): Group[] {
  const bundles = new Map<string, Group>()
  const singles: Group[] = []

  for (const item of items) {
    if (item.bundleId) {
      const existing = bundles.get(item.bundleId)
      if (existing) {
        existing.items.push(item)
      } else {
        bundles.set(item.bundleId, {
          key: `bundle:${item.bundleId}`,
          representative: item,
          items: [item],
        })
      }
    } else {
      singles.push({ key: `item:${item.id}`, representative: item, items: [item] })
    }
  }

  // Sort by id so the result is stable across runs regardless of query order.
  return [...bundles.values(), ...singles].sort((a, b) => a.key.localeCompare(b.key))
}

/** The home with the most unfilled quota that can still take `size` items. */
function pickDestination(
  remaining: Map<string, number>,
  size: number,
  targets: readonly DistributionTarget[],
): string | null {
  let best: string | null = null
  let bestRoom = -Infinity

  for (const target of targets) {
    const room = remaining.get(target.id) ?? 0
    if (room >= size && room > bestRoom) {
      best = target.id
      bestRoom = room
    }
  }

  if (best) return best

  // A bundle larger than any single quota still has to land somewhere; put it
  // where it does the least damage rather than dropping it on the floor.
  if (size > 1) {
    for (const target of targets) {
      const room = remaining.get(target.id) ?? 0
      if (room > bestRoom) {
        best = target.id
        bestRoom = room
      }
    }
  }

  return best
}
