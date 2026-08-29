import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { fetchItems, fetchLocationSummaries } from '@/lib/queries'
import { locationColorVar } from '@nest/domain/colors'
import { Empty, LinkButton, PageHeader, Stat } from '@/components/ui/primitives'
import { ItemCard } from '@/components/items/item-card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('locations')
    .select('name')
    .eq('id', (await params).id)
    .maybeSingle()
  return { title: data?.name ?? 'Home' }
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireSession()
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!location) notFound()

  const [{ items }, { summaries }] = await Promise.all([
    fetchItems({ locationId: id, status: 'active', limit: 60 }),
    fetchLocationSummaries(),
  ])

  const here = summaries.find((s) => s.location.id === id)
  const elsewhere = summaries.filter((s) => s.location.id !== id)
  const tone = locationColorVar(location.color)

  // What the other homes have that this one does not — the practical version of
  // "what should I bring next time".
  const hereCategories = new Set(here?.byCategory.map((c) => c.slug) ?? [])
  const gaps = new Map<string, { icon: string; label: string; count: number }>()
  for (const other of elsewhere) {
    for (const category of other.byCategory) {
      if (hereCategories.has(category.slug)) continue
      const existing = gaps.get(category.slug)
      if (existing) existing.count += category.count
      else gaps.set(category.slug, { ...category })
    }
  }

  return (
    <>
      <PageHeader
        title={`${location.emoji} ${location.name}`}
        subtitle={location.address ?? location.notes ?? undefined}
        action={<LinkButton href={`/inventory?location=${id}`} variant="secondary">Filter inventory</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Items" value={here?.itemCount ?? 0} />
        <Stat
          label="Est. value"
          value={here ? Math.round(here.estValue).toLocaleString() : 0}
          hint="SGD"
        />
        <Stat label="Categories" value={here?.byCategory.length ?? 0} />
        <Stat
          label="Share"
          value={`${sharePercent(here?.itemCount ?? 0, summaries)}%`}
          hint="of everything"
        />
      </div>

      {here && here.byCategory.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg">What&rsquo;s here</h2>
          <div className="flex flex-wrap gap-2">
            {here.byCategory.map((category) => (
              <Link
                key={category.slug}
                href={`/inventory?location=${id}&category=${category.slug}`}
                className="rounded-full border px-3 py-1.5 text-xs"
                style={{ borderColor: tone, color: tone }}
              >
                <span aria-hidden>{category.icon}</span> {category.label}
                <span className="tabular ml-1.5">{category.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {gaps.size > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-lg">Not here, but elsewhere</h2>
          <p className="mb-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Categories your other homes have and this one does not.
          </p>
          <div className="flex flex-wrap gap-2">
            {[...gaps.values()].map((category) => (
              <span
                key={category.label}
                className="rounded-full border border-dashed px-3 py-1.5 text-xs"
                style={{ color: 'var(--ink-muted)' }}
              >
                <span aria-hidden>{category.icon}</span> {category.label}
                <span className="tabular ml-1.5">{category.count} elsewhere</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg">Everything here</h2>
        {items.length === 0 ? (
          <Empty
            icon={location.emoji}
            title="Nothing catalogued here yet"
            body="Photograph something while you're standing in this home and it files itself here."
            action={<LinkButton href="/capture">Add an item</LinkButton>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 fold:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function sharePercent(
  count: number,
  summaries: { itemCount: number }[],
): number {
  const total = summaries.reduce((n, s) => n + s.itemCount, 0)
  return total ? Math.round((count / total) * 100) : 0
}
