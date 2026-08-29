import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { Empty, LinkButton, PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Packing' }

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Packing',
  done: 'Done',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-muted)',
  active: 'var(--warning)',
  done: 'var(--positive)',
  cancelled: 'var(--ink-faint)',
}

export default async function PackingPage() {
  await requireSession()
  const supabase = await createClient()

  const { data: lists } = await supabase
    .from('packing_lists')
    .select('*, packing_list_items ( id, checked )')
    .order('created_at', { ascending: false })

  const rows = (lists ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      title: string
      status: string
      rationale: string | null
      generated_by: string
      depart_on: string | null
      created_at: string
      packing_list_items: { id: string; checked: boolean }[]
    }
    return {
      ...r,
      total: r.packing_list_items.length,
      done: r.packing_list_items.filter((i) => i.checked).length,
    }
  })

  return (
    <>
      <PageHeader
        title="Packing"
        subtitle="Plans the assistant made, and what you have ticked off."
        action={<LinkButton href="/chat">💬 Plan a move</LinkButton>}
      />

      {rows.length === 0 ? (
        <Empty
          icon="🧳"
          title="No packing lists yet"
          body="Ask the assistant to balance a category across your homes and it will build one here."
          action={<LinkButton href="/chat">Ask the assistant</LinkButton>}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((list) => (
            <li key={list.id}>
              <Link href={`/packing/${list.id}`} className="card block p-4 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-base">{list.title}</div>
                    {list.rationale && (
                      <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                        {list.rationale}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: STATUS_COLOR[list.status], border: `1px solid ${STATUS_COLOR[list.status]}` }}
                  >
                    {STATUS_LABEL[list.status] ?? list.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--surface-sunk)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${list.total ? (list.done / list.total) * 100 : 0}%`,
                        background: 'var(--positive)',
                      }}
                    />
                  </div>
                  <span className="tabular text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {list.done}/{list.total}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
