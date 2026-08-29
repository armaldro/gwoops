'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { publicEnv } from '@/lib/env'

type State =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string }

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setState({ status: 'sending' })

    const redirectTo = new URL('/auth/callback', publicEnv.siteUrl())
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

      {state.status === 'error' && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.status === 'sending'}
        className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {state.status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  )
}
