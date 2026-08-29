import * as z from 'zod/v4'
import { CATEGORIES, CATEGORY_SLUGS } from '@/lib/categories/schemas'

/**
 * What Claude returns from a photo.
 *
 * Kept deliberately flat and permissive on `attributes`: a strict per-category
 * union would force the model to commit to a category before it has described
 * what it sees. Instead it picks a category and fills a free-form attribute
 * map, and normaliseAttributes() reconciles that against the category's real
 * schema afterwards — keeping anything unexpected rather than dropping it.
 */
export const RecognitionSchema = z.object({
  name: z
    .string()
    .describe(
      'A short, specific, human name for this item as its owner would say it. ' +
        'Lead with distinguishing colour/material, then the noun. ' +
        'e.g. "Navy suede Chelsea boots", not "Footwear" or "A pair of shoes".',
    ),
  category_slug: z
    .enum(CATEGORY_SLUGS)
    .describe('Which category this belongs to. Use "other" only as a last resort.'),
  attributes: z
    .record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]))
    .describe(
      'Attribute values using exactly the keys listed for the chosen category. ' +
        'Omit any field you cannot see — never guess a size or a serial number.',
    ),
  brand_guess: z
    .string()
    .nullable()
    .describe('Brand, only if a logo or wordmark is actually legible. Otherwise null.'),
  condition: z
    .enum(['new', 'excellent', 'good', 'fair', 'worn'])
    .describe('Visible wear.'),
  est_value: z
    .number()
    .nullable()
    .describe(
      'Rough replacement cost in the household currency, or null if you have no basis for a figure.',
    ),
  quantity: z
    .number()
    .int()
    .describe(
      'How many distinct units are in the photo. A pair of shoes is 1. Six identical mugs is 6.',
    ),
  confidence: z
    .number()
    .describe('0 to 1: how sure you are of the name and category together.'),
  alternatives: z
    .array(
      z.object({
        name: z.string(),
        category_slug: z.enum(CATEGORY_SLUGS),
      }),
    )
    .describe(
      'Up to three other readings of the photo, best first. Empty when the item is unambiguous.',
    ),
})

export type Recognition = z.infer<typeof RecognitionSchema>

/**
 * The category catalogue, rendered once as text.
 *
 * This is the expensive, stable half of the prompt, so it sits behind a cache
 * breakpoint. It must be byte-identical between requests — no timestamps, no
 * per-request ids — or every capture pays full price.
 */
export function buildCategoryCatalogue(): string {
  const lines: string[] = []

  for (const category of CATEGORIES) {
    lines.push(`### ${category.slug} — ${category.label}`)
    for (const field of category.fields) {
      const options = field.options?.length
        ? ` — one of: ${field.options.join(', ')}`
        : ''
      const multi = field.type === 'multiselect' ? ' (array of strings)' : ''
      const number = field.type === 'number' ? ' (number)' : ''
      const hint = field.hint ? ` — ${field.hint}` : ''
      lines.push(`- ${field.key}${multi}${number}${options}${hint}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
