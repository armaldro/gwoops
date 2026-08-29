import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { anthropic, MODEL } from '@/lib/anthropic'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { RecognitionSchema } from '@/lib/vision/schema'
import {
  RECOGNITION_SYSTEM_PROMPT,
  buildRecognitionContext,
} from '@/lib/vision/prompt'
import { normaliseAttributes, getCategory } from '@/lib/categories/schemas'
import { findDuplicates, type DuplicateCandidate } from '@/lib/duplicates'

export const maxDuration = 60

const ACCEPTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp'] as const
type MediaType = (typeof ACCEPTED_MEDIA)[number]

interface RecognizeBody {
  /** Base64 JPEG, already downscaled client-side by lib/image.ts. */
  imageBase64: string
  mediaType?: MediaType
  locationId?: string | null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  if (!session.canWrite) {
    return NextResponse.json({ error: 'Your account is read-only.' }, { status: 403 })
  }

  let body: RecognizeBody
  try {
    body = (await request.json()) as RecognizeBody
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
  }

  if (!body.imageBase64) {
    return NextResponse.json({ error: 'No image was supplied.' }, { status: 400 })
  }

  const mediaType: MediaType = ACCEPTED_MEDIA.includes(body.mediaType as MediaType)
    ? (body.mediaType as MediaType)
    : 'image/jpeg'

  const supabase = await createClient()

  // Context for the volatile half of the prompt. Both queries are small and
  // deliberately kept out of the cached prefix.
  const [{ data: location }, { data: recentItems }] = await Promise.all([
    body.locationId
      ? supabase.from('locations').select('name').eq('id', body.locationId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('items')
      .select('id, name, quantity, location_id, attributes, categories ( slug )')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(400),
  ])

  const existing: DuplicateCandidate[] = (recentItems ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string
      quantity: number
      location_id: string | null
      attributes: Record<string, string | number | string[]>
      categories: { slug: string } | null
    }
    return {
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      locationId: r.location_id,
      attributes: r.attributes ?? {},
      categorySlug: r.categories?.slug ?? 'other',
    }
  })

  const knownBrands = [
    ...new Set(
      existing
        .map((item) => item.attributes.brand)
        .filter((b): b is string => typeof b === 'string' && b.length > 1),
    ),
  ].slice(0, 40)

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: {
        format: zodOutputFormat(RecognitionSchema),
        effort: 'medium',
      },
      system: [
        {
          type: 'text',
          text: RECOGNITION_SYSTEM_PROMPT,
          // The catalogue is large and identical every time; after the first
          // capture this prefix is served from cache at a tenth of the price.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: body.imageBase64 },
            },
            {
              type: 'text',
              text: buildRecognitionContext({
                locationName: location?.name ?? null,
                knownBrands,
                currency: 'SGD',
              }),
            },
          ],
        },
      ],
    })

    const parsed = response.parsed_output
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not read that photo. Try a clearer shot.' },
        { status: 502 },
      )
    }

    const draft = {
      name: parsed.name,
      categorySlug: parsed.category_slug,
      attributes: normaliseAttributes(parsed.category_slug, {
        ...parsed.attributes,
        ...(parsed.brand_guess ? { brand: parsed.brand_guess } : {}),
      }),
      condition: parsed.condition,
      estValue: parsed.est_value,
      quantity: Math.max(1, Math.round(parsed.quantity || 1)),
      confidence: clamp01(parsed.confidence),
      alternatives: parsed.alternatives.slice(0, 3),
      isPrivate: getCategory(parsed.category_slug).isPrivate ?? false,
    }

    const duplicates = findDuplicates(
      {
        name: draft.name,
        categorySlug: draft.categorySlug,
        attributes: draft.attributes,
      },
      existing,
    )

    return NextResponse.json({
      draft,
      duplicates: duplicates.map((match) => ({
        id: match.candidate.id,
        name: match.candidate.name,
        locationId: match.candidate.locationId,
        quantity: match.candidate.quantity,
        reasons: match.reasons,
      })),
      usage: {
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 502 })
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return 'Too many photos at once — wait a moment and try again.'
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key is missing or invalid.'
  }
  if (error instanceof Anthropic.APIError) {
    return `Recognition failed (${error.status}). You can still fill the details in by hand.`
  }
  return 'Recognition failed. You can still fill the details in by hand.'
}
