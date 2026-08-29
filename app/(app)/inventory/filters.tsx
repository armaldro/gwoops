'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CategoryRow, HouseholdMemberRow, LocationRow } from '@/lib/supabase/types'
import { getCategory } from '@/lib/categories/schemas'
import { locationColorVar } from '@/lib/colors'

/**
 * Facets come from the same category definitions the vision extractor uses, so
 * a field can never be extractable but unfilterable.
 */
export function InventoryFilters({
  locations,
  categories,
  members,
}: {
  locations: LocationRow[]
  categories: CategoryRow[]
  members: HouseholdMemberRow[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(params.get('q') ?? '')

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    next.delete('page')
    startTransition(() => router.push(`/inventory?${next.toString()}`))
  }

  const activeCategory = params.get('category')
  const attributeFields = activeCategory
    ? getCategory(activeCategory).fields.filter((f) => f.facet && f.options?.length)
    : []

  const activeCount = [...params.keys()].filter(
    (k) => k !== 'page' && params.get(k),
  ).length

  return (
    <div className="space-y-3" data-pending={pending ? '' : undefined}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: search })
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search names, brands, notes…"
          className="field"
          aria-label="Search inventory"
        />
        <button
          type="submit"
          className="rounded-lg px-3.5 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Search
        </button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <FacetGroup label="Home">
          <Chip
            active={!params.get('location')}
            onClick={() => update({ location: null })}
          >
            Anywhere
          </Chip>
          {locations.map((location) => (
            <Chip
              key={location.id}
              active={params.get('location') === location.id}
              tone={locationColorVar(location.color)}
              onClick={() => update({ location: location.id })}
            >
              <span aria-hidden>{location.emoji}</span> {location.name}
            </Chip>
          ))}
          <Chip
            active={params.get('location') === 'none'}
            onClick={() => update({ location: 'none' })}
          >
            No home set
          </Chip>
        </FacetGroup>

        <FacetGroup label="Category">
          <Chip
            active={!activeCategory}
            onClick={() => update({ category: null, ...clearAttributes(params) })}
          >
            All
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={activeCategory === category.slug}
              onClick={() =>
                update({ category: category.slug, ...clearAttributes(params) })
              }
            >
              <span aria-hidden>{category.icon}</span> {category.label}
            </Chip>
          ))}
        </FacetGroup>

        {members.length > 1 && (
          <FacetGroup label="Whose">
            <Chip active={!params.get('owner')} onClick={() => update({ owner: null })}>
              Everyone
            </Chip>
            {members.map((member) => (
              <Chip
                key={member.id}
                active={params.get('owner') === member.id}
                onClick={() => update({ owner: member.id })}
              >
                <span aria-hidden>{member.avatar_emoji}</span> {member.display_name}
              </Chip>
            ))}
          </FacetGroup>
        )}
      </div>

      {attributeFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attributeFields.map((field) => (
            <select
              key={field.key}
              value={params.get(`attr.${field.key}`) ?? ''}
              onChange={(e) => update({ [`attr.${field.key}`]: e.target.value || null })}
              className="field w-auto text-xs"
              aria-label={field.label}
            >
              <option value="">{field.label}: any</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push('/inventory'))}
          className="text-xs underline underline-offset-4"
          style={{ color: 'var(--ink-muted)' }}
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}

function clearAttributes(params: URLSearchParams): Record<string, null> {
  const cleared: Record<string, null> = {}
  for (const key of params.keys()) if (key.startsWith('attr.')) cleared[key] = null
  return cleared
}

function FacetGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

function Chip({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone?: string
  onClick: () => void
  children: React.ReactNode
}) {
  const color = tone ?? 'var(--accent)'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition"
      style={{
        borderColor: active ? color : 'var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? color : 'var(--ink-muted)',
      }}
    >
      {children}
    </button>
  )
}
