import { NextResponse } from 'next/server'
import {
  wallAdmin,
  eventByGuestToken,
  guestByDeviceToken,
  WALL_BUCKET,
} from '@/lib/wall/db'
import type { WallPost } from '@/lib/wall/types'

export const dynamic = 'force-dynamic'

/** A guest removes their own post — card and stored photo both go. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
    .eq('id', id)
    .eq('guest_id', guest.id)
    .maybeSingle()
  const post = data as WallPost | null
  if (!post) return NextResponse.json({ error: 'Not your post.' }, { status: 404 })

  const { error } = await db.from('wall_posts').delete().eq('id', post.id)
  if (error) {
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
  if (post.storage_path) {
    await db.storage.from(WALL_BUCKET).remove([post.storage_path])
  }

  return NextResponse.json({ ok: true })
}
