'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireWallUser } from '@/lib/wall/session'
import { wallAdmin, WALL_BUCKET } from '@/lib/wall/db'
import { newSlug, newGuestToken } from '@/lib/wall/tokens'
import type { WallEvent, WallPost } from '@/lib/wall/types'

/**
 * Host mutations. Every action re-authenticates and scopes by
 * owner_user_id — the admin client never acts on an event the caller
 * does not own.
 */

async function ownedEvent(eventId: string): Promise<WallEvent | null> {
  const { userId } = await requireWallUser()
  const db = wallAdmin()
  const { data } = await db
    .from('wall_events')
    .select('*')
    .eq('id', eventId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  return (data as WallEvent | null) ?? null
}

export async function createEvent(formData: FormData) {
  const { userId } = await requireWallUser()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const db = wallAdmin()
  const { data, error } = await db
    .from('wall_events')
    .insert({
      owner_user_id: userId,
      name,
      event_date: String(formData.get('date') ?? '') || null,
      venue: String(formData.get('venue') ?? '').trim() || null,
      slug: newSlug(),
      guest_token: newGuestToken(),
    })
    .select('id')
    .single()

  if (error || !data) throw new Error('Could not create the event.')
  redirect(`/wall/events/${data.id}`)
}

export async function updateEventSettings(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const event = await ownedEvent(eventId)
  if (!event) return

  const db = wallAdmin()
  await db
    .from('wall_events')
    .update({
      auto_approve: formData.get('auto_approve') === 'on',
      show_wall_qr: formData.get('show_wall_qr') === 'on',
      status: ['draft', 'live', 'ended'].includes(String(formData.get('status')))
        ? String(formData.get('status'))
        : event.status,
    })
    .eq('id', event.id)
  revalidatePath(`/wall/events/${event.id}`)
}

/** FR-EVT-3: invalidate every printed QR without touching the screen URL. */
export async function rotateGuestToken(formData: FormData) {
  const event = await ownedEvent(String(formData.get('eventId') ?? ''))
  if (!event) return
  const db = wallAdmin()
  await db
    .from('wall_events')
    .update({ guest_token: newGuestToken() })
    .eq('id', event.id)
  revalidatePath(`/wall/events/${event.id}`)
}

export async function moderatePost(formData: FormData) {
  const event = await ownedEvent(String(formData.get('eventId') ?? ''))
  if (!event) return
  const postId = String(formData.get('postId') ?? '')
  const action = String(formData.get('action') ?? '')

  const db = wallAdmin()
  const { data } = await db
    .from('wall_posts')
    .select('*')
    .eq('id', postId)
    .eq('event_id', event.id)
    .maybeSingle()
  const post = data as WallPost | null
  if (!post) return

  if (action === 'approve') {
    await db
      .from('wall_posts')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', post.id)
  } else if (action === 'hide') {
    await db.from('wall_posts').update({ status: 'hidden' }).eq('id', post.id)
  } else if (action === 'delete') {
    await db.from('wall_posts').delete().eq('id', post.id)
    if (post.storage_path) {
      await db.storage.from(WALL_BUCKET).remove([post.storage_path])
    }
  }
  revalidatePath(`/wall/events/${event.id}`)
}

export async function setGuestBlocked(formData: FormData) {
  const event = await ownedEvent(String(formData.get('eventId') ?? ''))
  if (!event) return
  const guestId = String(formData.get('guestId') ?? '')
  const blocked = formData.get('blocked') === 'true'

  const db = wallAdmin()
  await db
    .from('wall_guests')
    .update({ blocked })
    .eq('id', guestId)
    .eq('event_id', event.id)
  // Blocking also pulls their live cards off the wall (FR-MOD-5).
  if (blocked) {
    await db
      .from('wall_posts')
      .update({ status: 'hidden' })
      .eq('guest_id', guestId)
      .eq('status', 'approved')
  }
  revalidatePath(`/wall/events/${event.id}`)
}
