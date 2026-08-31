import { NextResponse } from 'next/server'
import { wallAdmin, eventByGuestToken, guestByDeviceToken } from '@/lib/wall/db'
import { newDeviceToken } from '@/lib/wall/tokens'

export const dynamic = 'force-dynamic'

/**
 * A guest scans the QR and gives their name. No account: the response carries
 * a device token that authorises their later uploads and deletes.
 */
export async function POST(request: Request) {
  let body: { token?: string; name?: string; deviceToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const name = body.name?.trim().slice(0, 60)
  if (!body.token || !name) {
    return NextResponse.json({ error: 'A name is required.' }, { status: 400 })
  }

  const db = wallAdmin()
  const event = await eventByGuestToken(db, body.token)
  if (!event || event.status === 'draft') {
    return NextResponse.json(
      { error: 'This link is not active. Check with the couple!' },
      { status: 404 },
    )
  }
  if (event.status === 'ended') {
    return NextResponse.json(
      { error: 'This event has ended — thank you for celebrating with us!' },
      { status: 410 },
    )
  }

  // A rescan from the same phone renames rather than duplicating.
  if (body.deviceToken) {
    const existing = await guestByDeviceToken(db, event.id, body.deviceToken)
    if (existing && !existing.blocked) {
      await db.from('wall_guests').update({ name }).eq('id', existing.id)
      return NextResponse.json({
        deviceToken: existing.device_token,
        event: publicEvent(event),
      })
    }
  }

  const deviceToken = newDeviceToken()
  const { error } = await db.from('wall_guests').insert({
    event_id: event.id,
    device_token: deviceToken,
    name,
  })
  if (error) {
    return NextResponse.json(
      { error: 'Could not join right now — try again in a moment.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ deviceToken, event: publicEvent(event) })
}

function publicEvent(event: {
  name: string
  event_date: string | null
  venue: string | null
}) {
  return { name: event.name, date: event.event_date, venue: event.venue }
}
