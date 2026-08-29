import { requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import { LabelSheet } from '@/components/bundles/label-sheet'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bin labels' }

/**
 * A printable sheet of QR labels for storage bins.
 *
 * Deliberately outside the app shell: no nav, no chrome, nothing that would
 * waste paper or confuse a print preview.
 */
export default async function LabelsPage() {
  await requireSession()
  const supabase = await createClient()

  const { data: bins } = await supabase
    .from('bundles')
    .select('id, name, emoji, qr_slug, bundle_items ( item_id ), locations ( name, emoji )')
    .eq('kind', 'bin')
    .not('qr_slug', 'is', null)
    .order('name')

  const labels = (bins ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string
      emoji: string
      qr_slug: string
      bundle_items: { item_id: string }[]
      locations: { name: string; emoji: string } | null
    }
    return {
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      slug: r.qr_slug,
      itemCount: r.bundle_items.length,
      locationName: r.locations ? `${r.locations.emoji} ${r.locations.name}` : null,
      url: `${publicEnv.siteUrl()}/bundles/${r.id}`,
    }
  })

  return <LabelSheet labels={labels} />
}
