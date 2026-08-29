import Link from 'next/link'

export function DataSettings() {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg">Your data</h2>
      <div className="card divide-y text-sm">
        <Link href="/api/export?format=csv" className="flex items-center justify-between px-4 py-3">
          <span>
            Export everything as CSV
            <span className="block text-xs" style={{ color: 'var(--ink-muted)' }}>
              One row per item, with values and serial numbers — the format an insurer asks for.
            </span>
          </span>
          <span aria-hidden>↓</span>
        </Link>
        <Link href="/api/export?format=json" className="flex items-center justify-between px-4 py-3">
          <span>
            Export everything as JSON
            <span className="block text-xs" style={{ color: 'var(--ink-muted)' }}>
              Complete records including attributes and movement history.
            </span>
          </span>
          <span aria-hidden>↓</span>
        </Link>
        <Link href="/bundles" className="flex items-center justify-between px-4 py-3">
          <span>
            Bundles &amp; bin labels
            <span className="block text-xs" style={{ color: 'var(--ink-muted)' }}>
              Group things that travel together, and print QR labels for storage bins.
            </span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  )
}
