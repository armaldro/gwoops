'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { photoPath } from '@/lib/photos'
import type { ItemCondition } from '@/lib/supabase/types'
import { getCategory } from '@nest/domain/categories'

export interface SaveItemInput {
  name: string
  categorySlug: string
  locationId: string | null
  attributes: Record<string, string | number | string[]>
  quantity: number
  condition: ItemCondition | null
  estValue: number | null
  notes: string | null
  confidence: number | null
  isPrivate: boolean
  /** Base64 JPEG of the (already downscaled) photo. */
  imageBase64: string | null
  takenAt: string | null
  exifLat: number | null
  exifLng: number | null
}

export type SaveItemResult =
  | { ok: true; itemId: string }
  | { ok: false; error: string }

/**
 * Create an item, upload its photo and open its history.
 *
 * The photo is uploaded server-side rather than straight from the browser so
 * the object key is chosen here — the storage policies authorise on the first
 * path segment being the caller's household, and that is not a decision to
 * leave to client code.
 */
export async function saveItem(input: SaveItemInput): Promise<SaveItemResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Not signed in.' }
  if (!session.canWrite) return { ok: false, error: 'Your account is read-only.' }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give the item a name.' }

  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', input.categorySlug)
    .maybeSingle()

  const { data: item, error: insertError } = await supabase
    .from('items')
    .insert({
      household_id: session.householdId,
      name,
      category_id: category?.id ?? null,
      location_id: input.locationId,
      quantity: Math.max(1, Math.round(input.quantity || 1)),
      attributes: input.attributes,
      condition: input.condition,
      est_value: input.estValue,
      notes: input.notes,
      ai_confidence: input.confidence,
      is_private: input.isPrivate || (getCategory(input.categorySlug).isPrivate ?? false),
      created_by: session.member.id,
    })
    .select('id')
    .single()

  if (insertError || !item) {
    return { ok: false, error: insertError?.message ?? 'Could not save the item.' }
  }

  if (input.imageBase64) {
    const path = photoPath(session.householdId, item.id)
    const bytes = Buffer.from(input.imageBase64, 'base64')

    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) {
      // The item is real and worth keeping even if the photo did not land;
      // say so rather than pretending everything worked.
      return {
        ok: false,
        error: `Saved "${name}", but the photo did not upload: ${uploadError.message}`,
      }
    }

    await supabase.from('item_photos').insert({
      household_id: session.householdId,
      item_id: item.id,
      storage_path: path,
      is_primary: true,
      taken_at: input.takenAt,
      exif_lat: input.exifLat,
      exif_lng: input.exifLng,
    })
  }

  // Opening the history with the arrival makes the timeline complete from day
  // one rather than starting at the first move.
  if (input.locationId) {
    await supabase.from('item_movements').insert({
      household_id: session.householdId,
      item_id: item.id,
      from_location_id: null,
      to_location_id: input.locationId,
      moved_by: session.member.id,
      reason: 'Added to inventory',
    })
  }

  revalidatePath('/inventory')
  revalidatePath('/')
  return { ok: true, itemId: item.id }
}

/** Merge a capture into an existing item instead of creating a duplicate. */
export async function mergeIntoItem(
  existingItemId: string,
  extraQuantity: number,
): Promise<SaveItemResult> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { data: item } = await supabase
    .from('items')
    .select('id, quantity')
    .eq('id', existingItemId)
    .maybeSingle()

  if (!item) return { ok: false, error: 'That item no longer exists.' }

  const { error } = await supabase
    .from('items')
    .update({ quantity: item.quantity + Math.max(1, extraQuantity) })
    .eq('id', existingItemId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/inventory')
  revalidatePath(`/items/${existingItemId}`)
  return { ok: true, itemId: existingItemId }
}

export async function createLocationHere(input: {
  name: string
  emoji: string
  lat: number | null
  lng: number | null
}): Promise<{ ok: boolean; locationId?: string; error?: string }> {
  const session = await getSession()
  if (!session?.canWrite) return { ok: false, error: 'Not allowed.' }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('locations').select('color')
  const { nextLocationColor } = await import('@nest/domain/colors')

  const { data, error } = await supabase
    .from('locations')
    .insert({
      household_id: session.householdId,
      name: input.name.trim() || 'New home',
      emoji: input.emoji || '🏠',
      color: nextLocationColor((existing ?? []).map((l) => l.color)),
      lat: input.lat,
      lng: input.lng,
      sort_order: existing?.length ?? 0,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save.' }

  revalidatePath('/')
  revalidatePath('/capture')
  return { ok: true, locationId: data.id }
}
