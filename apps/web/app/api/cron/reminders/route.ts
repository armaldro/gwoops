import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Daily sweep that turns warranty and expiry dates into reminder rows.
 *
 * Runs on a Vercel cron (see vercel.json). Uses the service-role client
 * because there is no user session behind a cron invocation; the shared secret
 * is what authorises it.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${serverEnv.cronSecret()}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 60)
  const horizonDate = horizon.toISOString().slice(0, 10)

  const { data: items, error } = await admin
    .from('items')
    .select('id, household_id, warranty_ends_at, expires_at')
    .neq('status', 'archived')
    .or(`warranty_ends_at.lte.${horizonDate},expires_at.lte.${horizonDate}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows: {
    household_id: string
    item_id: string
    kind: 'warranty' | 'expiry'
    due_on: string
  }[] = []

  for (const item of items ?? []) {
    if (item.warranty_ends_at && item.warranty_ends_at <= horizonDate) {
      rows.push({
        household_id: item.household_id,
        item_id: item.id,
        kind: 'warranty',
        due_on: item.warranty_ends_at,
      })
    }
    if (item.expires_at && item.expires_at <= horizonDate) {
      rows.push({
        household_id: item.household_id,
        item_id: item.id,
        kind: 'expiry',
        due_on: item.expires_at,
      })
    }
  }

  if (rows.length) {
    // The unique index on (item_id, kind, due_on) makes this idempotent, so a
    // daily run never produces duplicates or resurrects a dismissed reminder.
    const { error: upsertError } = await admin
      .from('reminders')
      .upsert(rows, { onConflict: 'item_id,kind,due_on', ignoreDuplicates: true })
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, created: rows.length })
}
