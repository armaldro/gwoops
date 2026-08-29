import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/** Routes reachable without a session. Everything else redirects to /login. */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/error']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function redirectTo(request: NextRequest, pathname: string, error?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (error) url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

/**
 * Refreshes the Supabase session and gates the app routes.
 *
 * This runs on every request, which makes it the one place where throwing is
 * catastrophic: an exception here is a 500 on the entire site, /login
 * included, so the deployment gives no clue about what is wrong. It therefore
 * degrades instead of throwing — every failure path ends in a redirect that
 * lands somewhere able to explain itself.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  const config = publicEnv.supabaseConfig()
  if (!config) {
    // Misconfigured deployment. Serve /login so the operator sees the reason
    // rather than a platform error page.
    if (isPublic(pathname)) return NextResponse.next({ request })
    return redirectTo(request, '/login', 'not-configured')
  }

  try {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    })

    // Must run: it refreshes an expired token and rewrites the cookies above.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !isPublic(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    if (user && pathname === '/login') {
      return redirectTo(request, '/')
    }

    return response
  } catch {
    // Supabase unreachable, or anything else unforeseen. An unauthenticated
    // view of /login beats taking down every route.
    if (isPublic(pathname)) return NextResponse.next({ request })
    return redirectTo(request, '/login', 'unavailable')
  }
}
