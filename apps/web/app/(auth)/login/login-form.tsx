'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type State =
  | { status: 'idle' }
  | { status: 'signing-in' }
  | { status: 'sending-link' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string }

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  const busy = state.status === 'signing-in' || state.status === 'sending-link'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !password) return

    setState({ status: 'signing-in' })

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })

    if (error) {
      setState({ status: 'error', message: error.message })
      return
    }

    // Full navigation, not a router push: the middleware must see the fresh
    // session cookies before it will let an app route render.
    window.location.assign(next && next.startsWith('/') ? next : '/')
  }

  async function sendMagicLink() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setState({ status: 'error', message: 'Enter your email address first.' })
      return
    }

    setState({ status: 'sending-link' })

    const redirectTo = new URL('/auth/callback', window.location.origin)
    if (next) redirectTo.searchParams.set('next', next)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo.toString() },
    })

    if (error) {
      setState({ status: 'error', message: error.message })
      return
    }

    setState({ status: 'sent', email: trimmed })
  }

  if (state.status === 'sent') {
    return (
      <div className="card p-6 text-center">
        <div aria-hidden className="mb-3 text-3xl">
          ✉️
        </div>
        <h2 className="font-display text-lg">Check your inbox</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          If <span className="font-medium">{state.email}</span> is on the
          allowlist, a sign-in link is on its way. The link works once and
          expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-4 text-sm underline underline-offset-4"
          style={{ color: 'var(--accent)' }}
        >
          Use a different address
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <label htmlFor="email" className="block text-sm font-medium">
        Email address
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="field mt-2"
      />

      <label htmlFor="password" className="mt-4 block text-sm font-medium">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="field mt-2"
      />

      {state.status === 'error' && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {state.status === 'signing-in' ? 'Signing in…' : 'Sign in'}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={sendMagicLink}
        className="mt-3 w-full text-center text-sm underline underline-offset-4 disabled:opacity-60"
        style={{ color: 'var(--accent)' }}
      >
        {state.status === 'sending-link'
          ? 'Sending…'
          : 'Email me a sign-in link instead'}
      </button>
    </form>
  )
}
