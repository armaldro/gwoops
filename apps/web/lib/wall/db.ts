import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'
import type { WallCard, WallEvent, WallGuest, WallPost } from '@/lib/wall/types'

export const WALL_BUCKET = 'wall-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * Service-role client for the wall's guest and screen paths.
 *
 * Guests have no account, so RLS cannot carry their identity; instead every
 * caller of this client scopes queries by event id + token, validated first.
 * This is the third sanctioned service-role path alongside Nest's invite
 * writer and reminders cron — see the migration header for the reasoning.
 */
export function wallAdmin() {
  return createSupabaseClient(publicEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Admin = ReturnType<typeof wallAdmin>

export async function eventBySlug(db: Admin, slug: string): Promise<WallEvent | null> {
  const { data } = await db.from('wall_events').select('*').eq('slug', slug).maybeSingle()
  return (data as WallEvent | null) ?? null
}

export async function eventByGuestToken(db: Admin, token: string): Promise<WallEvent | null> {
  const { data } = await db
    .from('wall_events')
    .select('*')
    .eq('guest_token', token)
    .maybeSingle()
  return (data as WallEvent | null) ?? null
}

/** A guest by device token, verified to belong to the given event. */
export async function guestByDeviceToken(
  db: Admin,
  eventId: string,
  deviceToken: string,
): Promise<WallGuest | null> {
  const { data } = await db
    .from('wall_guests')
    .select('*')
    .eq('device_token', deviceToken)
    .eq('event_id', eventId)
    .maybeSingle()
  return (data as WallGuest | null) ?? null
}

export async function signWallUrls(
  db: Admin,
  paths: readonly (string | null)[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (unique.length === 0) return urls
  const { data } = await db.storage
    .from(WALL_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl)
  }
  return urls
}

export function toCard(
  post: WallPost,
  guestName: string,
  urls: Map<string, string>,
): WallCard {
  return {
    id: post.id,
    kind: post.kind,
    photoUrl: post.storage_path ? (urls.get(post.storage_path) ?? null) : null,
    message: post.message,
    guestName,
    createdAt: post.created_at,
  }
}
