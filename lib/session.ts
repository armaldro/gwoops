import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { HouseholdMemberRow, LocationRow } from '@/lib/supabase/types'

export interface Session {
  userId: string
  email: string
  member: HouseholdMemberRow
  householdId: string
  canWrite: boolean
}

/**
 * The session every authenticated page and route starts from.
 *
 * A signed-in user with no household_members row means the allowlist trigger
 * did not run (an account created before this app's schema, say). Rather than
 * showing an empty app, sign them out — the invariant is that an account
 * always belongs to a household.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    await supabase.auth.signOut()
    redirect('/login?error=no-household')
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    member,
    householdId: member.household_id,
    canWrite: member.role !== 'viewer',
  }
}

/** Same, but returns null instead of redirecting — for API routes. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return null

  return {
    userId: user.id,
    email: user.email ?? '',
    member,
    householdId: member.household_id,
    canWrite: member.role !== 'viewer',
  }
}

export async function getLocations(): Promise<LocationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order')
    .order('name')
  return data ?? []
}
