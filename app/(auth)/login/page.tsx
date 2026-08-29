import { BRAND } from '@/lib/brand'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  'no-household':
    'That account is not attached to a household. Ask an owner to invite you.',
  'link-expired':
    'That sign-in link has expired or was already used. Request a fresh one.',
  denied: 'That email is not on the household allowlist.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const error = params.error ? (ERRORS[params.error] ?? params.error) : null

  return (
    <main className="min-h-dvh grid place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div
            aria-hidden
            className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            style={{ background: 'var(--accent-soft)' }}
          >
            🏡
          </div>
          <h1 className="font-display text-3xl">{BRAND.name}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            {BRAND.tagline}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg px-4 py-3 text-sm"
            style={{ background: 'var(--accent-soft)', color: 'var(--danger)' }}
          >
            {error}
          </div>
        )}

        <LoginForm next={params.next} />

        <p
          className="mt-8 text-center text-xs leading-relaxed"
          style={{ color: 'var(--ink-faint)' }}
        >
          This household is invite-only. Sign-in links only work for addresses an
          owner has added — everyone else is turned away even with a valid link.
        </p>
      </div>
    </main>
  )
}
