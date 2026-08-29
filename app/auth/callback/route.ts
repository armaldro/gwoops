import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Magic-link landing. Exchanges the code for a session.
 *
 * A rejection here is expected and not an error worth logging loudly: the
 * auth.users trigger refuses accounts that are not allowlisted, which surfaces
 * as a failed exchange. That is the gate working.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link-expired`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const denied = /allowlist|not allowed|Database error/i.test(error.message)
    return NextResponse.redirect(
      `${origin}/login?error=${denied ? 'denied' : 'link-expired'}`,
    )
  }

  // Only ever redirect within this app.
  const destination = next.startsWith('/') ? next : '/'
  return NextResponse.redirect(`${origin}${destination}`)
}
