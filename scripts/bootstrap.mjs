#!/usr/bin/env node
/**
 * One-time setup against a fresh Supabase project.
 *
 *   npm run bootstrap
 *
 * Creates the household, seeds the category catalogue and a starter set of
 * locations, and writes the allowlist. Nobody can sign in until this runs —
 * that is by design.
 *
 * Idempotent: safe to re-run after editing SEED_ALLOWED_EMAILS.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Minimal .env.local reader so this works without extra dependencies.
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // file absent — fall back to the real environment
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.',
  )
  process.exit(1)
}

const emails = (process.env.SEED_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

if (emails.length === 0) {
  console.error('Set SEED_ALLOWED_EMAILS to at least one address.')
  process.exit(1)
}

const householdName = process.env.SEED_HOUSEHOLD_NAME ?? 'Our Homes'
const db = createClient(url, serviceKey, { auth: { persistSession: false } })

// --- household --------------------------------------------------------------
let { data: household } = await db
  .from('households')
  .select('*')
  .eq('name', householdName)
  .maybeSingle()

if (!household) {
  const { data, error } = await db
    .from('households')
    .insert({ name: householdName })
    .select()
    .single()
  if (error) throw error
  household = data
  console.log(`✓ created household "${householdName}"`)
} else {
  console.log(`· household "${householdName}" already exists`)
}

// --- categories -------------------------------------------------------------
// Imported from the TypeScript definition so the DB catalogue and the app's
// filter/extraction schema can never disagree.
const { CATEGORIES } = await import('../lib/categories/schemas.ts')

const categoryRows = CATEGORIES.map((c, i) => ({
  household_id: household.id,
  slug: c.slug,
  label: c.label,
  icon: c.icon,
  is_private: c.isPrivate ?? false,
  sort_order: i,
  attribute_schema: { fields: c.fields, balanceBy: c.balanceBy },
}))

{
  const { error } = await db
    .from('categories')
    .upsert(categoryRows, { onConflict: 'household_id,slug' })
  if (error) throw error
  console.log(`✓ seeded ${categoryRows.length} categories`)
}

// --- starter locations ------------------------------------------------------
const { count: locationCount } = await db
  .from('locations')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', household.id)

if (!locationCount) {
  const { error } = await db.from('locations').insert([
    { household_id: household.id, name: 'Main home', emoji: '🏡', color: 'clay',
      is_default: true, sort_order: 0 },
    { household_id: household.id, name: 'Second home', emoji: '🌴', color: 'sage',
      sort_order: 1 },
  ])
  if (error) throw error
  console.log('✓ created two starter locations — set their GPS in Settings')
} else {
  console.log(`· ${locationCount} locations already exist`)
}

// --- allowlist --------------------------------------------------------------
const allowRows = emails.map((email, i) => ({
  email,
  household_id: household.id,
  role: i === 0 ? 'owner' : 'member',
}))

{
  const { error } = await db
    .from('allowed_emails')
    .upsert(allowRows, { onConflict: 'email' })
  if (error) throw error
  console.log(`✓ allowlisted ${emails.join(', ')}`)
}

console.log('\nDone. Sign in at /login with one of those addresses.')
