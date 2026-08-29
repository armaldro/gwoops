/**
 * Instant skeleton for every app route.
 *
 * Every page here is force-dynamic, so each navigation waits on the server.
 * This paints in the same frame as the tap, which is most of what "fast"
 * feels like — the real content streams in behind it.
 */
export default function Loading() {
  return (
    <div className="animate-pulse-soft" aria-hidden>
      <div
        className="h-8 w-48 rounded-lg"
        style={{ background: 'var(--surface-sunk)' }}
      />
      <div
        className="mt-2 h-4 w-64 rounded"
        style={{ background: 'var(--surface-sunk)' }}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div
              className="aspect-square"
              style={{ background: 'var(--surface-sunk)' }}
            />
            <div className="p-3">
              <div
                className="h-4 w-3/4 rounded"
                style={{ background: 'var(--surface-sunk)' }}
              />
              <div
                className="mt-2 h-3 w-1/2 rounded"
                style={{ background: 'var(--surface-sunk)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
