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

  return (
    <div className="mx-auto max-w-3xl">
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
      />
    </div>
  )
}
