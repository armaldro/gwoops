'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { nextLocationColor } from '@/lib/colors'
import type { ActionResult } from '@/lib/actions/items'
import type { MemberRole } from '@/lib/supabase/types'

export async function upsertLocation(input: {
  id?: string
  name: string
  emoji: string
  address: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  radiusM: number
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const fields = {
    name: input.name.trim(),
    emoji: input.emoji || '🏠',
    address: input.address,
    notes: input.notes,
    lat: input.lat,
    lng: input.lng,
    radius_m: Math.max(25, Math.round(input.radiusM || 150)),
  }

  if (!fields.name) return { ok: false, error: 'Give the home a name.' }

  if (input.id) {
    const { error } = await supabase.from('locations').update(fields).eq('id', input.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data: existing } = await supabase.from('locations').select('color')
    const { error } = await supabase.from('locations').insert({
      household_id: session.householdId,
      ...fields,
      color: nextLocationColor((existing ?? []).map((l) => l.color)),
      sort_order: existing?.length ?? 0,
    })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/locations')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { count } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', id)

  if (count && count > 0) {
    return {
      ok: false,
      error: `${count} ${count === 1 ? 'item lives' : 'items live'} there. Move them somewhere else first.`,
    }
  }

  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  revalidatePath('/locations')
  return { ok: true }
}

/**
 * Add someone to the allowlist.
 *
 * Uses the service-role client because the invitee has no account yet, so
 * there is no session whose RLS context could cover the write. Ownership is
 * checked here, in application code, before that key is used.
 */
export async function inviteMember(
  email: string,
  role: MemberRole,
  displayName?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Not signed in.' }
  if (session.member.role !== 'owner') {
    return { ok: false, error: 'Only an owner can invite people.' }
  }

  const normalised = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return { ok: false, error: 'That does not look like an email address.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('allowed_emails').upsert(
    {
      email: normalised,
      household_id: session.householdId,
      role,
      display_name: displayName?.trim() || null,
      invited_by: session.userId,
    },
    { onConflict: 'email' },
  )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  return { ok: true }
}

export async function revokeInvite(email: string): Promise<ActionResult> {
  const session = await getSession()
  if (session?.member.role !== 'owner') {
    return { ok: false, error: 'Only an owner can change the allowlist.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('allowed_emails')
    .delete()
    .eq('email', email.toLowerCase())
    .eq('household_id', session.householdId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  return { ok: true }
}

export async function updateProfile(input: {
  displayName: string
  avatarEmoji: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Not signed in.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('household_members')
    .update({
      display_name: input.displayName.trim() || session.member.display_name,
      avatar_emoji: input.avatarEmoji || '🙂',
    })
    .eq('id', session.member.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
