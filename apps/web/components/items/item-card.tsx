import Link from 'next/link'
import type { ItemView } from '@/lib/queries'
import { summaryLine } from '@nest/domain/categories'
import { locationColorVar } from '@nest/domain/colors'

/**
 * The item as its photograph. Chrome recedes; the picture is the identity.
 * Text only appears where the photo cannot answer the question — which home,
 * and the one or two attributes that distinguish near-identical things.
 */
export function ItemCard({
  item,
  href,
  selected = false,
}: {
  item: ItemView
  /** Defaults to the item's own page; the two-pane grid points at ?item= instead. */
  href?: string
  selected?: boolean
}) {
  const summary = summaryLine(item.categorySlug, item.attributes)
  const tone = locationColorVar(item.locationColor)

  return (
    <Link
      href={href ?? `/items/${item.id}`}
      aria-current={selected ? 'true' : undefined}
      className="group block overflow-hidden rounded-xl border transition hover:-translate-y-0.5"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
        // The selected card has to stay findable in the grid while its detail
        // occupies the other pane.
        borderColor: selected ? tone : undefined,
        outline: selected ? `2px solid ${tone}` : undefined,
        outlineOffset: selected ? '-2px' : undefined,
      }}
    >
      <div
        className="relative aspect-square overflow-hidden"
        style={{ background: 'var(--surface-sunk)' }}
      >
        {item.photoUrl ? (
          // Signed Supabase URLs expire, so next/image optimisation would cache
          // a URL that later 403s. A plain img keeps them correct.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden
            className="grid h-full w-full place-items-center text-3xl opacity-40"
          >
            {item.categoryIcon}
          </div>
        )}

        {item.quantity > 1 && (
          <span
            className="tabular absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: 'var(--surface)', color: 'var(--ink-muted)' }}
          >
            ×{item.quantity}
          </span>
        )}

        {item.status === 'in_transit' && (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'var(--warning)', color: 'var(--ground)' }}
          >
            In transit
          </span>
        )}
      </div>

      <div className="p-2.5">
        <div className="truncate text-sm font-medium">{item.name}</div>
        {summary && (
          <div className="truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
            {summary}
          </div>
        )}
        {item.locationName && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px]" style={{ color: tone }}>
            <span aria-hidden>{item.locationEmoji}</span>
            <span className="truncate">{item.locationName}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
