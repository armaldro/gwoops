import { describe, expect, it } from 'vitest'
import {
  findDuplicates,
  findOverProvisioned,
  nameSimilarity,
  tokenize,
  type DuplicateCandidate,
} from './duplicates'

function candidate(
  id: string,
  name: string,
  attributes: Record<string, string | string[]>,
  categorySlug = 'shoes',
  locationId = 'sg',
): DuplicateCandidate {
  return { id, name, categorySlug, locationId, attributes, quantity: 1 }
}

describe('tokenize', () => {
  it('drops punctuation, short words and stop words', () => {
    expect(tokenize('A pair of Nike Air Max 90s!')).toEqual([
      'nike', 'air', 'max', '90s',
    ])
  })
})

describe('nameSimilarity', () => {
  it('is 1 for identical names', () => {
    expect(nameSimilarity('Navy suede boots', 'navy suede boots')).toBe(1)
  })

  it('is 0 for names with nothing in common', () => {
    expect(nameSimilarity('Navy suede boots', 'Cast iron skillet')).toBe(0)
  })

  it('is 0 when a name is entirely stop words', () => {
    expect(nameSimilarity('the a of', 'Navy boots')).toBe(0)
  })

  it('sits in between for partial overlap', () => {
    const score = nameSimilarity('Navy suede Chelsea boots', 'Black suede boots')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
})

describe('findDuplicates', () => {
  const existing = [
    candidate('a', 'Navy suede Chelsea boots', {
      type: 'chelsea-boots', brand: 'Loake', size_eu: '43',
    }),
    candidate('b', 'White leather sneakers', {
      type: 'sneakers', brand: 'Common Projects', size_eu: '43',
    }),
    candidate('c', 'Cast iron skillet', { type: 'cookware' }, 'kitchen'),
  ]

  it('flags the same item photographed twice', () => {
    const matches = findDuplicates(
      {
        name: 'Navy suede Chelsea boots',
        categorySlug: 'shoes',
        attributes: { type: 'chelsea-boots', brand: 'Loake', size_eu: '43' },
      },
      existing,
    )
    expect(matches[0]?.candidate.id).toBe('a')
    expect(matches[0]?.reasons).toContain('Very similar name')
  })

  it('does not flag a genuinely different shoe', () => {
    const matches = findDuplicates(
      {
        name: 'Black running shoes',
        categorySlug: 'shoes',
        attributes: { type: 'running', brand: 'Asics', size_eu: '43' },
      },
      existing,
    )
    expect(matches).toHaveLength(0)
  })

  it('never crosses category, however similar the words', () => {
    const matches = findDuplicates(
      {
        name: 'Cast iron skillet',
        categorySlug: 'shoes',
        attributes: { type: 'cookware' },
      },
      existing,
    )
    expect(matches).toHaveLength(0)
  })

  it('falls back to the name when there are no comparable attributes', () => {
    const matches = findDuplicates(
      { name: 'Navy suede Chelsea boots', categorySlug: 'shoes', attributes: {} },
      [candidate('a', 'Navy suede Chelsea boots', {})],
    )
    expect(matches).toHaveLength(1)
  })

  it('returns nothing for an empty inventory', () => {
    expect(
      findDuplicates({ name: 'Anything', categorySlug: 'shoes', attributes: {} }, []),
    ).toEqual([])
  })

  it('ranks the best match first and respects the limit', () => {
    const matches = findDuplicates(
      {
        name: 'Navy suede Chelsea boots',
        categorySlug: 'shoes',
        attributes: { type: 'chelsea-boots', brand: 'Loake', size_eu: '43' },
      },
      [
        candidate('near', 'Navy suede boots', { type: 'chelsea-boots', brand: 'Loake' }),
        ...existing,
      ],
      1,
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].score).toBeGreaterThan(0.62)
  })
})

describe('findOverProvisioned', () => {
  it('groups items that share a balancing signature', () => {
    const items = [
      candidate('1', 'Black tee', { type: 't-shirt', formality: 'casual', season: ['all-season'] }, 'clothing'),
      candidate('2', 'White tee', { type: 't-shirt', formality: 'casual', season: ['all-season'] }, 'clothing'),
      candidate('3', 'Grey tee', { type: 't-shirt', formality: 'casual', season: ['all-season'] }, 'clothing'),
      candidate('4', 'Wool coat', { type: 'coat', formality: 'business', season: ['winter'] }, 'clothing'),
    ]
    const groups = findOverProvisioned(items, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.id).sort()).toEqual(['1', '2', '3'])
  })

  it('finds nothing when everything is a singleton', () => {
    expect(findOverProvisioned([candidate('1', 'Only one', { type: 'coat' }, 'clothing')], 3))
      .toEqual([])
  })
})
