import { requireSession, getLocations } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/primitives'
import { ChatPanel } from '@/components/chat/chat-panel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ask' }

export default async function ChatPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const locations = await getLocations()

  const { count: itemCount } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  // The most recent draft, so a plan made in an earlier session is still
  // there beside the conversation when you come back to it.
  const { data: latestDraft } = await supabase
    .from('packing_lists')
    .select('id')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-3xl fold:max-w-none">
      <PageHeader
        title="Ask about your things"
        subtitle={
          itemCount
            ? `${itemCount} items across ${locations.length} ${locations.length === 1 ? 'home' : 'homes'}.`
            : 'Nothing catalogued yet — add a few items first.'
        }
      />
      <ChatPanel
        canWrite={session.canWrite}
        homeNames={locations.map((l) => l.name)}
        hasItems={Boolean(itemCount)}
        initialPlanId={latestDraft?.id ?? null}
      />
    </div>
  )
}
