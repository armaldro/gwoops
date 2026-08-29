import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { updateSession } from './middleware'

/**
 * Regression tests for the outage.
 *
 * The middleware used to read its config through a helper that threw on a
 * missing variable. Because middleware runs on every request, that throw
 * became MIDDLEWARE_INVOCATION_FAILED — a 500 on the entire site, /login
 * included, so the deployment could not even report what was wrong.
 *
 * The contract these lock in: with configuration absent, updateSession never
 * throws, and always lands somewhere that can explain itself.
 */

const SUPABASE_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const saved: Record<string, string | undefined> = {}

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(`https://gwoops.com${pathname}`))
}

beforeEach(() => {
  for (const key of SUPABASE_VARS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of SUPABASE_VARS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('updateSession with no Supabase configuration', () => {
  it('does not throw on a protected route', async () => {
    await expect(updateSession(request('/inventory'))).resolves.toBeDefined()
  })

  it('redirects a protected route to the login page with a reason', async () => {
    const response = await updateSession(request('/inventory'))
    expect(response.status).toBe(307)

    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('not-configured')
  })

  it('serves /login itself rather than redirecting it in a loop', async () => {
    // The failure that made the outage unexplainable: if /login also
    // redirects, there is nowhere left to render the reason.
    const response = await updateSession(request('/login'))
    expect(response.status).toBe(200)
  })

  it('lets the auth callback through', async () => {
    const response = await updateSession(request('/auth/callback'))
    expect(response.status).toBe(200)
  })

  it('does not throw on an API route either', async () => {
    await expect(updateSession(request('/api/chat'))).resolves.toBeDefined()
  })
})

describe('updateSession with configuration present but Supabase unreachable', () => {
  beforeEach(() => {
    // A syntactically valid but unroutable origin, so the auth call fails.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://127.0.0.1:1'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('degrades to the login page instead of a 500', async () => {
    const response = await updateSession(request('/inventory'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
  })
})
