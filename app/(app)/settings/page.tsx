import { requireSession, getLocations } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { fetchMembers } from '@/lib/queries'
import { PageHeader } from '@/components/ui/primitives'
import { LocationSettings } from '@/components/settings/locations'
import { PeopleSettings } from '@/components/settings/people'
import { ProfileSettings } from '@/components/settings/profile'
import { DataSettings } from '@/components/settings/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [locations, members, allowlist] = await Promise.all([
    getLocations(),
    fetchMembers(),
    session.member.role === 'owner'
      ? supabase.from('allowed_emails').select('*').order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader title="Settings" />

      <ProfileSettings
        displayName={session.member.display_name}
        avatarEmoji={session.member.avatar_emoji}
        email={session.email}
        role={session.member.role}
      />

      <LocationSettings locations={locations} canWrite={session.canWrite} />

      <PeopleSettings
        members={members}
        allowlist={allowlist.data ?? []}
        isOwner={session.member.role === 'owner'}
        currentUserId={session.userId}
      />

      <DataSettings />
    </div>
  )
}
