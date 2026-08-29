'use client'

import { useState, useTransition } from 'react'
import type { LocationRow } from '@/lib/supabase/types'
import type { LocationSuggestion } from '@/lib/geo'
import { formatDistance } from '@/lib/geo'
import { locationColorVar } from '@/lib/colors'
import { createLocationHere } from '@/lib/actions/capture'
import { Button } from '@/components/ui/primitives'

/**
 * Where is this thing?
 *
 * A GPS match is shown as something to confirm, never applied silently — an
 * item filed to the wrong house is far more annoying than one extra tap. When
 * we genuinely do not know (a gallery photo with no EXIF), the picker is open
 * and nothing is preselected.
 */
export function LocationPicker({
  locations,
  value,
  suggestion,
  confirmed,
  deviceFix,
  onChange,
  onConfirm,
}: {
  locations: LocationRow[]
  value: string | null
  suggestion: LocationSuggestion | null
  confirmed: boolean
  /** The GPS fix behind `suggestion`, so "+ New home" can be geocoded here. */
  deviceFix: { lat: number; lng: number } | null
  onChange: (id: string | null) => void
  onConfirm: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [pending, startTransition] = useTransition()

  const selected = locations.find((l) => l.id === value) ?? null
  const showPicker = expanded || !selected || !confirmed

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--ink-faint)' }}
          >
            Where is it
          </div>

          {selected ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="font-display text-lg"
                style={{ color: locationColorVar(selected.color) }}
              >
                <span aria-hidden className="mr-1">
                  {selected.emoji}
                </span>
                {selected.name}
              </span>
              {suggestion?.kind === 'confident' && !confirmed && (
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  from your location
                </span>
              )}
              {suggestion?.kind === 'nearby' && (
                <span className="text-xs" style={{ color: 'var(--warning)' }}>
                  {formatDistance(suggestion.match.distanceMeters)} away — is that right?
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {suggestion?.kind === 'unknown' && suggestion.nearest
                ? `Nowhere near ${suggestion.nearest.location.name}. Pick a home.`
                : 'Pick a home before saving.'}
            </div>
          )}
        </div>

        {selected && confirmed && !expanded && (
          <Button variant="ghost" onClick={() => setExpanded(true)}>
            Change
          </Button>
        )}
        {selected && !confirmed && (
          <Button
            onClick={() => {
              onConfirm()
              setExpanded(false)
            }}
          >
            Yes, that&rsquo;s right
          </Button>
        )}
      </div>

      {showPicker && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {locations.map((location) => {
            const active = location.id === value
            const tone = locationColorVar(location.color)
            return (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  onChange(location.id)
                  setExpanded(false)
                }}
                aria-pressed={active}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                style={{
                  borderColor: active ? tone : 'var(--border)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? tone : 'var(--ink-muted)',
                }}
              >
                <span aria-hidden>{location.emoji}</span> {location.name}
              </button>
            )
          })}

          {adding ? (
            <form
              className="flex w-full gap-2 pt-1"
              onSubmit={(event) => {
                event.preventDefault()
                startTransition(async () => {
                  // Geocode the new home to wherever we are now, so the next
                  // photo taken here matches it without any setup.
                  const result = await createLocationHere({
                    name: newName,
                    emoji: '🏠',
                    lat: deviceFix?.lat ?? null,
                    lng: deviceFix?.lng ?? null,
                  })
                  if (result.ok && result.locationId) {
                    onChange(result.locationId)
                    setAdding(false)
                    setNewName('')
                  }
                })
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name this home"
                className="field"
              />
              <Button type="submit" disabled={pending || !newName.trim()}>
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed px-3 py-1.5 text-xs"
              style={{ color: 'var(--ink-muted)' }}
            >
              + New home{deviceFix ? ' here' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
