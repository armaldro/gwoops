import Link from 'next/link'
import { fetchCategories, fetchItems, fetchMembers } from '@/lib/queries'
import { getLocations, requireSession } from '@/lib/session'
import { Empty, LinkButton, PageHeader } from '@/components/ui/primitives'
import { ItemCard } from '@/components/items/item-card'
import { ItemDetail } from '@/components/items/item-detail'
import { InventoryFilters } from './filters'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inventory' }

const PAGE_SIZE = 48

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const session = await requireSession()
  const page = Math.max(1, Number(params.page ?? '1') || 1)

  // Attribute facets arrive as attr.<key>=<value>.
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('attr.') && value) attributes[key.slice(5)] = value
  }

  const [locations, categories, members] = await Promise.all([
    getLocations(),
    fetchCategories(),
    fetchMembers(),
  ])

  const { items, total } = await fetchItems({
    search: params.q,
    locationId: params.location && params.location !== 'none' ? params.location : undefined,
    categorySlug: params.category,
    ownerMemberId: params.owner,
    status: (params.status as 'active' | 'in_transit' | 'archived') ?? 'active',
    attributes,
    // Documents and valuables stay out of the shared grid unless asked for.
    includePrivate: params.private === '1',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })

  // "No home set" is a filter the database cannot express as an equality.
  const visible =
    params.location === 'none' ? items.filter((i) => !i.location_id) : items

  const selectedId = params.item ?? null
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = Boolean(
    params.q || params.location || params.category || params.owner ||
      Object.keys(attributes).length,
  )

  return (
    <div
      className={
        selectedId
          ? 'grid gap-6 fold:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]'
          : ''
      }
    >
      {/*
        With an item selected, the grid is hidden below fold: so the detail
        reads as a full page — same URL, so back and sharing behave. From
        fold: up both panes are visible, which is the whole point of
        unfolding: you stop losing your place in the grid.
      */}
      <div className={selectedId ? 'hidden fold:block' : ''}>
        <PageHeader
          title="Inventory"
          subtitle={`${total} ${total === 1 ? 'item' : 'items'}${filtered ? ' matching' : ''}`}
          action={session.canWrite ? <LinkButton href="/capture">📸 Add</LinkButton> : undefined}
        />

        <InventoryFilters
          locations={locations}
          categories={categories}
          members={members}
        />

        {visible.length === 0 ? (
          <div className="mt-6">
            <Empty
              icon={filtered ? '🔍' : '🗄️'}
              title={filtered ? 'Nothing matches' : 'Nothing catalogued yet'}
              body={
                filtered
                  ? 'Try loosening a filter, or search for part of the name instead.'
                  : 'Photograph something you own and it lands here, named and filed.'
              }
              action={
                filtered ? (
                  <LinkButton href="/inventory" variant="secondary">
                    Clear filters
                  </LinkButton>
                ) : (
                  <LinkButton href="/capture">Add the first item</LinkButton>
                )
              }
            />
          </div>
        ) : (
          <>
            <div
              className={
                selectedId
                  ? 'mt-5 grid grid-cols-2 gap-3 fold:grid-cols-2 lg:grid-cols-3'
                  : 'mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 fold:grid-cols-4 lg:grid-cols-5'
              }
            >
              {visible.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  href={buildItemHref(params, item.id)}
                  selected={item.id === selectedId}
                />
              ))}
            </div>

            {pages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
                {page > 1 && (
                  <LinkButton variant="secondary" href={pageHref(params, page - 1)}>
                    ← Previous
                  </LinkButton>
                )}
                <span className="tabular" style={{ color: 'var(--ink-muted)' }}>
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <LinkButton variant="secondary" href={pageHref(params, page + 1)}>
                    Next →
                  </LinkButton>
                )}
              </nav>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <aside className="min-w-0 fold:sticky fold:top-4 fold:max-h-[calc(100dvh-2rem)] fold:overflow-y-auto fold:overscroll-contain">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link
              href={clearItemHref(params)}
              className="touch-target text-sm"
              style={{ color: 'var(--ink-muted)' }}
            >
              <span aria-hidden className="mr-1">←</span>
              <span className="fold:hidden">Back to inventory</span>
              <span className="hidden fold:inline">Close</span>
            </Link>
            <Link
              href={`/items/${selectedId}`}
              className="touch-target text-sm"
              style={{ color: 'var(--accent)' }}
            >
              Open full page
            </Link>
          </div>
          <ItemDetail itemId={selectedId} canWrite={session.canWrite} compact />
        </aside>
      )}
    </div>
  )
}

/** Keep every active filter when selecting an item, so closing returns you to
 *  exactly the grid you were looking at. */
function buildItemHref(
  params: Record<string, string | undefined>,
  itemId: string,
): string {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'item') next.set(key, value)
  }
  next.set('item', itemId)
  return `/inventory?${next.toString()}`
}

function clearItemHref(params: Record<string, string | undefined>): string {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'item') next.set(key, value)
  }
  const query = next.toString()
  return query ? `/inventory?${query}` : '/inventory'
}

function pageHref(params: Record<string, string | undefined>, page: number): string {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') next.set(key, value)
  }
  next.set('page', String(page))
  return `/inventory?${next.toString()}`
}
