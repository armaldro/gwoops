import Link from 'next/link'

export const metadata = { title: 'Sign-in problem' }

export default function AuthErrorPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-2xl">That link did not work</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Sign-in links expire after an hour and can only be used once.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Request a new link
        </Link>
      </div>
    </main>
  )
}
