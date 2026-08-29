import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { fetchItems, fetchLocationSummaries } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { locationColorVar } from '@nest/domain/colors'
import { LinkButton, Empty, PageHeader } from '@/components/ui/primitives'
import { ItemCard } from '@/components/items/item-card'

export const dynamic = 'force-dynamic'

interface DueReminder {
  id: string
  kind: string
  dueOn: string
  itemId: string | null
  itemName: string
}

export default async function HomePage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [{ summaries, unassigned }, { items: recent }, reminderResult] =
    await Promise.all([
      fetchLocationSummaries(),
      fetchItems({ limit: 8, status: 'active' }),
      supabase
        .from('reminders')
        .select('id, kind, due_on, items ( id, name )')
        .is('dismissed_at', null)
        .lte('due_on', inDays(45))
        .order('due_on')
        .limit(4),
    ])

  const dueReminders: DueReminder[] = (reminderResult.data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      kind: string
      due_on: string
      items: { id: string; name: string } | null
    }
    return {
      id: r.id,
      kind: r.kind,
      dueOn: r.due_on,
      itemId: r.items?.id ?? null,
      itemName: r.items?.name ?? 'Item',
    }
  })

  const total = summaries.reduce((n, s) => n + s.itemCount, 0) + unassigned
  const hasAnything = total > 0

  return (
    <>
      <PageHeader
        title={greeting(session.member.display_name)}
        subtitle={
          hasAnything
            ? `${total} ${total === 1 ? 'item' : 'items'} across ${summaries.length} ${summaries.length === 1 ? 'home' : 'homes'}.`
            : 'Nothing catalogued yet. Start with a shelf.'
        }
        action={<LinkButton href="/capture">📸 Add an item</LinkButton>}
      />

      {!hasAnything ? (
        <Empty
          icon="🏡"
          title="Your inventory starts here"
          body="Point your camera at something you own. It gets named, categorised and filed to the home you're standing in."
          action={<LinkButton href="/capture">Take the first photo</LinkButton>}
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-lg">Where things are</h2>
            <div className="grid gap-3 sm:grid-cols-2 fold:grid-cols-3">
              {summaries.map((summary) => {
                const tone = locationColorVar(summary.location.color)
                const share = total ? Math.round((summary.itemCount / total) * 100) : 0
                return (
                  <Link
                    key={summary.location.id}
                    href={`/locations/${summary.location.id}`}
                    className="card p-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-base">
                        <span aria-hidden className="mr-1.5">
                          {summary.location.emoji}
                        </span>
                        {summary.location.name}
                      </span>
                      <span className="tabular text-sm" style={{ color: tone }}>
                        {summary.itemCount}
                      </span>
                    </div>

                    {/* Category mix as a single stacked bar — reads faster than
                        a legend at this size. */}
                    <div
                      className="mt-3 flex h-1.5 overflow-hidden rounded-full"
                      style={{ background: 'var(--surface-sunk)' }}
                      role="img"
                      aria-label={summary.byCategory
                        .map((c) => `${c.label}: ${c.count}`)
                        .join(', ')}
                    >
                      {summary.byCategory.slice(0, 6).map((category, i) => (
                        <span
                          key={category.slug}
                          style={{
                            width: `${(category.count / Math.max(1, summary.itemCount)) * 100}%`,
                            background: tone,
                            opacity: 1 - i * 0.14,
                          }}
                        />
                      ))}
                    </div>

                    <div
                      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {summary.byCategory.slice(0, 3).map((category) => (
                        <span key={category.slug}>
                          <span aria-hidden>{category.icon}</span> {category.count}{' '}
                          {category.label.toLowerCase()}
                        </span>
                      ))}
                      {summary.byCategory.length === 0 && <span>Nothing here yet</span>}
                    </div>

                    <div className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {share}% of everything you own
                    </div>
                  </Link>
                )
              })}
            </div>

            {unassigned > 0 && (
              <Link
                href="/inventory?location=none"
                className="mt-3 block text-sm underline underline-offset-4"
                style={{ color: 'var(--warning)' }}
              >
                {unassigned} {unassigned === 1 ? 'item has' : 'items have'} no home set
              </Link>
            )}
          </section>

          {dueReminders.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg">Coming up</h2>
              <ul className="card divide-y">
                {dueReminders.map((reminder) => (
                  <li
                    key={reminder.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    {reminder.itemId ? (
                      <Link href={`/items/${reminder.itemId}`} className="text-sm">
                        {reminder.itemName}
                      </Link>
                    ) : (
                      <span className="text-sm">{reminder.itemName}</span>
                    )}
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: 'var(--warning)' }}
                    >
                      {reminderLabel(reminder.kind)} · {formatDate(reminder.dueOn)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg">Recently added</h2>
              <Link href="/inventory" className="text-sm" style={{ color: 'var(--accent)' }}>
                See everything
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 fold:grid-cols-4">
              {recent.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg">Ask about your things</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Try “split my shoes evenly between the houses” or “what am I missing
              in Bali?”
            </p>
            <LinkButton href="/chat" variant="secondary" className="mt-4">
              💬 Open the assistant
            </LinkButton>
          </section>
        </div>
      )}
    </>
  )
}

function greeting(name: string): string {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  return `${part}, ${name.split(' ')[0]}`
}

function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function reminderLabel(kind: string): string {
  return { warranty: 'Warranty ends', expiry: 'Expires', service: 'Service due' }[kind] ?? kind
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
