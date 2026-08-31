import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Host access for /wall pages.
 *
 * Deliberately lighter than Nest's requireSession: a wall host needs a signed-in
 * user, not a household membership, so the same accounts work even if Nest's
 * tables are ever split away.
 */
export async function requireWallUser(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/wall')
  return { userId: user.id, email: user.email ?? '' }
}
