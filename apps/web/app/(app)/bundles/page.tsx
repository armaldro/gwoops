import Link from 'next/link'
import { getLocations, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { Empty, LinkButton, PageHeader } from '@/components/ui/primitives'
import { NewBundleForm } from '@/components/bundles/new-bundle'
import { locationColorVar } from '@nest/domain/colors'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bundles' }

const KIND_LABEL = {
  outfit: 'Outfit',
  kit: 'Kit',
  bin: 'Storage bin',
} as const

export default async function BundlesPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const locations = await getLocations()

  const { data: bundles } = await supabase
    .from('bundles')
    .select('*, bundle_items ( item_id ), locations ( name, emoji, color )')
    .order('created_at', { ascending: false })

  const rows = (bundles ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string
      kind: keyof typeof KIND_LABEL
      emoji: string
      qr_slug: string | null
      bundle_items: { item_id: string }[]
      locations: { name: string; emoji: string; color: string } | null
    }
    return { ...r, count: r.bundle_items.length }
  })

  const hasBins = rows.some((r) => r.kind === 'bin' && r.qr_slug)

  return (
    <>
      <PageHeader
        title="Bundles"
        subtitle="Things that travel together — an outfit, a camera kit, a storage bin."
        action={
          hasBins ? (
            <LinkButton href="/print/labels" variant="secondary">
              🏷️ Print bin labels
            </LinkButton>
          ) : undefined
        }
      />

      {session.canWrite && <NewBundleForm locations={locations} />}

      {rows.length === 0 ? (
        <div className="mt-4">
          <Empty
            icon="🎒"
            title="No bundles yet"
            body="Group things that always move as a unit. The assistant keeps a bundle together when it balances your homes."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 fold:grid-cols-3">
          {rows.map((bundle) => (
            <Link key={bundle.id} href={`/bundles/${bundle.id}`} className="card p-4 transition hover:-translate-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-base">
                  <span aria-hidden className="mr-1.5">{bundle.emoji}</span>
                  {bundle.name}
                </span>
                <span className="tabular text-sm" style={{ color: 'var(--ink-muted)' }}>
                  {bundle.count}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                <span>{KIND_LABEL[bundle.kind]}</span>
                {bundle.locations && (
                  <span style={{ color: locationColorVar(bundle.locations.color) }}>
                    {bundle.locations.emoji} {bundle.locations.name}
                  </span>
                )}
                {bundle.qr_slug && <span className="tabular">#{bundle.qr_slug}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
