import { getLocations, requireSession } from '@/lib/session'
import { PageHeader, Empty, LinkButton } from '@/components/ui/primitives'
import { CaptureStudio } from '@/components/capture/capture-studio'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add an item' }

export default async function CapturePage() {
  const session = await requireSession()
  const locations = await getLocations()

  if (!session.canWrite) {
    return (
      <Empty
        icon="👀"
        title="Read-only account"
        body="You can browse everything, but adding items needs a member or owner account."
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Add an item"
        subtitle="Photograph it. Everything else gets filled in for you."
      />
      {locations.length === 0 ? (
        <Empty
          icon="🏠"
          title="Set up a home first"
          body="Items need somewhere to live. Add your homes, then come back and start photographing."
          action={<LinkButton href="/settings">Add a home</LinkButton>}
        />
      ) : (
        <CaptureStudio locations={locations} />
      )}
    </>
  )
}
