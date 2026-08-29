import Link from 'next/link'
import { fetchItem } from '@/lib/queries'
import { getLocations } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { signPhotoUrls } from '@/lib/photos'
import { getCategory } from '@/lib/categories/schemas'
import { locationColorVar } from '@/lib/colors'
import { LocationChip } from '@/components/ui/primitives'
import { ItemActions } from '@/components/items/item-actions'

/**
 * The item, rendered identically whether it is a page of its own or the right
 * pane of a two-pane layout. One component, so the two can never drift.
 *
 * `compact` tightens it for the pane, where it sits beside a grid rather than
 * having the full width to itself.
 */
export async function ItemDetail({
  itemId,
  canWrite,
  compact = false,
}: {
  itemId: string
  canWrite: boolean
  compact?: boolean
}) {
  const item = await fetchItem(itemId)
  if (!item) {
    return (
      <div className="card px-4 py-10 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        That item no longer exists.
      </div>
    )
  }

  const supabase = await createClient()
  const [photoUrls, locations, { data: movements }, { data: bundleLinks }] =
    await Promise.all([
      signPhotoUrls(item.photoPaths),
      getLocations(),
      supabase
        .from('item_movements')
        .select('*, from:from_location_id ( name, emoji ), to:to_location_id ( name, emoji )')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bundle_items')
        .select('bundles ( id, name, emoji, kind )')
        .eq('item_id', itemId),
    ])

  const category = getCategory(item.categorySlug)
  const filled = category.fields.filter(
    (field) => item.attributes[field.key] !== undefined,
  )
  const tone = locationColorVar(item.locationColor)

  return (
    <div
      className={
        compact
          ? 'space-y-5'
          : 'grid gap-6 fold:grid-cols-[minmax(0,20rem)_1fr] fold:gap-8 lg:grid-cols-[minmax(0,420px)_1fr]'
      }
    >
      <div className="space-y-3">
        <div
          className="overflow-hidden rounded-xl border"
          style={{ background: 'var(--surface-sunk)' }}
        >
          {item.photoPaths[0] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrls.get(item.photoPaths[0]) ?? ''}
              alt={item.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div aria-hidden className="grid aspect-square place-items-center text-5xl opacity-40">
              {item.categoryIcon}
            </div>
          )}
        </div>

        {item.photoPaths.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {item.photoPaths.slice(1).map((path) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={path}
                src={photoUrls.get(path) ?? ''}
                alt=""
                className="aspect-square w-full rounded-lg border object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        <header>
          <div
            className="flex flex-wrap items-center gap-2 text-xs"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Link href={`/inventory?category=${item.categorySlug}`}>
              <span aria-hidden>{item.categoryIcon}</span> {item.categoryLabel}
            </Link>
            {item.locationName && (
              <LocationChip
                name={item.locationName}
                emoji={item.locationEmoji ?? undefined}
                color={item.locationColor}
                href={`/locations/${item.location_id}`}
                size="sm"
              />
            )}
            {item.status !== 'active' && (
              <span style={{ color: 'var(--warning)' }}>
                {item.status === 'in_transit' ? 'In transit' : 'Archived'}
              </span>
            )}
          </div>

          <h1 className={`mt-2 font-display ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
            {item.name}
          </h1>

          {item.quantity > 1 && (
            <p className="tabular mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {item.quantity} of these
            </p>
          )}
          {item.ai_confidence !== null && item.ai_confidence < 0.6 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--warning)' }}>
              Recognised with low confidence — worth a quick check.
            </p>
          )}
        </header>

        {canWrite && (
          <ItemActions
            itemId={item.id}
            currentLocationId={item.location_id}
            currentStatus={item.status}
            isPinned={item.is_pinned}
            locations={locations}
          />
        )}

        {filled.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-base">Details</h2>
            <dl className="card divide-y text-sm">
              {filled.map((field) => (
                <div key={field.key} className="flex gap-4 px-4 py-2.5">
                  <dt className="w-32 shrink-0" style={{ color: 'var(--ink-muted)' }}>
                    {field.label}
                  </dt>
                  <dd className="min-w-0 flex-1">{formatValue(item.attributes[field.key])}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {(item.purchase_price || item.est_value || item.warranty_ends_at) && (
          <section>
            <h2 className="mb-2 font-display text-base">Value &amp; cover</h2>
            <dl className="card divide-y text-sm">
              {item.purchase_price != null && (
                <Row label="Paid">
                  {item.currency} {Number(item.purchase_price).toFixed(2)}
                </Row>
              )}
              {item.est_value != null && (
                <Row label="Worth now">
                  {item.currency} {Number(item.est_value).toFixed(2)}
                </Row>
              )}
              {item.warranty_ends_at && (
                <Row label="Warranty until">{formatDate(item.warranty_ends_at)}</Row>
              )}
              {item.purchase_date && <Row label="Bought">{formatDate(item.purchase_date)}</Row>}
            </dl>
          </section>
        )}

        {bundleLinks && bundleLinks.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-base">Part of</h2>
            <div className="flex flex-wrap gap-2">
              {bundleLinks.map((link) => {
                const bundle = (
                  link as unknown as {
                    bundles: { id: string; name: string; emoji: string } | null
                  }
                ).bundles
                if (!bundle) return null
                return (
                  <Link
                    key={bundle.id}
                    href={`/bundles/${bundle.id}`}
                    className="card touch-target px-3 text-xs"
                  >
                    <span aria-hidden>{bundle.emoji}</span> {bundle.name}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {item.notes && (
          <section>
            <h2 className="mb-2 font-display text-base">Notes</h2>
            <p className="card whitespace-pre-wrap px-4 py-3 text-sm">{item.notes}</p>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-display text-base">History</h2>
          <ol className="card divide-y text-sm">
            {(movements ?? []).map((row) => {
              const movement = row as unknown as {
                id: string
                created_at: string
                reason: string | null
                from: { name: string; emoji: string } | null
                to: { name: string; emoji: string } | null
              }
              return (
                <li key={movement.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={{ color: 'var(--ink-muted)' }}>
                      {movement.from
                        ? `${movement.from.emoji} ${movement.from.name}`
                        : 'Nowhere'}
                    </span>
                    <span aria-hidden style={{ color: tone }}>
                      →
                    </span>
                    <span>
                      {movement.to ? `${movement.to.emoji} ${movement.to.name}` : 'Nowhere'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {formatDate(movement.created_at)}
                    {movement.reason ? ` · ${movement.reason}` : ''}
                  </div>
                </li>
              )
            })}
            <li className="px-4 py-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
              Added {formatDate(item.created_at)}
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-32 shrink-0" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </dt>
      <dd className="tabular min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function formatValue(value: string | number | string[] | undefined): string {
  if (value === undefined) return '—'
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
