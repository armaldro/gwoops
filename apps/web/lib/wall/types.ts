/**
 * Row types for the wall tables.
 *
 * Kept separate from Nest's generated Database type on purpose: the wall's
 * server code talks to these tables through the service-role client with
 * every query scoped in code, and a hand-written type per table keeps that
 * surface explicit.
 */

export type WallEventStatus = 'draft' | 'live' | 'ended'
export type WallPostKind = 'photo' | 'message'
export type WallPostStatus = 'pending' | 'approved' | 'hidden'
export type WallSafety = 'unchecked' | 'passed' | 'flagged'

export interface WallEvent {
  id: string
  owner_user_id: string
  name: string
  event_date: string | null
  venue: string | null
  slug: string
  guest_token: string
  status: WallEventStatus
  auto_approve: boolean
  show_wall_qr: boolean
  max_posts_per_guest: number
  created_at: string
}

export interface WallGuest {
  id: string
  event_id: string
  device_token: string
  name: string
  blocked: boolean
  created_at: string
}

export interface WallPost {
  id: string
  event_id: string
  guest_id: string
  kind: WallPostKind
  storage_path: string | null
  message: string | null
  status: WallPostStatus
  safety: WallSafety
  created_at: string
  approved_at: string | null
}

/** What the screen and guest clients receive — never raw rows. */
export interface WallCard {
  id: string
  kind: WallPostKind
  photoUrl: string | null
  message: string | null
  guestName: string
  createdAt: string
}
