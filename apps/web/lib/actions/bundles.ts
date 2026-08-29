'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { ActionResult } from '@/lib/actions/items'
import type { BundleKind } from '@/lib/supabase/types'

/** Short, unambiguous slug for a printed QR label. No 0/O/1/I. */
function qrSlug(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export async function createBundle(input: {
  name: string
  kind: BundleKind
  emoji: string
  locationId: string | null
}): Promise<ActionResult & { bundleId?: string }> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give it a name.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bundles')
    .insert({
      household_id: session.householdId,
      name,
      kind: input.kind,
      emoji: input.emoji || defaultEmoji(input.kind),
      location_id: input.locationId,
      // Only bins get printed, so only bins need a scannable code.
      qr_slug: input.kind === 'bin' ? qrSlug() : null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create.' }

  revalidatePath('/bundles')
  return { ok: true, bundleId: data.id }
}

export async function setBundleItems(
  bundleId: string,
  itemIds: string[],
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  await supabase.from('bundle_items').delete().eq('bundle_id', bundleId)

  if (itemIds.length) {
    const { error } = await supabase
      .from('bundle_items')
      .insert(itemIds.map((itemId) => ({ bundle_id: bundleId, item_id: itemId })))
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/bundles/${bundleId}`)
  revalidatePath('/bundles')
  return { ok: true }
}

/** Moving a bin moves everything in it — that is the point of a bin. */
export async function moveBundle(
  bundleId: string,
  toLocationId: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { data: links } = await supabase
    .from('bundle_items')
    .select('item_id')
    .eq('bundle_id', bundleId)

  const itemIds = (links ?? []).map((l) => l.item_id)

  const { error } = await supabase
    .from('bundles')
    .update({ location_id: toLocationId })
    .eq('id', bundleId)
  if (error) return { ok: false, error: error.message }

  if (itemIds.length) {
    const { data: before } = await supabase
      .from('items')
      .select('id, location_id')
      .in('id', itemIds)

    await supabase
      .from('items')
      .update({ location_id: toLocationId, status: 'active' })
      .in('id', itemIds)

    const movements = (before ?? [])
      .filter((item) => item.location_id !== toLocationId)
      .map((item) => ({
        household_id: session.householdId,
        item_id: item.id,
        from_location_id: item.location_id,
        to_location_id: toLocationId,
        moved_by: session.member.id,
        reason: 'Moved with its bundle',
      }))

    if (movements.length) await supabase.from('item_movements').insert(movements)
  }

  revalidatePath(`/bundles/${bundleId}`)
  revalidatePath('/inventory')
  return { ok: true }
}

export async function deleteBundle(bundleId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('bundles').delete().eq('id', bundleId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/bundles')
  return { ok: true }
}

function defaultEmoji(kind: BundleKind): string {
  return { outfit: '👗', kit: '🎒', bin: '📦' }[kind]
}
