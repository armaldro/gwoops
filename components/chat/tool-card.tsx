'use client'

import Link from 'next/link'

/**
 * A tool call, rendered as a line of plain English rather than a JSON blob.
 * The point is legibility: the reader should be able to tell what the
 * assistant actually looked at, and challenge it if the scope was wrong.
 */
const LABELS: Record<string, string> = {
  search_inventory: 'Searched the inventory',
  get_inventory_summary: 'Counted everything by home',
  get_locations: 'Checked your homes',
  get_item: 'Looked up an item',
  propose_distribution: 'Worked out a balanced split',
  find_gaps: 'Compared homes for gaps',
  find_duplicates: 'Looked for over-provisioning',
  create_packing_list: 'Saved a draft packing list',
}

const ICONS: Record<string, string> = {
  search_inventory: '🔍',
  get_inventory_summary: '📊',
  get_locations: '🏠',
  get_item: '📦',
  propose_distribution: '⚖️',
  find_gaps: '🕳️',
  find_duplicates: '👯',
  create_packing_list: '🧳',
}

export function ToolCard({ name, input }: { name: string; input: unknown }) {
  const detail = describeInput(name, input)

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
    >
      <span aria-hidden>{ICONS[name] ?? '🔧'}</span>
      <span>{LABELS[name] ?? name}</span>
      {detail && <span style={{ color: 'var(--ink-faint)' }}>· {detail}</span>}
      {name === 'create_packing_list' && (
        <Link
          href="/packing"
          className="ml-auto underline underline-offset-4"
          style={{ color: 'var(--accent)' }}
        >
          Open
        </Link>
      )}
    </div>
  )
}

function describeInput(name: string, input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const args = input as Record<string, unknown>

  switch (name) {
    case 'search_inventory': {
      const parts = [args.query, args.category_slug, args.location_name]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
      return parts.join(' · ') || null
    }
    case 'propose_distribution': {
      const scope = typeof args.category_slug === 'string' ? args.category_slug : 'everything'
      const homes = Array.isArray(args.home_names) ? args.home_names.join(' / ') : 'all homes'
      return `${scope} across ${homes}`
    }
    case 'find_gaps':
      return typeof args.home_name === 'string' ? args.home_name : null
    case 'find_duplicates':
      return typeof args.category_slug === 'string' ? args.category_slug : null
    case 'create_packing_list': {
      const moves = Array.isArray(args.moves) ? args.moves.length : 0
      return moves ? `${moves} ${moves === 1 ? 'item' : 'items'}` : null
    }
    default:
      return null
  }
}
