import { notFound } from 'next/navigation'
import { getLocations, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { fetchItems } from '@/lib/queries'
import { PageHeader } from '@/components/ui/primitives'
import { BundleEditor } from '@/components/bundles/bundle-editor'

export const dynamic = 'force-dynamic'

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()
  const supabase = await createClient()

  const { data: bundle } = await supabase
    .from('bundles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!bundle) notFound()

  const [{ data: links }, { items }, locations] = await Promise.all([
    supabase.from('bundle_items').select('item_id').eq('bundle_id', id),
    fetchItems({ limit: 400, status: 'active' }),
    getLocations(),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${bundle.emoji} ${bundle.name}`}
        subtitle={
          bundle.qr_slug
            ? `Storage bin · label code ${bundle.qr_slug}`
            : 'Everything here moves as one unit.'
        }
      />
      <BundleEditor
        bundleId={bundle.id}
        locationId={bundle.location_id}
        qrSlug={bundle.qr_slug}
        allItems={items.map((i) => ({
          id: i.id,
          name: i.name,
          categoryIcon: i.categoryIcon,
          locationName: i.locationName,
        }))}
        selectedIds={(links ?? []).map((l) => l.item_id)}
        locations={locations}
        canWrite={session.canWrite}
      />
    </div>
  )
}
