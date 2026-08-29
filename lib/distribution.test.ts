import { describe, expect, it } from 'vitest'
import {
  apportion,
  distribute,
  stratumKey,
  type DistributableItem,
  type DistributionTarget,
} from './distribution'

const SG: DistributionTarget = { id: 'sg', name: 'Singapore' }
const BALI: DistributionTarget = { id: 'bali', name: 'Bali' }
const TOKYO: DistributionTarget = { id: 'tokyo', name: 'Tokyo' }

function shoe(
  id: string,
  type: string,
  season: string,
  locationId: string | null = 'sg',
  extra: Partial<DistributableItem> = {},
): DistributableItem {
  return {
    id,
    name: `${type} ${id}`,
    categorySlug: 'shoes',
    locationId,
    attributes: { type, season: [season] },
    quantity: 1,
    ...extra,
  }
}

describe('apportion', () => {
  it('splits evenly when it divides cleanly', () => {
    expect([...apportion(10, [SG, BALI]).values()]).toEqual([5, 5])
  })

  it('differs by at most one on an odd count', () => {
    const shares = [...apportion(7, [SG, BALI]).values()]
    expect(shares.reduce((a, b) => a + b)).toBe(7)
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
  })

  it('handles three homes and an awkward count', () => {
    const shares = [...apportion(10, [SG, BALI, TOKYO]).values()]
    expect(shares.reduce((a, b) => a + b)).toBe(10)
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
  })

  it('respects weights', () => {
    const shares = apportion(9, [
      { id: 'sg', name: 'Singapore', weight: 2 },
      { id: 'bali', name: 'Bali', weight: 1 },
    ])
    expect(shares.get('sg')).toBe(6)
    expect(shares.get('bali')).toBe(3)
  })

  it('gives everyone zero for an empty set', () => {
    expect([...apportion(0, [SG, BALI]).values()]).toEqual([0, 0])
  })
})

describe('stratumKey', () => {
  it('joins the balancing attributes', () => {
    const item = shoe('1', 'boots', 'winter')
    expect(stratumKey(item, ['type', 'season'])).toBe('boots|winter')
  })

  it('collapses everything into one stratum when nothing balances', () => {
    expect(stratumKey(shoe('1', 'boots', 'winter'), [])).toBe('all')
  })

  it('marks missing attributes rather than dropping the item', () => {
    const item: DistributableItem = {
      id: 'x', name: 'Mystery shoe', categorySlug: 'shoes',
      locationId: 'sg', attributes: {}, quantity: 1,
    }
    expect(stratumKey(item, ['type', 'season'])).toBe('—|—')
  })
})

describe('distribute', () => {
  it('splits an even count evenly across two homes', () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      shoe(`s${i}`, 'sneakers', 'all-season'),
    )
    const result = distribute(items, [SG, BALI], { balanceBy: ['type', 'season'] })

    const after = Object.fromEntries(
      result.perLocation.map((l) => [l.locationId, l.after]),
    )
    expect(after).toEqual({ sg: 4, bali: 4 })
    expect(result.assignments).toHaveLength(8)
    expect(result.unplaceable).toHaveLength(0)
  })

  it('differs by at most one on an odd count', () => {
    const items = Array.from({ length: 7 }, (_, i) => shoe(`s${i}`, 'sneakers', 'all-season'))
    const result = distribute(items, [SG, BALI], { balanceBy: ['type'] })

    const counts = result.perLocation.map((l) => l.after)
    expect(counts.reduce((a, b) => a + b)).toBe(7)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('does not put all the winter boots in one house', () => {
    // The failure this whole design exists to prevent: even totals, wrong split.
    const items = [
      ...Array.from({ length: 4 }, (_, i) => shoe(`b${i}`, 'boots', 'winter')),
      ...Array.from({ length: 4 }, (_, i) => shoe(`f${i}`, 'flip-flops', 'tropical')),
    ]
    const result = distribute(items, [SG, BALI], { balanceBy: ['type', 'season'] })

    const bootsPerHome = new Map<string, number>()
    for (const a of result.assignments) {
      if (a.stratum.startsWith('boots')) {
        bootsPerHome.set(a.toLocationId, (bootsPerHome.get(a.toLocationId) ?? 0) + 1)
      }
    }
    expect([...bootsPerHome.values()].sort()).toEqual([2, 2])
  })

  it('leaves pinned items alone and still balances the rest', () => {
    const items = [
      shoe('p1', 'sneakers', 'all-season', 'sg', { pinned: true }),
      shoe('p2', 'sneakers', 'all-season', 'sg', { pinned: true }),
      ...Array.from({ length: 4 }, (_, i) => shoe(`s${i}`, 'sneakers', 'all-season')),
    ]
    const result = distribute(items, [SG, BALI], { balanceBy: ['type'] })

    expect(result.facts.pinnedItems).toBe(2)
    for (const id of ['p1', 'p2']) {
      const assignment = result.assignments.find((a) => a.itemId === id)!
      expect(assignment.moved).toBe(false)
      expect(assignment.toLocationId).toBe('sg')
    }
    expect(result.moves.every((m) => !['p1', 'p2'].includes(m.itemId))).toBe(true)
  })

  it('prefers leaving items put — an already-balanced inventory needs no moves', () => {
    const items = [
      shoe('a', 'sneakers', 'all-season', 'sg'),
      shoe('b', 'sneakers', 'all-season', 'bali'),
      shoe('c', 'boots', 'winter', 'sg'),
      shoe('d', 'boots', 'winter', 'bali'),
    ]
    const result = distribute(items, [SG, BALI], { balanceBy: ['type', 'season'] })
    expect(result.moves).toHaveLength(0)
  })

  it('moves only what it must from a lopsided start', () => {
    // All six at home; a fair split needs exactly three to travel.
    const items = Array.from({ length: 6 }, (_, i) => shoe(`s${i}`, 'sneakers', 'all-season', 'sg'))
    const result = distribute(items, [SG, BALI], { balanceBy: ['type'] })
    expect(result.moves).toHaveLength(3)
    expect(result.moves.every((m) => m.toLocationId === 'bali')).toBe(true)
  })

  it('keeps a bundle together', () => {
    const items = [
      shoe('x1', 'sneakers', 'all-season', 'sg', { bundleId: 'kit' }),
      shoe('x2', 'sneakers', 'all-season', 'sg', { bundleId: 'kit' }),
      shoe('y1', 'sneakers', 'all-season', 'sg'),
      shoe('y2', 'sneakers', 'all-season', 'sg'),
    ]
    const result = distribute(items, [SG, BALI], { balanceBy: ['type'] })

    const homes = ['x1', 'x2'].map(
      (id) => result.assignments.find((a) => a.itemId === id)!.toLocationId,
    )
    expect(homes[0]).toBe(homes[1])
  })

  it('flags a group too small to divide instead of pretending it split', () => {
    const items = [shoe('only', 'boots', 'winter', 'sg')]
    const result = distribute(items, [SG, BALI, TOKYO], { balanceBy: ['type', 'season'] })
    expect(result.facts.indivisibleStrata).toContain('boots|winter')
  })

  it('handles three homes', () => {
    const items = Array.from({ length: 9 }, (_, i) => shoe(`s${i}`, 'sneakers', 'all-season'))
    const result = distribute(items, [SG, BALI, TOKYO], { balanceBy: ['type'] })
    expect(result.perLocation.map((l) => l.after)).toEqual([3, 3, 3])
  })

  it('returns an empty plan for an empty inventory', () => {
    const result = distribute([], [SG, BALI], { balanceBy: ['type'] })
    expect(result.assignments).toEqual([])
    expect(result.moves).toEqual([])
    expect(result.perLocation.map((l) => l.after)).toEqual([0, 0])
  })

  it('places a single item somewhere rather than nowhere', () => {
    const result = distribute([shoe('one', 'sneakers', 'all-season', null)], [SG, BALI], {
      balanceBy: ['type'],
    })
    expect(result.assignments).toHaveLength(1)
    expect(['sg', 'bali']).toContain(result.assignments[0].toLocationId)
    expect(result.unplaceable).toHaveLength(0)
  })

  it('reports every item as unplaceable when given no homes', () => {
    const result = distribute([shoe('one', 'sneakers', 'all-season')], [], {})
    expect(result.unplaceable).toHaveLength(1)
    expect(result.assignments).toHaveLength(0)
  })

  it('counts items sitting at a home outside the plan in "before" nowhere', () => {
    const items = [shoe('a', 'sneakers', 'all-season', 'tokyo')]
    const result = distribute(items, [SG, BALI], { balanceBy: ['type'] })
    expect(result.perLocation.every((l) => l.before === 0)).toBe(true)
    expect(result.assignments[0].moved).toBe(true)
  })

  it('is deterministic across runs', () => {
    const items = Array.from({ length: 11 }, (_, i) =>
      shoe(`s${i}`, i % 2 ? 'boots' : 'sneakers', i % 3 ? 'winter' : 'summer'),
    )
    const a = distribute(items, [SG, BALI], { balanceBy: ['type', 'season'] })
    const b = distribute([...items].reverse(), [SG, BALI], { balanceBy: ['type', 'season'] })
    expect(a.assignments).toEqual(b.assignments)
  })
})
