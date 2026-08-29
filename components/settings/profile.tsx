'use client'

import { useState, useTransition } from 'react'
import { signOut, updateProfile } from '@/lib/actions/settings'
import { Button } from '@/components/ui/primitives'
import type { MemberRole } from '@/lib/supabase/types'

const EMOJI_CHOICES = ['🙂', '🌿', '🐦', '🦊', '🌙', '☕️', '🎧', '🪴']

export function ProfileSettings({
  displayName,
  avatarEmoji,
  email,
  role,
}: {
  displayName: string
  avatarEmoji: string
  email: string
  role: MemberRole
}) {
  const [name, setName] = useState(displayName)
  const [emoji, setEmoji] = useState(avatarEmoji)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <section>
      <h2 className="mb-3 font-display text-lg">You</h2>
      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label htmlFor="display-name" className="text-xs font-medium">
              Name
            </label>
            <input
              id="display-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
              className="field mt-1"
            />
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateProfile({ displayName: name, avatarEmoji: emoji })
                setSaved(true)
              })
            }
          >
            {pending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        </div>

        <div>
          <span className="text-xs font-medium">Avatar</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  setEmoji(choice)
                  setSaved(false)
                }}
                aria-pressed={emoji === choice}
                className="rounded-lg border px-2 py-1 text-lg"
                style={{
                  borderColor: emoji === choice ? 'var(--accent)' : 'var(--border)',
                  background: emoji === choice ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <span aria-hidden>{choice}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"
          style={{ color: 'var(--ink-muted)' }}
        >
          <span>
            {email} · {role}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}
