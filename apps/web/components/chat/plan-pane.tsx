'use client'

import { useEffect, useState } from 'react'

interface PlanLine {
  id: string
  itemName: string
  toName: string | null
  checked: boolean
  reason: string | null
}

interface Plan {
  title: string
  status: string
  rationale: string | null
  lines: PlanLine[]
}

/**
 * The packing list the assistant just wrote, beside the conversation that
 * produced it.
 *
 * Read-only on purpose: this is for reading the plan while you argue with it.
 * Ticking things off belongs on the packing page, where the checkoff writes a
 * real move.
 */
export function PlanPane({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPlan(null)
    setError(null)

    fetch(`/api/packing/${planId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the plan.')
        return (await response.json()) as Plan
      })
      .then((data) => {
        if (!cancelled) setPlan(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the plan — open it in full instead.')
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  if (error) {
    return (
      <p className="card px-4 py-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {error}
      </p>
    )
  }

  if (!plan) {
    return (
      <div className="card animate-pulse-soft px-4 py-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Loading the plan…
      </div>
    )
  }

  // One group per destination — a packing list is read one suitcase at a time.
  const groups = new Map<string, PlanLine[]>()
  for (const line of plan.lines) {
    const key = line.toName ?? 'Somewhere'
    groups.set(key, [...(groups.get(key) ?? []), line])
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="font-display text-base">{plan.title}</div>
        {plan.rationale && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            {plan.rationale}
          </p>
        )}
        <div className="tabular mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {plan.lines.length} {plan.lines.length === 1 ? 'item' : 'items'} · {plan.status}
        </div>
      </div>

      {[...groups.entries()].map(([destination, lines]) => (
        <section key={destination}>
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>
            → {destination}
            <span className="tabular ml-1.5">{lines.length}</span>
          </h3>
          <ul className="card divide-y text-sm">
            {lines.map((line) => (
              <li key={line.id} className="px-3 py-2">
                <span
                  style={{
                    textDecoration: line.checked ? 'line-through' : undefined,
                    color: line.checked ? 'var(--ink-faint)' : undefined,
                  }}
                >
                  {line.itemName}
                </span>
                {line.reason && (
                  <span className="block text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {line.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
