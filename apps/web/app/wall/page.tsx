import Link from 'next/link'
import { requireWallUser } from '@/lib/wall/session'
import { wallAdmin } from '@/lib/wall/db'
import { createEvent } from '@/app/wall/actions'
import type { WallEvent } from '@/lib/wall/types'

export const metadata = { title: 'Photo walls' }
export const dynamic = 'force-dynamic'

export default async function WallDashboard() {
  const { userId } = await requireWallUser()
  const db = wallAdmin()
  const { data } = await db
    .from('wall_events')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
  const events = (data ?? []) as WallEvent[]

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl">Photo walls</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          A live wall for the big day — guests scan, share, and it all lands on
          the screen.
        </p>
      </header>

      <form action={createEvent} className="card p-5">
        <h2 className="text-sm font-semibold">New event</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            required
            className="field sm:col-span-2"
            placeholder="Soon How ♥ Georgina"
            maxLength={80}
          />
          <input name="date" type="date" className="field" aria-label="Event date" />
          <input
            name="venue"
            className="field"
            placeholder="Venue (optional)"
            maxLength={120}
          />
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Create the wall
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/wall/events/${event.id}`}
            className="card flex items-center justify-between p-5"
          >
            <div>
              <div className="font-display text-lg">{event.name}</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                {event.event_date ?? 'No date yet'}
                {event.venue ? ` · ${event.venue}` : ''}
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: event.status === 'live' ? 'var(--accent-soft)' : 'var(--surface-sunk)',
                color: event.status === 'live' ? 'var(--accent)' : 'var(--ink-muted)',
              }}
            >
              {event.status}
            </span>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            No walls yet — create the first one above.
          </p>
        )}
      </div>
    </main>
  )
}
