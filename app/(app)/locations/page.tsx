import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { fetchLocationSummaries } from '@/lib/queries'
import { locationColorVar } from '@/lib/colors'
import { Empty, LinkButton, PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Homes' }

export default async function LocationsPage() {
  await requireSession()
  const { summaries, unassigned } = await fetchLocationSummaries()

  return (
    <>
      <PageHeader
        title="Homes"
        subtitle="Where your things live."
        action={<LinkButton href="/settings" variant="secondary">Manage</LinkButton>}
      />

      {summaries.length === 0 ? (
        <Empty
          icon="🏠"
          title="No homes yet"
          body="Add the places you keep things, then start photographing."
          action={<LinkButton href="/settings">Add a home</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 fold:grid-cols-3">
          {summaries.map((summary) => (
            <Link
              key={summary.location.id}
              href={`/locations/${summary.location.id}`}
              className="card p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg">
                  <span aria-hidden className="mr-1.5">{summary.location.emoji}</span>
                  {summary.location.name}
                </span>
                <span
                  className="tabular text-sm"
                  style={{ color: locationColorVar(summary.location.color) }}
                >
                  {summary.itemCount}
                </span>
              </div>
              {summary.location.address && (
                <p className="mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {summary.location.address}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                {summary.byCategory.slice(0, 5).map((category) => (
                  <span key={category.slug}>
                    <span aria-hidden>{category.icon}</span> {category.count}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {unassigned > 0 && (
        <Link
          href="/inventory?location=none"
          className="mt-4 inline-block text-sm underline underline-offset-4"
          style={{ color: 'var(--warning)' }}
        >
          {unassigned} {unassigned === 1 ? 'item has' : 'items have'} no home set
        </Link>
      )}
    </>
  )
}
