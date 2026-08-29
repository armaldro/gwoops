'use client'

/**
 * Client-side image preparation.
 *
 * Downscaling before upload is the single biggest lever on both cost and
 * latency: a 12 MP phone photo is ~4 MB and buys nothing over 1568px, which is
 * the largest edge Claude's vision uses without further resizing.
 */

/** Claude resizes anything larger, so sending more is wasted bytes. */
export const MAX_EDGE = 1568
const JPEG_QUALITY = 0.82

export interface PreparedImage {
  blob: Blob
  dataUrl: string
  base64: string
  mediaType: 'image/jpeg'
  width: number
  height: number
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a 2D canvas context.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return {
    blob,
    dataUrl,
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mediaType: 'image/jpeg',
    width,
    height,
  }
}

export interface PhotoMetadata {
  lat?: number
  lng?: number
  takenAt?: string
}

/**
 * EXIF GPS from a gallery upload. Only ever a *suggestion* — many phones strip
 * location on share, and a photo taken at the shop is not where the item lives.
 */
export async function readPhotoMetadata(file: Blob): Promise<PhotoMetadata> {
  try {
    const exifr = (await import('exifr')).default
    const data = await exifr.parse(file as Blob, {
      pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate'],
    })
    if (!data) return {}

    const takenAtRaw = data.DateTimeOriginal ?? data.CreateDate
    return {
      lat: typeof data.latitude === 'number' ? data.latitude : undefined,
      lng: typeof data.longitude === 'number' ? data.longitude : undefined,
      takenAt: takenAtRaw instanceof Date ? takenAtRaw.toISOString() : undefined,
    }
  } catch {
    // A photo with unreadable or absent EXIF is completely normal.
    return {}
  }
}

/**
 * Run async work over a list with a bounded number in flight, reporting each
 * result as it lands. Keeps a 20-photo gallery import from opening 20 parallel
 * uploads and 20 parallel model calls.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number, result: R | null, error: unknown) => void,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null)
  let cursor = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      try {
        const value = await worker(items[index], index)
        results[index] = value
        onSettled?.(index, value, null)
      } catch (error) {
        onSettled?.(index, null, error)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  )
  return results
}
