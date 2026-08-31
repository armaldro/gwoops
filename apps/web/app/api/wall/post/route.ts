import { NextResponse } from 'next/server'
import {
  wallAdmin,
  eventByGuestToken,
  guestByDeviceToken,
  WALL_BUCKET,
} from '@/lib/wall/db'
import { screenPhoto, screenMessage, initialStatus } from '@/lib/wall/safety'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** ~2 MB of JPEG after the client's downscale — anything bigger is not ours. */
const MAX_PHOTO_BASE64 = 2 * 1024 * 1024 * 1.4
const PER_MINUTE_LIMIT = 12

export async function POST(request: Request) {
  let body: {
    token?: string
    deviceToken?: string
    kind?: 'photo' | 'message'
    message?: string
    photoBase64?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  if (!body.token || !body.deviceToken || !body.kind) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const db = wallAdmin()
  const event = await eventByGuestToken(db, body.token)
  if (!event || event.status !== 'live') {
    return NextResponse.json(
      { error: 'This event is not accepting photos right now.' },
      { status: 410 },
    )
  }

  const guest = await guestByDeviceToken(db, event.id, body.deviceToken)
  if (!guest) {
    return NextResponse.json({ error: 'Scan the QR code to join first.' }, { status: 401 })
  }
  if (guest.blocked) {
    return NextResponse.json(
      { error: 'Uploads from this device have been paused by the hosts.' },
      { status: 403 },
    )
  }

  // Caps: total per guest, and a per-minute burst limit.
  const [{ count: total }, { count: lastMinute }] = await Promise.all([
    db
      .from('wall_posts')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guest.id),
    db
      .from('wall_posts')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guest.id)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString()),
  ])
  if ((total ?? 0) >= event.max_posts_per_guest) {
    return NextResponse.json(
      { error: `You've shared ${event.max_posts_per_guest} already — what a guest! The hosts capped it there.` },
      { status: 429 },
    )
  }
  if ((lastMinute ?? 0) >= PER_MINUTE_LIMIT) {
    return NextResponse.json(
      { error: 'Whoa, slow down a little — try again in a minute.' },
      { status: 429 },
    )
  }

  const message = body.message?.trim().slice(0, 280) || null

  if (body.kind === 'message') {
    if (!message) {
      return NextResponse.json({ error: 'Write a little something first.' }, { status: 400 })
    }
    const safety = screenMessage(message)
    const status = initialStatus(safety, event.auto_approve)
    const { data, error } = await db
      .from('wall_posts')
      .insert({
        event_id: event.id,
        guest_id: guest.id,
        kind: 'message',
        message,
        safety,
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .select('id, status')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Could not post — try again.' }, { status: 500 })
    }
    return NextResponse.json({ id: data.id, status: data.status })
  }

  // kind === 'photo'
  const base64 = body.photoBase64
  if (!base64) {
    return NextResponse.json({ error: 'No photo received.' }, { status: 400 })
  }
  if (base64.length > MAX_PHOTO_BASE64) {
    return NextResponse.json(
      { error: 'That photo is too large — try again, it will be resized.' },
      { status: 413 },
    )
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(base64, 'base64')
  } catch {
    return NextResponse.json({ error: 'Unreadable photo data.' }, { status: 400 })
  }

  const postId = crypto.randomUUID()
  const path = `${event.id}/${postId}.jpg`
  const upload = await db.storage
    .from(WALL_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg' })
  if (upload.error) {
    return NextResponse.json(
      { error: 'Could not save the photo — try again.' },
      { status: 500 },
    )
  }

  const safety = await screenPhoto(base64)
  if (safety === 'flagged') {
    // Held for the hosts; the object stays so they can review it in the queue.
  }
  const status = initialStatus(safety, event.auto_approve)

  const { data, error } = await db
    .from('wall_posts')
    .insert({
      id: postId,
      event_id: event.id,
      guest_id: guest.id,
      kind: 'photo',
      storage_path: path,
      message,
      safety,
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    })
    .select('id, status')
    .single()

  if (error || !data) {
    await db.storage.from(WALL_BUCKET).remove([path])
    return NextResponse.json({ error: 'Could not post — try again.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, status: data.status })
}
