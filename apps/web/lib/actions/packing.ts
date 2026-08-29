'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { ActionResult } from '@/lib/actions/items'

/**
 * Activating a list marks its items in transit, so the assistant stops
 * proposing moves for things already committed to a journey.
 */
export async function activatePackingList(listId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()

  const { data: entries } = await supabase
    .from('packing_list_items')
    .select('item_id')
    .eq('packing_list_id', listId)

  const { error } = await supabase
    .from('packing_lists')
    .update({ status: 'active' })
    .eq('id', listId)
  if (error) return { ok: false, error: error.message }

  if (entries?.length) {
    await supabase
      .from('items')
      .update({ status: 'in_transit' })
      .in(
        'id',
        entries.map((e) => e.item_id),
      )
  }

  revalidatePath(`/packing/${listId}`)
  revalidatePath('/packing')
  return { ok: true }
}

/**
 * Ticking an item off is what actually moves it.
 *
 * This is the hinge of the whole product: a plan that does not write back to
 * the inventory leaves the record wrong the moment a trip happens, and an
 * inventory that is wrong is worse than none.
 */
export async function checkPackingItem(
  packingItemId: string,
  checked: boolean,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('packing_list_items')
    .select('id, item_id, to_location_id, packing_list_id, checked')
    .eq('id', packingItemId)
    .maybeSingle()

  if (!entry) return { ok: false, error: 'That line is no longer on the list.' }
  if (entry.checked === checked) return { ok: true }

  const { error: markError } = await supabase
    .from('packing_list_items')
    .update({ checked, checked_at: checked ? new Date().toISOString() : null })
    .eq('id', packingItemId)
  if (markError) return { ok: false, error: markError.message }

  if (checked) {
    const { data: item } = await supabase
      .from('items')
      .select('location_id')
      .eq('id', entry.item_id)
      .maybeSingle()

    await supabase
      .from('items')
      .update({ location_id: entry.to_location_id, status: 'active' })
      .eq('id', entry.item_id)

    await supabase.from('item_movements').insert({
      household_id: session.householdId,
      item_id: entry.item_id,
      from_location_id: item?.location_id ?? null,
      to_location_id: entry.to_location_id,
      moved_by: session.member.id,
      reason: 'Packed and moved',
      packing_list_id: entry.packing_list_id,
    })
  }

  // Once every line is ticked the list is done and nothing is in transit.
  const { data: remaining } = await supabase
    .from('packing_list_items')
    .select('id')
    .eq('packing_list_id', entry.packing_list_id)
    .eq('checked', false)

  if (remaining && remaining.length === 0) {
    await supabase
      .from('packing_lists')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', entry.packing_list_id)
  }

  revalidatePath(`/packing/${entry.packing_list_id}`)
  revalidatePath('/inventory')
  revalidatePath('/')
  return { ok: true }
}

export async function cancelPackingList(listId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()

  const { data: entries } = await supabase
    .from('packing_list_items')
    .select('item_id')
    .eq('packing_list_id', listId)
    .eq('checked', false)

  const { error } = await supabase
    .from('packing_lists')
    .update({ status: 'cancelled' })
    .eq('id', listId)
  if (error) return { ok: false, error: error.message }

  // Release anything this list had marked as travelling.
  if (entries?.length) {
    await supabase
      .from('items')
      .update({ status: 'active' })
      .in(
        'id',
        entries.map((e) => e.item_id),
      )
      .eq('status', 'in_transit')
  }

  revalidatePath('/packing')
  revalidatePath('/inventory')
  return { ok: true }
}

export async function deletePackingList(listId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('packing_lists').delete().eq('id', listId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/packing')
  return { ok: true }
}
