import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession, getLocations } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/primitives'
import { ItemDetail } from '@/components/items/item-detail'
import { PackingChecklist } from '@/components/packing/checklist'

export const dynamic = 'force-dynamic'

export default async function PackingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ item?: string }>
}) {
  const { id } = await params
  const { item: selectedId } = await searchParams
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: list }, locations] = await Promise.all([
    supabase.from('packing_lists').select('*').eq('id', id).maybeSingle(),
    getLocations(),
  ])
  if (!list) notFound()

  const { data: entries } = await supabase
    .from('packing_list_items')
    .select('id, checked, reason, to_location_id, items ( id, name, location_id )')
    .eq('packing_list_id', id)

  const lines = (entries ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      checked: boolean
      reason: string | null
      to_location_id: string | null
      items: { id: string; name: string; location_id: string | null } | null
    }
    return {
      id: r.id,
      checked: r.checked,
      reason: r.reason,
      toLocationId: r.to_location_id,
      itemId: r.items?.id ?? null,
      itemName: r.items?.name ?? 'Removed item',
      currentLocationId: r.items?.location_id ?? null,
    }
  })

  return (
    <div
      className={
        selectedId
          ? 'grid gap-6 fold:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]'
          : 'mx-auto max-w-2xl'
      }
    >
      <div className={selectedId ? 'hidden fold:block' : ''}>
        <PageHeader title={list.title} subtitle={list.rationale ?? undefined} />
        <PackingChecklist
          listId={list.id}
          status={list.status}
          lines={lines}
          locations={locations}
          canWrite={session.canWrite}
          selectedItemId={selectedId ?? null}
        />
      </div>

      {selectedId && (
        <aside className="min-w-0 fold:sticky fold:top-4 fold:max-h-[calc(100dvh-2rem)] fold:overflow-y-auto fold:overscroll-contain">
          <Link
            href={`/packing/${id}`}
            className="touch-target mb-3 text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            <span aria-hidden className="mr-1">←</span>
            <span className="fold:hidden">Back to the list</span>
            <span className="hidden fold:inline">Close</span>
          </Link>
          <ItemDetail itemId={selectedId} canWrite={session.canWrite} compact />
        </aside>
      )}
    </div>
  )
}
