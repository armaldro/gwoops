import * as z from 'zod/v4'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { distribute, type DistributableItem } from '@nest/domain/distribution'
import { findOverProvisioned, type DuplicateCandidate } from '@nest/domain/duplicates'
import { getCategory, summaryLine } from '@nest/domain/categories'
import type { Session } from '@/lib/session'

type Db = SupabaseClient<Database>

interface ToolContext {
  supabase: Db
  session: Session
  /**
   * Called when create_packing_list actually persists something, so the route
   * can push the id down the stream and the UI can show the plan beside the
   * conversation. Avoids the client having to poll for what just happened.
   */
  onPackingListCreated?: (packingListId: string) => void
}

/** Rows the tools work from, loaded once per query. */
interface AgentItem {
  id: string
  name: string
  quantity: number
  locationId: string | null
  locationName: string | null
  categorySlug: string
  ownerMemberId: string | null
  attributes: Record<string, string | number | string[]>
  isPinned: boolean
  status: string
  bundleId: string | null
  estValue: number | null
}

async function loadItems(
  ctx: ToolContext,
  filters: {
    categorySlug?: string
    locationId?: string
    ownerMemberId?: string
    includeArchived?: boolean
  } = {},
): Promise<AgentItem[]> {
  let query = ctx.supabase
    .from('items')
    .select(
      `id, name, quantity, location_id, owner_member_id, attributes, is_pinned,
       status, est_value, purchase_price,
       categories ( slug ), locations ( name ), bundle_items ( bundle_id )`,
    )
    // Documents and valuables are private by default and stay out of the
    // assistant's view unless someone opens the item itself.
    .eq('is_private', false)

  if (!filters.includeArchived) query = query.neq('status', 'archived')
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.ownerMemberId) query = query.eq('owner_member_id', filters.ownerMemberId)

  const { data, error } = await query.limit(2000)
  if (error) throw new Error(error.message)

  const items: AgentItem[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string
      quantity: number
      location_id: string | null
      owner_member_id: string | null
      attributes: Record<string, string | number | string[]> | null
      is_pinned: boolean
      status: string
      est_value: number | null
      purchase_price: number | null
      categories: { slug: string } | null
      locations: { name: string } | null
      bundle_items: { bundle_id: string }[] | null
    }
    return {
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      locationId: r.location_id,
      locationName: r.locations?.name ?? null,
      categorySlug: r.categories?.slug ?? 'other',
      ownerMemberId: r.owner_member_id,
      attributes: r.attributes ?? {},
      isPinned: r.is_pinned,
      status: r.status,
      bundleId: r.bundle_items?.[0]?.bundle_id ?? null,
      estValue: r.est_value ?? r.purchase_price ?? null,
    }
  })

  return filters.categorySlug
    ? items.filter((i) => i.categorySlug === filters.categorySlug)
    : items
}

async function loadLocations(ctx: ToolContext) {
  const { data } = await ctx.supabase
    .from('locations')
    .select('id, name, emoji, notes')
    .order('sort_order')
  return data ?? []
}

/** Tool results are text, so keep them compact and unambiguous. */
function asJson(value: unknown): string {
  return JSON.stringify(value, null, 1)
}

export function buildTools(ctx: ToolContext) {
  const searchInventory = betaZodTool({
    name: 'search_inventory',
    description:
      'Find items. Every filter is optional; with none, returns a sample across the whole inventory. ' +
      'Use this when the user asks what they own, or before proposing anything about specific items.',
    inputSchema: z.object({
      query: z.string().optional().describe('Free text matched against names and notes.'),
      category_slug: z.string().optional().describe('e.g. shoes, clothing, electronics'),
      location_name: z.string().optional().describe('Restrict to one home, by name.'),
      attribute_key: z.string().optional().describe('Attribute to filter on, e.g. "type".'),
      attribute_value: z.string().optional().describe('Value that attribute must have.'),
      limit: z.number().int().optional().describe('Default 50, maximum 200.'),
    }),
    run: async (input) => {
      const locations = await loadLocations(ctx)
      const location = input.location_name
        ? locations.find(
            (l) => l.name.toLowerCase() === input.location_name!.toLowerCase(),
          )
        : undefined

      if (input.location_name && !location) {
        return `No home called "${input.location_name}". Known homes: ${locations.map((l) => l.name).join(', ')}.`
      }

      let items = await loadItems(ctx, {
        categorySlug: input.category_slug,
        locationId: location?.id,
      })

      if (input.query) {
        const needle = input.query.toLowerCase()
        items = items.filter((i) => i.name.toLowerCase().includes(needle))
      }
      if (input.attribute_key && input.attribute_value) {
        const wanted = input.attribute_value.toLowerCase()
        items = items.filter((i) => {
          const value = i.attributes[input.attribute_key!]
          if (value === undefined) return false
          return Array.isArray(value)
            ? value.some((v) => String(v).toLowerCase() === wanted)
            : String(value).toLowerCase() === wanted
        })
      }

      const limit = Math.min(input.limit ?? 50, 200)
      return asJson({
        matched: items.length,
        showing: Math.min(limit, items.length),
        items: items.slice(0, limit).map((i) => ({
          id: i.id,
          name: i.name,
          summary: summaryLine(i.categorySlug, i.attributes),
          category: i.categorySlug,
          home: i.locationName,
          quantity: i.quantity,
          pinned: i.isPinned || undefined,
          in_transit: i.status === 'in_transit' || undefined,
        })),
      })
    },
  })

  const getInventorySummary = betaZodTool({
    name: 'get_inventory_summary',
    description:
      'Counts and estimated value per home, broken down by category. Use this first for ' +
      '"what do we have where" questions, before pulling individual items.',
    inputSchema: z.object({}),
    run: async () => {
      const [items, locations] = await Promise.all([loadItems(ctx), loadLocations(ctx)])

      const byLocation = locations.map((location) => {
        const here = items.filter((i) => i.locationId === location.id)
        const categories: Record<string, number> = {}
        for (const item of here) {
          categories[item.categorySlug] = (categories[item.categorySlug] ?? 0) + 1
        }
        return {
          home: location.name,
          total: here.length,
          est_value: Math.round(here.reduce((n, i) => n + (i.estValue ?? 0), 0)),
          by_category: categories,
        }
      })

      return asJson({
        total_items: items.length,
        homes: byLocation,
        unassigned: items.filter((i) => !i.locationId).length,
      })
    },
  })

  const getLocationsTool = betaZodTool({
    name: 'get_locations',
    description:
      'List the household’s homes, with any notes about them (climate, size, who uses them).',
    inputSchema: z.object({}),
    run: async () => {
      const locations = await loadLocations(ctx)
      return asJson(
        locations.map((l) => ({ name: l.name, emoji: l.emoji, notes: l.notes })),
      )
    },
  })

  const getItem = betaZodTool({
    name: 'get_item',
    description: 'Everything about one item, including where it has been.',
    inputSchema: z.object({ item_id: z.string() }),
    run: async (input) => {
      const { data: item } = await ctx.supabase
        .from('items')
        .select('*, categories ( slug, label ), locations ( name )')
        .eq('id', input.item_id)
        .maybeSingle()

      if (!item) return 'No item with that id.'

      const { data: movements } = await ctx.supabase
        .from('item_movements')
        .select('created_at, reason, from:from_location_id ( name ), to:to_location_id ( name )')
        .eq('item_id', input.item_id)
        .order('created_at', { ascending: false })
        .limit(10)

      return asJson({ item, history: movements ?? [] })
    },
  })

  const proposeDistribution = betaZodTool({
    name: 'propose_distribution',
    description:
      'Work out how to spread items across homes. This does the actual counting — always use it ' +
      'rather than dividing numbers yourself. It balances within meaningful groups (so winter boots ' +
      'do not all end up in one house), leaves pinned and in-transit items alone, keeps bundles ' +
      'together, and prefers leaving things where they already are. Returns the plan plus the facts ' +
      'behind it for you to explain.',
    inputSchema: z.object({
      category_slug: z
        .string()
        .optional()
        .describe('Limit to one category, e.g. "shoes". Omit to balance everything.'),
      home_names: z
        .array(z.string())
        .optional()
        .describe('Homes to spread across. Omit to use all of them.'),
      owner_name: z
        .string()
        .optional()
        .describe('Limit to one person’s things.'),
      weights: z
        .array(z.object({ home_name: z.string(), weight: z.number() }))
        .optional()
        .describe('Uneven shares, e.g. twice as much at the main home.'),
    }),
    run: async (input) => {
      const [locations, members] = await Promise.all([
        loadLocations(ctx),
        ctx.supabase.from('household_members').select('id, display_name'),
      ])

      const targets = (input.home_names?.length
        ? input.home_names
            .map((wanted) =>
              locations.find((l) => l.name.toLowerCase() === wanted.toLowerCase()),
            )
            .filter((l): l is (typeof locations)[number] => Boolean(l))
        : locations
      ).map((location) => ({
        id: location.id,
        name: location.name,
        weight:
          input.weights?.find(
            (w) => w.home_name.toLowerCase() === location.name.toLowerCase(),
          )?.weight ?? 1,
      }))

      if (targets.length < 2) {
        return 'Balancing needs at least two homes. Ask which homes to spread across, or add another in Settings.'
      }

      const owner = input.owner_name
        ? (members.data ?? []).find(
            (m) => m.display_name.toLowerCase() === input.owner_name!.toLowerCase(),
          )
        : undefined

      const items = await loadItems(ctx, {
        categorySlug: input.category_slug,
        ownerMemberId: owner?.id,
      })

      if (items.length === 0) {
        return 'Nothing matches that scope, so there is nothing to balance.'
      }

      const balanceBy = input.category_slug
        ? getCategory(input.category_slug).balanceBy
        : ['type']

      const distributable: DistributableItem[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        categorySlug: item.categorySlug,
        locationId: item.locationId,
        attributes: item.attributes,
        quantity: item.quantity,
        // In-transit items are already committed to a journey.
        pinned: item.isPinned || item.status === 'in_transit',
        bundleId: item.bundleId,
      }))

      const result = distribute(distributable, targets, { balanceBy })
      const homeName = new Map(targets.map((t) => [t.id, t.name]))

      return asJson({
        summary: result.perLocation.map((l) => ({
          home: l.name,
          before: l.before,
          after: l.after,
        })),
        moves: result.moves.map((m) => ({
          item_id: m.itemId,
          name: m.name,
          from: m.fromLocationId ? homeName.get(m.fromLocationId) ?? 'elsewhere' : 'nowhere',
          to: homeName.get(m.toLocationId),
          group: m.stratum,
        })),
        staying_put: result.assignments.length - result.moves.length,
        facts: result.facts,
        unplaceable: result.unplaceable,
      })
    },
  })

  const findGaps = betaZodTool({
    name: 'find_gaps',
    description:
      'What one home lacks that the others have. Use for "what am I missing in X?" — it compares ' +
      'category and type coverage across homes.',
    inputSchema: z.object({
      home_name: z.string().describe('The home to check.'),
    }),
    run: async (input) => {
      const locations = await loadLocations(ctx)
      const target = locations.find(
        (l) => l.name.toLowerCase() === input.home_name.toLowerCase(),
      )
      if (!target) {
        return `No home called "${input.home_name}". Known homes: ${locations.map((l) => l.name).join(', ')}.`
      }

      const items = await loadItems(ctx)
      const signature = (item: AgentItem) =>
        `${item.categorySlug}:${firstValue(item.attributes.type) ?? firstValue(item.attributes.device_type) ?? 'general'}`

      const here = new Set(items.filter((i) => i.locationId === target.id).map(signature))
      const gaps = new Map<string, string[]>()

      for (const item of items) {
        if (item.locationId === target.id || !item.locationId) continue
        const key = signature(item)
        if (here.has(key)) continue
        const examples = gaps.get(key) ?? []
        if (examples.length < 3) examples.push(`${item.name} (${item.locationName})`)
        gaps.set(key, examples)
      }

      return asJson({
        home: target.name,
        items_here: items.filter((i) => i.locationId === target.id).length,
        missing: [...gaps.entries()].map(([kind, examples]) => ({ kind, examples })),
      })
    },
  })

  const findDuplicatesTool = betaZodTool({
    name: 'find_duplicates',
    description:
      'Groups of near-identical things the household may have too many of. Useful for consolidating ' +
      'before a move, or deciding what can be split without buying more.',
    inputSchema: z.object({
      category_slug: z.string().optional(),
      min_count: z.number().int().optional().describe('Group size to report. Default 3.'),
    }),
    run: async (input) => {
      const items = await loadItems(ctx, { categorySlug: input.category_slug })
      const candidates: DuplicateCandidate[] = items.map((i) => ({
        id: i.id,
        name: i.name,
        categorySlug: i.categorySlug,
        locationId: i.locationId,
        locationName: i.locationName,
        attributes: i.attributes,
        quantity: i.quantity,
      }))

      const groups = findOverProvisioned(candidates, input.min_count ?? 3)
      return asJson(
        groups.slice(0, 12).map((group) => ({
          kind: group.key,
          count: group.items.length,
          spread: countBy(group.items.map((i) => i.locationName ?? 'no home')),
          examples: group.items.slice(0, 5).map((i) => i.name),
        })),
      )
    },
  })

  const createPackingList = betaZodTool({
    name: 'create_packing_list',
    description:
      'Save a plan as a DRAFT packing list the household can review, tick off, and have applied to ' +
      'the inventory. This is the only tool that writes anything. Use it once the user has agreed to ' +
      'a plan — never speculatively, and never without telling them you are doing it.',
    inputSchema: z.object({
      title: z.string().describe('e.g. "Rebalance shoes: Singapore → Bali"'),
      rationale: z
        .string()
        .describe('One or two sentences on why this split, in your own words.'),
      moves: z
        .array(
          z.object({
            item_id: z.string(),
            to_home_name: z.string(),
            reason: z.string().optional(),
          }),
        )
        .describe('Only items that actually need to move.'),
      depart_on: z.string().optional().describe('ISO date, if the user gave one.'),
    }),
    run: async (input) => {
      if (!ctx.session.canWrite) {
        return 'This account is read-only, so the list was not saved. Tell the user what the plan is instead.'
      }
      if (input.moves.length === 0) {
        return 'No moves were supplied, so there is nothing to save. Everything may already be balanced.'
      }

      const locations = await loadLocations(ctx)
      const byName = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]))

      const unknown = [
        ...new Set(
          input.moves
            .map((m) => m.to_home_name)
            .filter((name) => !byName.has(name.toLowerCase())),
        ),
      ]
      if (unknown.length) {
        return `Unknown home(s): ${unknown.join(', ')}. Known homes: ${locations.map((l) => l.name).join(', ')}.`
      }

      const { data: list, error } = await ctx.supabase
        .from('packing_lists')
        .insert({
          household_id: ctx.session.householdId,
          title: input.title,
          rationale: input.rationale,
          status: 'draft',
          generated_by: 'ai',
          depart_on: input.depart_on ?? null,
          created_by: ctx.session.member.id,
        })
        .select('id')
        .single()

      if (error || !list) {
        return `Could not save the list: ${error?.message ?? 'unknown error'}.`
      }

      const { error: itemsError } = await ctx.supabase.from('packing_list_items').insert(
        input.moves.map((move) => ({
          household_id: ctx.session.householdId,
          packing_list_id: list.id,
          item_id: move.item_id,
          to_location_id: byName.get(move.to_home_name.toLowerCase())!,
          reason: move.reason ?? null,
        })),
      )

      if (itemsError) {
        return `The list was created but its items failed to save: ${itemsError.message}.`
      }

      ctx.onPackingListCreated?.(list.id)

      return asJson({
        saved: true,
        packing_list_id: list.id,
        url: `/packing/${list.id}`,
        moves: input.moves.length,
        note: 'Saved as a draft. Tell the user it is waiting for them at that link, and that ticking items off will update where things are.',
      })
    },
  })

  return [
    searchInventory,
    getInventorySummary,
    getLocationsTool,
    getItem,
    proposeDistribution,
    findGaps,
    findDuplicatesTool,
    createPackingList,
  ]
}

function firstValue(value: string | number | string[] | undefined): string | null {
  if (value === undefined) return null
  if (Array.isArray(value)) return value[0] != null ? String(value[0]) : null
  return String(value)
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const value of values) out[value] = (out[value] ?? 0) + 1
  return out
}
