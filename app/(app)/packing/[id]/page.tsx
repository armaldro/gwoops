import { notFound } from 'next/navigation'
import { requireSession, getLocations } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/primitives'
import { PackingChecklist } from '@/components/packing/checklist'

export const dynamic = 'force-dynamic'

export default async function PackingListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={list.title}
        subtitle={list.rationale ?? undefined}
      />
      <PackingChecklist
        listId={list.id}
        status={list.status}
        lines={lines}
        locations={locations}
        canWrite={session.canWrite}
      />
    </div>
  )
}
