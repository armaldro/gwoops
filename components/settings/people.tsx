'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AllowedEmailRow, HouseholdMemberRow, MemberRole } from '@/lib/supabase/types'
import { inviteMember, revokeInvite } from '@/lib/actions/settings'
import { Button } from '@/components/ui/primitives'

const ROLE_HELP: Record<MemberRole, string> = {
  owner: 'Full access, and can invite or remove people.',
  member: 'Can add, edit and move things.',
  viewer: 'Can browse and ask questions, but changes nothing.',
}

export function PeopleSettings({
  members,
  allowlist,
  isOwner,
  currentUserId,
}: {
  members: HouseholdMemberRow[]
  allowlist: AllowedEmailRow[]
  isOwner: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<string | null>(null)

  const pendingInvites = allowlist.filter((entry) => !entry.redeemed_at)

  return (
    <section>
      <h2 className="mb-3 font-display text-lg">Who can get in</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
        Only these addresses can sign in. The check runs in the database, so a
        sign-in link sent to anyone else is refused even if it is valid.
      </p>

      <ul className="card divide-y">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm">
              <span aria-hidden className="mr-1.5">{member.avatar_emoji}</span>
              {member.display_name}
              {member.user_id === currentUserId && (
                <span className="ml-1.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
                  (you)
                </span>
              )}
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {member.role}
            </span>
          </li>
        ))}

        {pendingInvites.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
              {entry.email}
              <span className="ml-1.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
                invited, not signed in yet
              </span>
            </span>
            {isOwner && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeInvite(entry.email)
                    if (result.ok) router.refresh()
                    else setError(result.error ?? 'Could not revoke.')
                  })
                }
                className="shrink-0 text-xs underline underline-offset-4"
                style={{ color: 'var(--danger)' }}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form
          className="card mt-3 space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            setInvited(null)
            startTransition(async () => {
              const result = await inviteMember(email, role)
              if (result.ok) {
                setInvited(email)
                setEmail('')
                router.refresh()
              } else {
                setError(result.error ?? 'Could not invite.')
              }
            })
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their@email.com"
              className="field flex-1"
              aria-label="Email to invite"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="field w-auto"
              aria-label="Role"
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner</option>
            </select>
            <Button type="submit" disabled={pending || !email.trim()}>
              Invite
            </Button>
          </div>

          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            {ROLE_HELP[role]}
          </p>

          {invited && (
            <p className="text-xs" style={{ color: 'var(--positive)' }}>
              {invited} can now request a sign-in link at the login page.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
