import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

/** Feeds the chat page's plan pane. RLS scopes it to the caller's household. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: list } = await supabase
    .from('packing_lists')
    .select('title, status, rationale')
    .eq('id', id)
    .maybeSingle()

  if (!list) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const { data: entries } = await supabase
    .from('packing_list_items')
    .select('id, checked, reason, items ( name ), locations:to_location_id ( name )')
    .eq('packing_list_id', id)

  const lines = (entries ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      checked: boolean
      reason: string | null
      items: { name: string } | null
      locations: { name: string } | null
    }
    return {
      id: r.id,
      itemName: r.items?.name ?? 'Removed item',
      toName: r.locations?.name ?? null,
      checked: r.checked,
      reason: r.reason,
    }
  })

  return NextResponse.json({ ...list, lines })
}
