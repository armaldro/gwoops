/**
 * "Do we already have one of these?"
 *
 * Runs at capture time (before saving) and on demand from chat. It is a
 * suggestion engine, not an auto-merge: two genuinely identical black t-shirts
 * are a legitimate thing to own, and quietly collapsing them would lose real
 * information.
 */

import type { Attributes } from '@/lib/categories/schemas'
import { getCategory } from '@/lib/categories/schemas'

export interface DuplicateCandidate {
  id: string
  name: string
  categorySlug: string
  locationId: string | null
  locationName?: string | null
  attributes: Attributes
  quantity: number
}

export interface DuplicateMatch {
  candidate: DuplicateCandidate
  score: number
  /** Human-readable reasons, shown in the prompt and to the user. */
  reasons: string[]
}

/** Words that carry no distinguishing signal in an item name. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'with', 'in', 'for', 'my', 'our', 'pair',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

/** Jaccard similarity over name tokens: 0 (nothing shared) to 1 (identical). */
export function nameSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))
  if (setA.size === 0 || setB.size === 0) return 0

  let shared = 0
  for (const token of setA) if (setB.has(token)) shared += 1

  return shared / (setA.size + setB.size - shared)
}

function attributeValues(value: Attributes[string] | undefined): string[] {
  if (value === undefined) return []
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase())
  return [String(value).toLowerCase()]
}

const NAME_WEIGHT = 0.55
const ATTRIBUTE_WEIGHT = 0.45
const THRESHOLD = 0.62

/**
 * Score a draft item against existing inventory. Only same-category items are
 * considered — a "black leather belt" and a "black leather jacket" share plenty
 * of words but are not the same thing.
 */
export function findDuplicates(
  draft: { name: string; categorySlug: string; attributes: Attributes },
  existing: readonly DuplicateCandidate[],
  limit = 3,
): DuplicateMatch[] {
  const category = getCategory(draft.categorySlug)
  // The identifying fields: what shows in the summary line, plus the ones we
  // balance on. Between them these are what makes an item "that one".
  const keyFields = [
    ...new Set([
      ...category.fields.filter((f) => f.summary).map((f) => f.key),
      ...category.balanceBy,
    ]),
  ]

  const matches: DuplicateMatch[] = []

  for (const candidate of existing) {
    if (candidate.categorySlug !== draft.categorySlug) continue

    const nameScore = nameSimilarity(draft.name, candidate.name)
    const reasons: string[] = []

    let compared = 0
    let agreed = 0
    for (const key of keyFields) {
      const mine = attributeValues(draft.attributes[key])
      const theirs = attributeValues(candidate.attributes[key])
      if (mine.length === 0 || theirs.length === 0) continue

      compared += 1
      if (mine.some((v) => theirs.includes(v))) {
        agreed += 1
        const label = category.fields.find((f) => f.key === key)?.label ?? key
        reasons.push(`${label}: ${mine[0]}`)
      }
    }

    const attributeScore = compared === 0 ? 0 : agreed / compared
    // With no comparable attributes, the name has to carry the whole decision.
    const score =
      compared === 0
        ? nameScore
        : nameScore * NAME_WEIGHT + attributeScore * ATTRIBUTE_WEIGHT

    if (score >= THRESHOLD) {
      if (nameScore > 0.5) reasons.unshift('Very similar name')
      matches.push({ candidate, score, reasons })
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Items the household has more of than it plausibly needs, grouped so chat can
 * suggest consolidating. Distinct from findDuplicates: this looks across the
 * whole inventory rather than at one draft.
 */
export function findOverProvisioned(
  items: readonly DuplicateCandidate[],
  minCount = 3,
): { key: string; categorySlug: string; items: DuplicateCandidate[] }[] {
  const groups = new Map<string, DuplicateCandidate[]>()

  for (const item of items) {
    const category = getCategory(item.categorySlug)
    const signature = [
      item.categorySlug,
      ...category.balanceBy.map((k) => attributeValues(item.attributes[k])[0] ?? '—'),
    ].join('|')

    const bucket = groups.get(signature)
    if (bucket) bucket.push(item)
    else groups.set(signature, [item])
  }

  return [...groups.entries()]
    .filter(([, group]) => {
      const total = group.reduce((n, i) => n + i.quantity, 0)
      return total >= minCount
    })
    .map(([key, group]) => ({
      key,
      categorySlug: group[0].categorySlug,
      items: group,
    }))
    .sort((a, b) => b.items.length - a.items.length)
}
