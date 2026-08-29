'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BundleKind, LocationRow } from '@/lib/supabase/types'
import { createBundle } from '@/lib/actions/bundles'
import { Button } from '@/components/ui/primitives'

export function NewBundleForm({ locations }: { locations: LocationRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BundleKind>('kit')
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + New bundle
      </Button>
    )
  }

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await createBundle({
            name,
            kind,
            emoji: '',
            locationId: locationId || null,
          })
          if (result.ok && result.bundleId) router.push(`/bundles/${result.bundleId}`)
          else setError(result.error ?? 'Could not create.')
        })
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Camera bag, Bali dinner outfit, Winter bin…"
          className="field flex-1"
          aria-label="Bundle name"
          required
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as BundleKind)}
          className="field w-auto"
          aria-label="Kind"
        >
          <option value="kit">Kit</option>
          <option value="outfit">Outfit</option>
          <option value="bin">Storage bin</option>
        </select>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="field w-auto"
          aria-label="Home"
        >
          <option value="">No home</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.emoji} {l.name}
            </option>
          ))}
        </select>
      </div>

      {kind === 'bin' && (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          Bins get a printable QR label — scan it to see what&rsquo;s inside without opening it.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? 'Creating…' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
