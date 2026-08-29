import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { updateSession } from './middleware'
import { publicEnv } from '@/lib/env'

/**
 * Regression tests for the two configuration outages.
 *
 * First outage: the middleware read its config through a helper that threw on
 * a missing variable. Middleware runs on every request, so that throw became
 * MIDDLEWARE_INVOCATION_FAILED — a 500 on the entire site, /login included.
 *
 * Second failure mode: Vercel "Sensitive" env vars are withheld from the
 * build step, so NEXT_PUBLIC_* inlined as "" — present but empty. env.ts now
 * bakes in the public Supabase URL and publishable key as defaults, and
 * treats empty strings as absent.
 *
 * The contract these lock in: updateSession never throws, always lands
 * somewhere that can explain itself, and configuration is never null.
 */

const SUPABASE_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
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

describe('configuration resolution', () => {
  it('is never null: baked defaults apply when no env vars are set', () => {
    const config = publicEnv.supabaseConfig()
    expect(config.url).toMatch(/^https:\/\/.+\.supabase\.co$/)
    expect(config.anonKey).not.toBe('')
  })

  it('treats empty strings as absent (Sensitive-var build inlining)', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    const config = publicEnv.supabaseConfig()
    expect(config.url).toMatch(/^https:\/\/.+\.supabase\.co$/)
    expect(config.anonKey).not.toBe('')
  })

  it('lets env vars override the defaults', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'override-key'
    const config = publicEnv.supabaseConfig()
    expect(config.url).toBe('https://example.supabase.co')
    expect(config.anonKey).toBe('override-key')
  })
})

describe('updateSession with Supabase unreachable', () => {
  beforeEach(() => {
    // A syntactically valid but unroutable origin, so the auth call fails
    // without touching the network beyond the loopback interface.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://127.0.0.1:1'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('does not throw on a protected route', async () => {
    await expect(updateSession(request('/inventory'))).resolves.toBeDefined()
  })

  it('degrades a protected route to the login page, keeping the destination', async () => {
    // supabase-js absorbs the network failure and reports "no user", so this
    // takes the ordinary unauthenticated path rather than the catch branch.
    const response = await updateSession(request('/inventory'))
    expect(response.status).toBe(307)

    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe('/inventory')
  })

  it('serves /login itself rather than redirecting it in a loop', async () => {
    // The failure that made the first outage unexplainable: if /login also
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
