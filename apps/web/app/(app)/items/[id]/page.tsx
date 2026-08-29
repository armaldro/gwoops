import { notFound } from 'next/navigation'
import { fetchItem } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import { ItemDetail } from '@/components/items/item-detail'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const item = await fetchItem((await params).id)
  return { title: item?.name ?? 'Item' }
}

/**
 * The canonical deep link for an item — what chat, packing and search point
 * at. The inventory page renders the same component as a side pane when the
 * screen is wide enough to show both.
 */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()

  const item = await fetchItem(id)
  if (!item) notFound()

  return <ItemDetail itemId={id} canWrite={session.canWrite} />
}
