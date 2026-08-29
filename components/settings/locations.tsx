'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { LocationRow } from '@/lib/supabase/types'
import { deleteLocation, upsertLocation } from '@/lib/actions/settings'
import { Button } from '@/components/ui/primitives'
import { locationColorVar } from '@/lib/colors'

export function LocationSettings({
  locations,
  canWrite,
}: {
  locations: LocationRow[]
  canWrite: boolean
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg">Homes</h2>
        {canWrite && editing !== 'new' && (
          <Button variant="ghost" onClick={() => setEditing('new')}>
            + Add a home
          </Button>
        )}
      </div>

      <p className="mb-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
        Set each home&rsquo;s coordinates and a photo taken there files itself
        automatically. The radius is how close you have to be for that to count.
      </p>

      <div className="space-y-3">
        {editing === 'new' && (
          <LocationForm onDone={() => setEditing(null)} />
        )}

        {locations.map((location) =>
          editing === location.id ? (
            <LocationForm
              key={location.id}
              location={location}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div key={location.id} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div
                  className="font-display text-base"
                  style={{ color: locationColorVar(location.color) }}
                >
                  <span aria-hidden className="mr-1.5">{location.emoji}</span>
                  {location.name}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {location.address || 'No address'}
                  {' · '}
                  {location.lat != null && location.lng != null ? (
                    <span className="tabular">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)} · {location.radius_m}m
                    </span>
                  ) : (
                    <span style={{ color: 'var(--warning)' }}>
                      no coordinates — photos won&rsquo;t auto-file here
                    </span>
                  )}
                </div>
                {location.notes && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {location.notes}
                  </p>
                )}
              </div>
              {canWrite && (
                <Button variant="ghost" onClick={() => setEditing(location.id)}>
                  Edit
                </Button>
              )}
            </div>
          ),
        )}
      </div>
    </section>
  )
}

function LocationForm({
  location,
  onDone,
}: {
  location?: LocationRow
  onDone: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(location?.name ?? '')
  const [emoji, setEmoji] = useState(location?.emoji ?? '🏠')
  const [address, setAddress] = useState(location?.address ?? '')
  const [notes, setNotes] = useState(location?.notes ?? '')
  const [lat, setLat] = useState(location?.lat != null ? String(location.lat) : '')
  const [lng, setLng] = useState(location?.lng != null ? String(location.lng) : '')
  const [radius, setRadius] = useState(String(location?.radius_m ?? 150))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  function useCurrentPosition() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot report a location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(String(position.coords.latitude))
        setLng(String(position.coords.longitude))
        setLocating(false)
      },
      () => {
        setError('Could not read your location. Enter the coordinates by hand.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await upsertLocation({
            id: location?.id,
            name,
            emoji,
            address: address.trim() || null,
            notes: notes.trim() || null,
            lat: lat ? Number(lat) : null,
            lng: lng ? Number(lng) : null,
            radiusM: Number(radius) || 150,
          })
          if (result.ok) {
            onDone()
            router.refresh()
          } else {
            setError(result.error ?? 'Could not save.')
          }
        })
      }}
    >
      <div className="flex gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="field w-16 text-center text-lg"
          aria-label="Emoji"
          maxLength={4}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Home name"
          className="field"
          aria-label="Home name"
          autoFocus
        />
      </div>

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional)"
        className="field"
        aria-label="Address"
      />

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes the assistant should know — climate, who uses it, storage limits"
        className="field"
        aria-label="Notes"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <label className="text-xs font-medium" htmlFor={`lat-${location?.id ?? 'new'}`}>
            Latitude
          </label>
          <input
            id={`lat-${location?.id ?? 'new'}`}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="field tabular mt-1"
            inputMode="decimal"
          />
        </div>
        <div className="w-32">
          <label className="text-xs font-medium" htmlFor={`lng-${location?.id ?? 'new'}`}>
            Longitude
          </label>
          <input
            id={`lng-${location?.id ?? 'new'}`}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="field tabular mt-1"
            inputMode="decimal"
          />
        </div>
        <div className="w-28">
          <label className="text-xs font-medium" htmlFor={`radius-${location?.id ?? 'new'}`}>
            Radius (m)
          </label>
          <input
            id={`radius-${location?.id ?? 'new'}`}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="field tabular mt-1"
            inputMode="numeric"
          />
        </div>
        <Button type="button" variant="secondary" onClick={useCurrentPosition} disabled={locating}>
          {locating ? 'Locating…' : '📍 Use where I am'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save home'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {location && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteLocation(location.id)
                if (result.ok) {
                  onDone()
                  router.refresh()
                } else {
                  setError(result.error ?? 'Could not delete.')
                }
              })
            }
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  )
}
