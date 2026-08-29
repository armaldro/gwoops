import { createClient } from '@/lib/supabase/server'

export const PHOTO_BUCKET = 'item-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * The bucket is private, so every photo needs a signed URL. Signing is batched
 * because an inventory grid asks for a hundred at once.
 */
export async function signPhotoUrls(
  paths: readonly string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return urls

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)

  if (error || !data) return urls

  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl)
  }
  return urls
}

/** Object key layout: <household>/<item>/<uuid>.jpg — see the storage policies. */
export function photoPath(householdId: string, itemId: string): string {
  return `${householdId}/${itemId}/${crypto.randomUUID()}.jpg`
}
