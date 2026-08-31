import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/** Routes reachable without a session. Everything else redirects to /login. */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/error']

/**
 * Wall guest and screen routes: no session exists or is wanted there, so they
 * skip session handling entirely — a guest on venue Wi-Fi shouldn't pay an
 * auth round trip, and the unattended screen must not depend on one.
 * Note '/w/' and '/j/' carry the trailing slash: '/wall' (host-only) must
 * NOT match.
 */
const WALL_PUBLIC_PREFIXES = ['/w/', '/j/', '/api/wall']

export function isWallPublic(pathname: string): boolean {
  return WALL_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

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

  if (isWallPublic(pathname)) return NextResponse.next({ request })

  // Never null: env.ts falls back to baked-in public defaults.
  const config = publicEnv.supabaseConfig()

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
