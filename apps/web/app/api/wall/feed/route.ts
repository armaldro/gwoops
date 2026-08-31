import { NextResponse } from 'next/server'
import { publicEnv } from '@/lib/env'
import { wallAdmin, eventBySlug, signWallUrls, toCard } from '@/lib/wall/db'
import type { WallPost } from '@/lib/wall/types'

export const dynamic = 'force-dynamic'

const FEED_LIMIT = 120

/**
 * The screen's poll. Public by design — the slug is the capability — and it
 * returns only approved cards, so pending and hidden posts never leave the
 * server.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const db = wallAdmin()
  const event = await eventBySlug(db, slug)
  if (!event || event.status === 'draft') {
    return NextResponse.json({ error: 'No such wall.' }, { status: 404 })
  }

  const { data, error } = await db
    .from('wall_posts')
    .select('*, wall_guests ( name )')
    .eq('event_id', event.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)

  if (error) {
    return NextResponse.json({ error: 'Feed unavailable.' }, { status: 500 })
  }

  type Row = WallPost & { wall_guests: { name: string } | null }
  const rows = (data ?? []) as Row[]
  const urls = await signWallUrls(db, rows.map((r) => r.storage_path))

  const cards = rows.map((r) => toCard(r, r.wall_guests?.name ?? 'A guest', urls))

  return NextResponse.json({
    event: {
      name: event.name,
      date: event.event_date,
      venue: event.venue,
      status: event.status,
      showQr: event.show_wall_qr,
    },
    joinUrl: `${publicEnv.siteUrl()}/j/${event.guest_token}`,
    cards,
  })
}
