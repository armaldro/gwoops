import { createClient } from '@/lib/supabase/server'
import { signPhotoUrls } from '@/lib/photos'
import type {
  CategoryRow,
  ItemRow,
  LocationRow,
  HouseholdMemberRow,
} from '@/lib/supabase/types'

/** Item plus everything the cards and detail pages need to render. */
export interface ItemView extends ItemRow {
  categorySlug: string
  categoryLabel: string
  categoryIcon: string
  locationName: string | null
  locationEmoji: string | null
  locationColor: string | null
  ownerName: string | null
  photoUrl: string | null
  photoPaths: string[]
}

const ITEM_SELECT = `
  *,
  categories ( id, slug, label, icon ),
  locations ( id, name, emoji, color ),
  household_members ( id, display_name ),
  item_photos ( id, storage_path, is_primary )
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function toView(row: any, photoUrls: Map<string, string>): ItemView {
  const photos: { storage_path: string; is_primary: boolean }[] =
    row.item_photos ?? []
  const ordered = [...photos].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  )
  const primary = ordered[0]?.storage_path ?? null

  return {
    ...(row as ItemRow),
    attributes: (row.attributes ?? {}) as ItemRow['attributes'],
    categorySlug: row.categories?.slug ?? 'other',
    categoryLabel: row.categories?.label ?? 'Other',
    categoryIcon: row.categories?.icon ?? '📦',
    locationName: row.locations?.name ?? null,
    locationEmoji: row.locations?.emoji ?? null,
    locationColor: row.locations?.color ?? null,
    ownerName: row.household_members?.display_name ?? null,
    photoUrl: primary ? (photoUrls.get(primary) ?? null) : null,
    photoPaths: ordered.map((p) => p.storage_path),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ItemFilters {
  search?: string
  locationId?: string
  categorySlug?: string
  ownerMemberId?: string
  status?: ItemRow['status']
  /** Attribute equality, e.g. { type: 'boots' }. Arrays match "contains". */
  attributes?: Record<string, string>
  includePrivate?: boolean
  limit?: number
  offset?: number
}

export async function fetchItems(
  filters: ItemFilters = {},
): Promise<{ items: ItemView[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('items')
    .select(ITEM_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.ownerMemberId) query = query.eq('owner_member_id', filters.ownerMemberId)
  if (!filters.includePrivate) query = query.eq('is_private', false)

  if (filters.categorySlug) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filters.categorySlug)
      .maybeSingle()
    // An unknown slug must match nothing, not everything.
    query = query.eq('category_id', category?.id ?? '00000000-0000-0000-0000-000000000000')
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.textSearch('search_tsv', term, {
      type: 'websearch',
      config: 'simple',
    })
  }

  for (const [key, value] of Object.entries(filters.attributes ?? {})) {
    // jsonb containment handles both scalars and arrays: {"season": ["winter"]}
    // matches an item whose season array includes winter.
    query = query.or(
      `attributes.cs.${JSON.stringify({ [key]: value })},` +
        `attributes.cs.${JSON.stringify({ [key]: [value] })}`,
    )
  }

  const limit = filters.limit ?? 60
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) throw new Error(`Could not load items: ${error.message}`)

  const rows = data ?? []
  const paths = rows.flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => (r.item_photos ?? []).map((p: any) => p.storage_path as string),
  )
  const urls = await signPhotoUrls(paths)

  return { items: rows.map((r) => toView(r, urls)), total: count ?? rows.length }
}

export async function fetchItem(id: string): Promise<ItemView | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paths = ((data as any).item_photos ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.storage_path as string,
  )
  const urls = await signPhotoUrls(paths)
  return toView(data, urls)
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('categories').select('*').order('sort_order')
  return data ?? []
}

export async function fetchMembers(): Promise<HouseholdMemberRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('household_members')
    .select('*')
    .order('created_at')
  return data ?? []
}

export interface LocationSummary {
  location: LocationRow
  itemCount: number
  byCategory: { slug: string; label: string; icon: string; count: number }[]
  estValue: number
}

/**
 * Per-home totals for the dashboard and for the assistant's summary tool.
 *
 * One query for every item rather than a count per location: the whole point is
 * the cross-tab, and household inventories are thousands of rows at most.
 */
export async function fetchLocationSummaries(): Promise<{
  summaries: LocationSummary[]
  unassigned: number
}> {
  const supabase = await createClient()

  const [{ data: locations }, { data: rows }] = await Promise.all([
    supabase.from('locations').select('*').order('sort_order').order('name'),
    supabase
      .from('items')
      .select('location_id, est_value, purchase_price, categories ( slug, label, icon )')
      .eq('status', 'active'),
  ])

  const summaries: LocationSummary[] = (locations ?? []).map((location) => ({
    location,
    itemCount: 0,
    byCategory: [],
    estValue: 0,
  }))

  const index = new Map(summaries.map((s) => [s.location.id, s]))
  const categoryTallies = new Map<string, Map<string, { label: string; icon: string; count: number }>>()
  let unassigned = 0

  for (const row of rows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const summary = r.location_id ? index.get(r.location_id) : undefined
    if (!summary) {
      unassigned += 1
      continue
    }

    summary.itemCount += 1
    summary.estValue += Number(r.est_value ?? r.purchase_price ?? 0)

    const slug = r.categories?.slug ?? 'other'
    if (!categoryTallies.has(summary.location.id)) {
      categoryTallies.set(summary.location.id, new Map())
    }
    const tally = categoryTallies.get(summary.location.id)!
    const existing = tally.get(slug)
    if (existing) existing.count += 1
    else
      tally.set(slug, {
        label: r.categories?.label ?? 'Other',
        icon: r.categories?.icon ?? '📦',
        count: 1,
      })
  }

  for (const summary of summaries) {
    const tally = categoryTallies.get(summary.location.id)
    summary.byCategory = [...(tally?.entries() ?? [])]
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => b.count - a.count)
  }

  return { summaries, unassigned }
}
