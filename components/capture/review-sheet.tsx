'use client'

import { useEffect, useState, useTransition } from 'react'
import type { LocationRow, ItemCondition } from '@/lib/supabase/types'
import {
  CATEGORIES,
  CONDITION_VALUES,
  getCategory,
  type AttributeValue,
} from '@/lib/categories/schemas'
import { mergeIntoItem, saveItem } from '@/lib/actions/capture'
import { Button, Skeleton } from '@/components/ui/primitives'
import type { DuplicateHint } from '@/components/capture/capture-studio'

export interface Draft {
  name: string
  categorySlug: string
  attributes: Record<string, AttributeValue>
  condition: ItemCondition
  estValue: number | null
  quantity: number
  confidence: number
  alternatives: { name: string; category_slug: string }[]
  isPrivate: boolean
}

/**
 * Everything the model produced, laid out to be corrected in seconds.
 *
 * Nothing is read-only: a wrong guess should cost one tap, not a re-shoot. The
 * confidence figure is shown rather than hidden, because a hedged answer the
 * user cannot see is worse than no answer.
 */
export function ReviewSheet({
  position,
  total,
  previewUrl,
  imageBase64,
  takenAt,
  exif,
  draft,
  duplicates,
  loading,
  error,
  locations,
  locationId,
  onLocationChange,
  onSaved,
  onSkip,
}: {
  position: number
  total: number
  previewUrl: string
  imageBase64: string
  takenAt: string | null
  exif: { lat: number | null; lng: number | null }
  draft: Draft | null
  duplicates: DuplicateHint[]
  loading: boolean
  error: string | null
  locations: LocationRow[]
  locationId: string | null
  onLocationChange: (id: string | null) => void
  onSaved: () => void
  onSkip: () => void
}) {
  const [name, setName] = useState('')
  const [categorySlug, setCategorySlug] = useState('other')
  const [attributes, setAttributes] = useState<Record<string, AttributeValue>>({})
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState<ItemCondition | ''>('')
  const [estValue, setEstValue] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)

  // Adopt the model's draft the moment it lands, without clobbering edits the
  // user made while waiting.
  const [adopted, setAdopted] = useState(false)
  useEffect(() => {
    if (!draft || adopted) return
    setName(draft.name)
    setCategorySlug(draft.categorySlug)
    setAttributes(draft.attributes)
    setQuantity(draft.quantity)
    setCondition(draft.condition)
    setEstValue(draft.estValue != null ? String(draft.estValue) : '')
    setAdopted(true)
  }, [draft, adopted])

  const category = getCategory(categorySlug)
  const confidence = draft?.confidence ?? null
  const lowConfidence = confidence !== null && confidence < 0.6

  function handleSave() {
    setSaveError(null)
    if (!name.trim()) {
      setSaveError('Give it a name first.')
      return
    }
    if (!locationId) {
      setSaveError('Choose which home it lives in.')
      return
    }

    startTransition(async () => {
      const result = await saveItem({
        name,
        categorySlug,
        locationId,
        attributes,
        quantity,
        condition: condition || null,
        estValue: estValue ? Number(estValue) : null,
        notes: notes.trim() || null,
        confidence: draft?.confidence ?? null,
        isPrivate: draft?.isPrivate ?? category.isPrivate ?? false,
        imageBase64,
        takenAt,
        exifLat: exif.lat,
        exifLng: exif.lng,
      })
      if (result.ok) onSaved()
      else setSaveError(result.error)
    })
  }

  return (
    <div className="card animate-sheet-in overflow-hidden">
      {total > 1 && (
        <div
          className="flex items-center justify-between border-b px-4 py-2 text-xs"
          style={{ color: 'var(--ink-muted)' }}
        >
          <span className="tabular">
            Photo {position} of {total}
          </span>
          <button type="button" onClick={onSkip} className="underline underline-offset-4">
            Skip this one
          </button>
        </div>
      )}

      <div className="grid gap-5 p-4 sm:grid-cols-[200px_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="The item you just photographed"
            className="aspect-square w-full rounded-lg border object-cover"
          />
          {confidence !== null && (
            <div
              className="mt-2 text-xs"
              style={{ color: lowConfidence ? 'var(--warning)' : 'var(--ink-faint)' }}
            >
              {lowConfidence ? 'Unsure — worth a check' : 'Recognised'} ·{' '}
              <span className="tabular">{Math.round(confidence * 100)}%</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {loading && (
            <div className="space-y-3" aria-live="polite">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-9 w-1/2" />
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Looking at your photo…
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--accent-soft)', color: 'var(--danger)' }}
            >
              {error} Fill it in yourself below.
            </div>
          )}

          {!loading && (
            <>
              {duplicates.length > 0 && !dismissedDuplicates && (
                <div
                  className="rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--warning)' }}
                >
                  <div className="font-medium" style={{ color: 'var(--warning)' }}>
                    You may already have this
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {duplicates.map((duplicate) => (
                      <li key={duplicate.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {duplicate.name}
                          <span className="ml-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
                            {duplicate.reasons.slice(0, 2).join(' · ')}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await mergeIntoItem(duplicate.id, quantity)
                              if (result.ok) onSaved()
                              else setSaveError(result.error)
                            })
                          }
                          className="shrink-0 rounded-full border px-2 py-0.5 text-xs"
                        >
                          Same one
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setDismissedDuplicates(true)}
                    className="mt-2 text-xs underline underline-offset-4"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    No, this is a different one
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="item-name" className="text-xs font-medium">
                  Name
                </label>
                <input
                  id="item-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field mt-1 font-display text-base"
                  placeholder="What is it?"
                />
                {draft?.alternatives?.length ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span style={{ color: 'var(--ink-faint)' }}>Or:</span>
                    {draft.alternatives.map((alternative) => (
                      <button
                        key={alternative.name}
                        type="button"
                        onClick={() => {
                          setName(alternative.name)
                          setCategorySlug(alternative.category_slug)
                        }}
                        className="rounded-full border px-2 py-0.5"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        {alternative.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="item-category" className="text-xs font-medium">
                    Category
                  </label>
                  <select
                    id="item-category"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className="field mt-1"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="item-quantity" className="text-xs font-medium">
                    How many
                  </label>
                  <input
                    id="item-quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="field tabular mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="item-location" className="text-xs font-medium">
                    Home
                  </label>
                  <select
                    id="item-location"
                    value={locationId ?? ''}
                    onChange={(e) => onLocationChange(e.target.value || null)}
                    className="field mt-1"
                  >
                    <option value="">Choose…</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.emoji} {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Details</legend>
                {category.fields.map((field) => (
                  <AttributeInput
                    key={field.key}
                    field={field}
                    value={attributes[field.key]}
                    onChange={(value) =>
                      setAttributes((current) => {
                        const next = { ...current }
                        if (value === undefined || value === '') delete next[field.key]
                        else next[field.key] = value
                        return next
                      })
                    }
                  />
                ))}
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="item-condition" className="text-xs font-medium">
                    Condition
                  </label>
                  <select
                    id="item-condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ItemCondition | '')}
                    className="field mt-1"
                  >
                    <option value="">Not set</option>
                    {CONDITION_VALUES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-value" className="text-xs font-medium">
                    Worth roughly
                  </label>
                  <input
                    id="item-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={estValue}
                    onChange={(e) => setEstValue(e.target.value)}
                    className="field tabular mt-1"
                    placeholder="—"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="item-notes" className="text-xs font-medium">
                  Notes
                </label>
                <textarea
                  id="item-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="field mt-1"
                  placeholder="Anything the photo doesn't say"
                />
              </div>

              {saveError && (
                <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
                  {saveError}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={pending}>
                  {pending ? 'Saving…' : total > 1 ? 'Save & next' : 'Save item'}
                </Button>
                <Button variant="ghost" onClick={onSkip} disabled={pending}>
                  Discard
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: (typeof CATEGORIES)[number]['fields'][number]
  value: AttributeValue | undefined
  onChange: (value: AttributeValue | undefined) => void
}) {
  const id = `attr-${field.key}`

  if (field.type === 'select' && field.options?.length) {
    return (
      <div>
        <label htmlFor={id} className="text-xs font-medium">
          {field.label}
        </label>
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="field mt-1"
        >
          <option value="">—</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {/* Keep a value the model produced that is not in our list, rather
              than silently blanking the field. */}
          {typeof value === 'string' && value && !field.options.includes(value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      </div>
    )
  }

  if (field.type === 'multiselect') {
    const list = Array.isArray(value) ? value : value ? [String(value)] : []
    return (
      <div>
        <label htmlFor={id} className="text-xs font-medium">
          {field.label}
        </label>
        <input
          id={id}
          value={list.join(', ')}
          onChange={(e) => {
            const parts = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            onChange(parts.length ? parts : undefined)
          }}
          className="field mt-1"
          placeholder={field.options?.slice(0, 3).join(', ') ?? 'Comma separated'}
        />
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium">
        {field.label}
      </label>
      <input
        id={id}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          if (!raw) return onChange(undefined)
          onChange(field.type === 'number' ? Number(raw) : raw)
        }}
        className={`field mt-1 ${field.type === 'number' ? 'tabular' : ''}`}
        placeholder={field.hint ?? '—'}
      />
    </div>
  )
}
