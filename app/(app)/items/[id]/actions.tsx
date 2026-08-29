'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  deleteItem,
  moveItem,
  setItemPinned,
  setItemStatus,
} from '@/lib/actions/items'
import type { ItemStatus, LocationRow } from '@/lib/supabase/types'
import { Button } from '@/components/ui/primitives'
import { locationColorVar } from '@/lib/colors'

export function ItemActions({
  itemId,
  currentLocationId,
  currentStatus,
  isPinned,
  locations,
}: {
  itemId: string
  currentLocationId: string | null
  currentStatus: ItemStatus
  isPinned: boolean
  locations: LocationRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await work()
      if (!result.ok) setError(result.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>
          Move to
        </div>
        <div className="flex flex-wrap gap-2">
          {locations.map((location) => {
            const here = location.id === currentLocationId
            const tone = locationColorVar(location.color)
            return (
              <button
                key={location.id}
                type="button"
                disabled={pending || here}
                onClick={() => run(() => moveItem(itemId, location.id, 'Moved by hand'))}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-100"
                style={{
                  borderColor: here ? tone : 'var(--border)',
                  background: here ? 'var(--accent-soft)' : 'var(--surface)',
                  color: here ? tone : 'var(--ink-muted)',
                  cursor: here ? 'default' : 'pointer',
                }}
              >
                <span aria-hidden>{location.emoji}</span> {location.name}
                {here && ' · here'}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => setItemPinned(itemId, !isPinned))}
          title="Pinned items are left alone when the assistant rebalances homes"
        >
          {isPinned ? '📌 Unpin' : '📌 Pin here'}
        </Button>

        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() =>
              setItemStatus(itemId, currentStatus === 'archived' ? 'active' : 'archived'),
            )
          }
        >
          {currentStatus === 'archived' ? '♻️ Restore' : '📦 Archive'}
        </Button>

        {confirmingDelete ? (
          <>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteItem(itemId)
                  if (result.ok) router.push('/inventory')
                  else setError(result.error ?? 'Could not delete.')
                })
              }
            >
              Really delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      {isPinned && (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          Pinned — the assistant will leave this where it is when balancing homes.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
