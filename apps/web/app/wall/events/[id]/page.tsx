import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireWallUser } from '@/lib/wall/session'
import { wallAdmin, signWallUrls } from '@/lib/wall/db'
import { publicEnv } from '@/lib/env'
import {
  updateEventSettings,
  rotateGuestToken,
  moderatePost,
  setGuestBlocked,
} from '@/app/wall/actions'
import type { WallEvent, WallGuest, WallPost } from '@/lib/wall/types'

export const metadata = { title: 'Wall event' }
export const dynamic = 'force-dynamic'

type PostRow = WallPost & { wall_guests: { name: string } | null }

export default async function WallEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireWallUser()
  const db = wallAdmin()

  const { data: eventRow } = await db
    .from('wall_events')
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', userId)
    .maybeSingle()
  const event = eventRow as WallEvent | null
  if (!event) notFound()

  const [{ data: pendingRows }, { data: recentRows }, { data: guestRows }] =
    await Promise.all([
      db
        .from('wall_posts')
        .select('*, wall_guests ( name )')
        .eq('event_id', event.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(60),
      db
        .from('wall_posts')
        .select('*, wall_guests ( name )')
        .eq('event_id', event.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30),
      db
        .from('wall_guests')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

  const pending = (pendingRows ?? []) as PostRow[]
  const recent = (recentRows ?? []) as PostRow[]
  const guests = (guestRows ?? []) as WallGuest[]
  const urls = await signWallUrls(
    db,
    [...pending, ...recent].map((p) => p.storage_path),
  )

  const site = publicEnv.siteUrl()
  const wallUrl = `${site}/w/${event.slug}`
  const joinUrl = `${site}/j/${event.guest_token}`

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-4 text-sm">
        <Link href="/wall" style={{ color: 'var(--accent)' }}>
          ← All walls
        </Link>
      </p>
      <header className="mb-6">
        <h1 className="font-display text-3xl">{event.name}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          {event.event_date ?? 'No date yet'}
          {event.venue ? ` · ${event.venue}` : ''}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Links</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              THE SCREEN — open on the venue TV, then press F11
            </dt>
            <dd className="mt-0.5 break-all">
              <a href={wallUrl} target="_blank" style={{ color: 'var(--accent)' }}>
                {wallUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              GUESTS — this is what the QR opens
            </dt>
            <dd className="mt-0.5 break-all">
              <a href={joinUrl} target="_blank" style={{ color: 'var(--accent)' }}>
                {joinUrl}
              </a>
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/wall/events/${event.id}/print`}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            🖨️ Print the QR posters
          </Link>
          <form action={rotateGuestToken}>
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              Rotate guest link
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          Rotating kills every printed QR (reprint after!) but never touches the
          screen link.
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold">Settings</h2>
        <form action={updateEventSettings} className="mt-3 grid gap-3 text-sm">
          <input type="hidden" name="eventId" value={event.id} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="auto_approve" defaultChecked={event.auto_approve} />
            Auto-approve photos that pass the safety screen
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="show_wall_qr" defaultChecked={event.show_wall_qr} />
            Show the join QR in the wall&rsquo;s corner
          </label>
          <label className="flex items-center gap-2">
            Status
            <select name="status" defaultValue={event.status} className="field w-auto">
              <option value="draft">draft — nothing visible yet</option>
              <option value="live">live — accepting photos</option>
              <option value="ended">ended — wall stays, uploads stop</option>
            </select>
          </label>
          <button
            type="submit"
            className="w-fit rounded-lg border px-4 py-2 font-medium"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            Save settings
          </button>
        </form>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold">
          Waiting for you ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-faint)' }}>
            Nothing pending. New uploads land here when they need a human eye.
          </p>
        )}
        <div className="mt-3 grid gap-3">
          {pending.map((post) => (
            <ModerationRow key={post.id} post={post} urls={urls} eventId={event.id} pending />
          ))}
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold">Recently on the wall</h2>
        <div className="mt-3 grid gap-3">
          {recent.map((post) => (
            <ModerationRow key={post.id} post={post} urls={urls} eventId={event.id} />
          ))}
          {recent.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
              Nothing on the wall yet.
            </p>
          )}
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold">Guests ({guests.length})</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {guests.map((guest) => (
            <div key={guest.id} className="flex items-center justify-between gap-3">
              <span className={guest.blocked ? 'line-through opacity-60' : ''}>
                {guest.name}
              </span>
              <form action={setGuestBlocked}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="guestId" value={guest.id} />
                <input type="hidden" name="blocked" value={guest.blocked ? 'false' : 'true'} />
                <button
                  type="submit"
                  className="text-xs underline underline-offset-4"
                  style={{ color: guest.blocked ? 'var(--positive)' : 'var(--danger)' }}
                >
                  {guest.blocked ? 'Unblock' : 'Block'}
                </button>
              </form>
            </div>
          ))}
          {guests.length === 0 && (
            <p style={{ color: 'var(--ink-faint)' }}>No guests have joined yet.</p>
          )}
        </div>
      </section>
    </main>
  )
}

function ModerationRow({
  post,
  urls,
  eventId,
  pending = false,
}: {
  post: PostRow
  urls: Map<string, string>
  eventId: string
  pending?: boolean
}) {
  const photoUrl = post.storage_path ? urls.get(post.storage_path) : null
  return (
    <div className="flex items-center gap-3">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
      ) : (
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-md text-xl"
          style={{ background: 'var(--accent-soft)' }}
        >
          💌
        </div>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">{post.wall_guests?.name ?? 'A guest'}</div>
        {post.message && <div className="truncate">{post.message}</div>}
        {post.safety === 'flagged' && (
          <div className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
            ⚠ flagged by the safety screen
          </div>
        )}
        {post.safety === 'unchecked' && pending && (
          <div className="text-xs" style={{ color: 'var(--warning)' }}>
            screen unavailable — needs your eyes
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {pending && (
          <form action={moderatePost}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="action" value="approve" />
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              Approve
            </button>
          </form>
        )}
        <form action={moderatePost}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="action" value="hide" />
          <button
            type="submit"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-muted)' }}
          >
            Hide
          </button>
        </form>
      </div>
    </div>
  )
}
