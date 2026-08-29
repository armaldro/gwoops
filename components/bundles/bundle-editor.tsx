'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { LocationRow } from '@/lib/supabase/types'
import { deleteBundle, moveBundle, setBundleItems } from '@/lib/actions/bundles'
import { Button } from '@/components/ui/primitives'
import { locationColorVar } from '@/lib/colors'

interface PickableItem {
  id: string
  name: string
  categoryIcon: string
  locationName: string | null
}

export function BundleEditor({
  bundleId,
  locationId,
  qrSlug,
  allItems,
  selectedIds,
  locations,
  canWrite,
}: {
  bundleId: string
  locationId: string | null
  qrSlug: string | null
  allItems: PickableItem[]
  selectedIds: string[]
  locations: LocationRow[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(new Set(selectedIds))
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = useMemo(() => {
    if (selected.size !== selectedIds.length) return true
    return selectedIds.some((id) => !selected.has(id))
  }, [selected, selectedIds])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle
      ? allItems.filter((i) => i.name.toLowerCase().includes(needle))
      : allItems
    // Members first so the bundle's contents are always visible at the top.
    return [...matches].sort(
      (a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)),
    )
  }, [allItems, search, selected])

  function toggle(id: string) {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      {canWrite && (
        <div className="card flex flex-wrap items-center gap-2 p-4">
          <span className="text-xs font-medium" style={{ color: 'var(--ink-faint)' }}>
            Move the whole bundle
          </span>
          {locations.map((location) => {
            const here = location.id === locationId
            const tone = locationColorVar(location.color)
            return (
              <button
                key={location.id}
                type="button"
                disabled={pending || here}
                onClick={() =>
                  startTransition(async () => {
                    const result = await moveBundle(bundleId, location.id)
                    if (result.ok) router.refresh()
                    else setError(result.error ?? 'Could not move.')
                  })
                }
                className="rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: here ? tone : 'var(--border)',
                  background: here ? 'var(--accent-soft)' : 'var(--surface)',
                  color: here ? tone : 'var(--ink-muted)',
                }}
              >
                <span aria-hidden>{location.emoji}</span> {location.name}
                {here && ' · here'}
              </button>
            )
          })}

          {qrSlug && (
            <Link
              href="/print/labels"
              className="ml-auto text-xs underline underline-offset-4"
              style={{ color: 'var(--accent)' }}
            >
              🏷️ Print label
            </Link>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find items to add…"
            className="field flex-1"
            aria-label="Search items"
          />
          <span className="tabular text-xs" style={{ color: 'var(--ink-muted)' }}>
            {selected.size} in bundle
          </span>
          {canWrite && (
            <Button
              disabled={pending || !dirty}
              onClick={() =>
                startTransition(async () => {
                  const result = await setBundleItems(bundleId, [...selected])
                  if (result.ok) {
                    setSaved(true)
                    router.refresh()
                  } else setError(result.error ?? 'Could not save.')
                })
              }
            >
              {pending ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save'}
            </Button>
          )}
        </div>

        <ul className="max-h-[26rem] divide-y overflow-y-auto">
          {visible.slice(0, 200).map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={!canWrite}
                  className="h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span aria-hidden className="mr-1.5">{item.categoryIcon}</span>
                  {item.name}
                </span>
                {item.locationName && (
                  <span className="shrink-0 text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {item.locationName}
                  </span>
                )}
              </label>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              Nothing matches “{search}”.
            </li>
          )}
        </ul>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {canWrite && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteBundle(bundleId)
              if (result.ok) router.push('/bundles')
              else setError(result.error ?? 'Could not delete.')
            })
          }
        >
          Delete this bundle
        </Button>
      )}
    </div>
  )
}
