'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { LocationRow, PackingStatus } from '@/lib/supabase/types'
import {
  activatePackingList,
  cancelPackingList,
  checkPackingItem,
  deletePackingList,
} from '@/lib/actions/packing'
import { Button } from '@/components/ui/primitives'
import { locationColorVar } from '@/lib/colors'

export interface PackingLine {
  id: string
  checked: boolean
  reason: string | null
  toLocationId: string | null
  itemId: string | null
  itemName: string
  currentLocationId: string | null
}

export function PackingChecklist({
  listId,
  status,
  lines,
  locations,
  canWrite,
  selectedItemId = null,
}: {
  listId: string
  status: PackingStatus
  lines: PackingLine[]
  locations: LocationRow[]
  canWrite: boolean
  selectedItemId?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(locations.map((l) => [l.id, l]))

  // Group by destination: a packing list is read one suitcase at a time.
  const groups = new Map<string, PackingLine[]>()
  for (const line of lines) {
    const key = line.toLocationId ?? 'unknown'
    groups.set(key, [...(groups.get(key) ?? []), line])
  }

  const done = lines.filter((l) => l.checked).length

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await work()
      if (!result.ok) setError(result.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="tabular text-sm">
          {done} of {lines.length} packed
        </div>
        <div
          className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--surface-sunk)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${lines.length ? (done / lines.length) * 100 : 0}%`,
              background: 'var(--positive)',
            }}
          />
        </div>

        {canWrite && status === 'draft' && (
          <Button onClick={() => run(() => activatePackingList(listId))} disabled={pending}>
            Start packing
          </Button>
        )}
        {canWrite && status === 'active' && (
          <Button
            variant="secondary"
            onClick={() => run(() => cancelPackingList(listId))}
            disabled={pending}
          >
            Cancel trip
          </Button>
        )}
        {canWrite && (status === 'done' || status === 'cancelled') && (
          <Button
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await deletePackingList(listId)
                if (result.ok) router.push('/packing')
                else setError(result.error ?? 'Could not delete.')
              })
            }
            disabled={pending}
          >
            Delete
          </Button>
        )}
      </div>

      {status === 'draft' && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          This is a draft. Nothing has moved yet — start packing when you are ready,
          and tick items off as they go in the bag. Each tick updates where that item lives.
        </p>
      )}

      {[...groups.entries()].map(([locationId, group]) => {
        const location = byId.get(locationId)
        const tone = locationColorVar(location?.color)
        return (
          <section key={locationId}>
            <h2 className="mb-2 font-display text-base" style={{ color: tone }}>
              <span aria-hidden className="mr-1">
                {location?.emoji ?? '📦'}
              </span>
              Going to {location?.name ?? 'somewhere'}
              <span className="tabular ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                {group.length}
              </span>
            </h2>

            <ul className="card divide-y">
              {group.map((line) => (
                <li key={line.id} className="flex min-h-14 items-start gap-3 px-4 py-3">
                  <input
                    id={`pack-${line.id}`}
                    type="checkbox"
                    checked={line.checked}
                    disabled={!canWrite || pending || status === 'draft'}
                    onChange={(e) => run(() => checkPackingItem(line.id, e.target.checked))}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-current"
                    style={{ color: tone }}
                  />
                  <label htmlFor={`pack-${line.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span
                      className="text-sm"
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
                  </label>
                  {line.itemId && (
                    <Link
                      href={`/packing/${listId}?item=${line.itemId}`}
                      aria-current={line.itemId === selectedItemId ? 'true' : undefined}
                      className="touch-target shrink-0 px-1 text-xs underline underline-offset-4"
                      style={{
                        color:
                          line.itemId === selectedItemId
                            ? 'var(--accent)'
                            : 'var(--ink-muted)',
                      }}
                    >
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
