'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { ItemStatus } from '@/lib/supabase/types'

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Move an item and record why.
 *
 * The movement row is the point: without it the inventory says where things
 * are but never how they got there, and a packing list cannot reconcile itself
 * afterwards.
 */
export async function moveItem(
  itemId: string,
  toLocationId: string | null,
  reason?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Not signed in.' }
  if (!session.canWrite) return { ok: false, error: 'Your account is read-only.' }

  const supabase = await createClient()
  const { data: item } = await supabase
    .from('items')
    .select('id, location_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return { ok: false, error: 'That item no longer exists.' }
  if (item.location_id === toLocationId) return { ok: true }

  const { error: updateError } = await supabase
    .from('items')
    .update({ location_id: toLocationId, status: 'active' })
    .eq('id', itemId)

  if (updateError) return { ok: false, error: updateError.message }

  const { error: logError } = await supabase.from('item_movements').insert({
    household_id: session.householdId,
    item_id: itemId,
    from_location_id: item.location_id,
    to_location_id: toLocationId,
    moved_by: session.member.id,
    reason: reason ?? null,
  })

  // A failed log entry is worth surfacing: the move happened, but the history
  // is now incomplete, and quietly losing that is how the record rots.
  if (logError) {
    return {
      ok: false,
      error: `Moved, but the history entry failed: ${logError.message}`,
    }
  }

  revalidatePath(`/items/${itemId}`)
  revalidatePath('/inventory')
  revalidatePath('/')
  return { ok: true }
}

export async function setItemStatus(
  itemId: string,
  status: ItemStatus,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('items').update({ status }).eq('id', itemId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/items/${itemId}`)
  revalidatePath('/inventory')
  return { ok: true }
}

/** Pinned items are excluded from rebalancing proposals. */
export async function setItemPinned(
  itemId: string,
  isPinned: boolean,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
    .update({ is_pinned: isPinned })
    .eq('id', itemId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/items/${itemId}`)
  return { ok: true }
}

export async function updateItemFields(
  itemId: string,
  fields: {
    name?: string
    notes?: string | null
    quantity?: number
    attributes?: Record<string, string | number | string[]>
  },
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('items').update(fields).eq('id', itemId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/items/${itemId}`)
  revalidatePath('/inventory')
  return { ok: true }
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/inventory')
  revalidatePath('/')
  return { ok: true }
}
