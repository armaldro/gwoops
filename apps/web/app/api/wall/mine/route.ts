import { NextResponse } from 'next/server'
import {
  wallAdmin,
  eventByGuestToken,
  guestByDeviceToken,
  signWallUrls,
  toCard,
} from '@/lib/wall/db'
import type { WallPost } from '@/lib/wall/types'

export const dynamic = 'force-dynamic'

/** A guest's own posts, with their moderation status. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const deviceToken = url.searchParams.get('deviceToken')
  if (!token || !deviceToken) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const db = wallAdmin()
  const event = await eventByGuestToken(db, token)
  if (!event) return NextResponse.json({ error: 'No such event.' }, { status: 404 })

  const guest = await guestByDeviceToken(db, event.id, deviceToken)
  if (!guest) return NextResponse.json({ error: 'Join first.' }, { status: 401 })

  const { data } = await db
    .from('wall_posts')
    .select('*')
    .eq('guest_id', guest.id)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (data ?? []) as WallPost[]
  const urls = await signWallUrls(db, rows.map((r) => r.storage_path))

  return NextResponse.json({
    name: guest.name,
    posts: rows.map((r) => ({ ...toCard(r, guest.name, urls), status: r.status })),
  })
}
