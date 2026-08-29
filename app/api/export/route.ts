import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

/**
 * Full inventory export.
 *
 * CSV is the insurance format: one row per item with the fields a claim asks
 * for. JSON keeps everything, including attributes and history, so the data is
 * genuinely portable rather than nominally exportable.
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('items')
    .select(
      `id, name, quantity, attributes, condition, purchase_date, purchase_price,
       currency, est_value, warranty_ends_at, expires_at, status, notes, created_at,
       categories ( slug, label ), locations ( name ), household_members ( display_name )`,
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string
      quantity: number
      attributes: Record<string, unknown> | null
      condition: string | null
      purchase_date: string | null
      purchase_price: number | null
      currency: string
      est_value: number | null
      warranty_ends_at: string | null
      expires_at: string | null
      status: string
      notes: string | null
      created_at: string
      categories: { slug: string; label: string } | null
      locations: { name: string } | null
      household_members: { display_name: string } | null
    }
    return {
      id: r.id,
      name: r.name,
      category: r.categories?.label ?? 'Other',
      home: r.locations?.name ?? '',
      owner: r.household_members?.display_name ?? '',
      quantity: r.quantity,
      brand: String(r.attributes?.brand ?? ''),
      model: String(r.attributes?.model ?? ''),
      serial: String(r.attributes?.serial ?? ''),
      condition: r.condition ?? '',
      purchase_date: r.purchase_date ?? '',
      purchase_price: r.purchase_price ?? '',
      est_value: r.est_value ?? '',
      currency: r.currency,
      warranty_ends: r.warranty_ends_at ?? '',
      status: r.status,
      notes: r.notes ?? '',
      added: r.created_at.slice(0, 10),
      attributes: r.attributes ?? {},
    }
  })

  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'json') {
    return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), items: rows }, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="nest-inventory-${stamp}.json"`,
      },
    })
  }

  const columns = [
    'id', 'name', 'category', 'home', 'owner', 'quantity', 'brand', 'model',
    'serial', 'condition', 'purchase_date', 'purchase_price', 'est_value',
    'currency', 'warranty_ends', 'status', 'notes', 'added',
  ] as const

  const csv = [
    columns.join(','),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(','),
    ),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="nest-inventory-${stamp}.csv"`,
    },
  })
}

/** RFC 4180 quoting: a stray comma or quote must not shift every column. */
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
