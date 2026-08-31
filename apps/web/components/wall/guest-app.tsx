'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { prepareImage } from '@/lib/image'

interface EventMeta {
  name: string
  date: string | null
  venue: string | null
}

interface MyPost {
  id: string
  kind: 'photo' | 'message'
  photoUrl: string | null
  message: string | null
  status: 'pending' | 'approved'
}

interface QueueItem {
  key: string
  preview: string
  state: 'uploading' | 'failed'
  file?: Blob
  caption: string
}

/** Photos on a 4K wall deserve more pixels than Nest's vision pipeline needs. */
const WALL_MAX_EDGE = 2048

export function GuestApp({ token }: { token: string }) {
  const storageKey = useCallback((k: string) => `wall:${token}:${k}`, [token])

  const [deviceToken, setDeviceToken] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [event, setEvent] = useState<EventMeta | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [mine, setMine] = useState<MyPost[]>([])
  const [caption, setCaption] = useState('')
  const [wish, setWish] = useState('')
  const [sendingWish, setSendingWish] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  // Restore a previous join on this phone.
  useEffect(() => {
    try {
      const dt = localStorage.getItem(storageKey('device'))
      const nm = localStorage.getItem(storageKey('name'))
      const ev = localStorage.getItem(storageKey('event'))
      if (dt && nm) {
        setDeviceToken(dt)
        setName(nm)
        if (ev) setEvent(JSON.parse(ev))
      }
    } catch {
      // Private mode etc. — the guest just joins again.
    }
  }, [storageKey])

  const refreshMine = useCallback(async (dt: string) => {
    try {
      const res = await fetch(
        `/api/wall/mine?token=${encodeURIComponent(token)}&deviceToken=${encodeURIComponent(dt)}`,
      )
      if (!res.ok) return
      const body = await res.json()
      setMine(body.posts ?? [])
    } catch {
      // Transient; the next refresh will catch up.
    }
  }, [token])

  useEffect(() => {
    if (deviceToken) void refreshMine(deviceToken)
  }, [deviceToken, refreshMine])

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setJoining(true)
    setError(null)
    try {
      const res = await fetch('/api/wall/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, name: trimmed, deviceToken }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Could not join.')
        return
      }
      setDeviceToken(body.deviceToken)
      setEvent(body.event)
      setEditingName(false)
      try {
        localStorage.setItem(storageKey('device'), body.deviceToken)
        localStorage.setItem(storageKey('name'), trimmed)
        localStorage.setItem(storageKey('event'), JSON.stringify(body.event))
      } catch {
        // Fine — they'll re-enter the name next visit.
      }
    } catch {
      setError('No connection — try again in a moment.')
    } finally {
      setJoining(false)
    }
  }

  async function uploadOne(item: QueueItem, dt: string) {
    if (!item.file) return
    try {
      const prepared = await prepareImage(item.file, WALL_MAX_EDGE)
      const res = await fetch('/api/wall/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceToken: dt,
          kind: 'photo',
          message: item.caption || undefined,
          photoBase64: prepared.base64,
        }),
      })
      if (!res.ok) throw new Error()
      setQueue((q) => q.filter((x) => x.key !== item.key))
      void refreshMine(dt)
    } catch {
      setQueue((q) =>
        q.map((x) => (x.key === item.key ? { ...x, state: 'failed' } : x)),
      )
    }
  }

  function onFiles(files: FileList | null) {
    if (!files || !deviceToken) return
    const currentCaption = caption.trim()
    setCaption('')
    for (const file of Array.from(files).slice(0, 10)) {
      const item: QueueItem = {
        key: crypto.randomUUID(),
        preview: URL.createObjectURL(file),
        state: 'uploading',
        file,
        caption: currentCaption,
      }
      setQueue((q) => [...q, item])
      void uploadOne(item, deviceToken)
    }
  }

  async function sendWish(e: React.FormEvent) {
    e.preventDefault()
    if (!wish.trim() || !deviceToken) return
    setSendingWish(true)
    try {
      const res = await fetch('/api/wall/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceToken,
          kind: 'message',
          message: wish.trim(),
        }),
      })
      if (res.ok) {
        setWish('')
        void refreshMine(deviceToken)
      } else {
        const body = await res.json()
        setError(body.error ?? 'Could not send.')
      }
    } catch {
      setError('No connection — try again in a moment.')
    } finally {
      setSendingWish(false)
    }
  }

  async function deletePost(id: string) {
    if (!deviceToken) return
    setMine((m) => m.filter((p) => p.id !== id))
    await fetch(
      `/api/wall/post/${id}?token=${encodeURIComponent(token)}&deviceToken=${encodeURIComponent(deviceToken)}`,
      { method: 'DELETE' },
    ).catch(() => refreshMine(deviceToken))
  }

  // --- Join screen ---------------------------------------------------------
  if (!deviceToken || editingName || !event) {
    return (
      <main className="min-h-dvh grid place-items-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div
              aria-hidden
              className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-2xl"
              style={{ background: 'var(--accent-soft)' }}
            >
              💐
            </div>
            <h1 className="font-display text-2xl">
              {event ? event.name : 'Welcome to the celebration'}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Share your photos and wishes — they appear on the big screen.
            </p>
          </div>
          <form onSubmit={join} className="card p-6">
            <label htmlFor="guest-name" className="block text-sm font-medium">
              What&rsquo;s your name?
            </label>
            <input
              id="guest-name"
              className="field mt-2"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aunty Mei, Table 7 Jon…"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={joining}
              className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {joining ? 'One moment…' : "I'm here! 🎉"}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // --- Main guest screen ---------------------------------------------------
  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-16">
      <header className="mb-5 text-center">
        <h1 className="font-display text-2xl">{event.name}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Posting as <strong>{name}</strong>{' '}
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="underline underline-offset-4"
            style={{ color: 'var(--accent)' }}
          >
            change
          </button>
        </p>
      </header>

      <div className="card p-4">
        <input
          className="field"
          placeholder="Say something with your photo (optional)"
          maxLength={280}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="rounded-lg px-4 py-3 text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            📸 Take a photo
          </button>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="rounded-lg border px-4 py-3 text-sm font-medium"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            🖼️ From gallery
          </button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <form onSubmit={sendWish} className="card mt-4 p-4">
        <label htmlFor="wish" className="block text-sm font-medium">
          Or leave a written wish 💌
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="wish"
            className="field"
            maxLength={280}
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="To the happy couple…"
          />
          <button
            type="submit"
            disabled={sendingWish || !wish.trim()}
            className="shrink-0 rounded-lg px-4 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            Send
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {queue.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-medium">Uploading…</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {queue.map((item) => (
              <div key={item.key} className="relative overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className={`aspect-square w-full object-cover ${item.state === 'uploading' ? 'animate-pulse-soft' : 'opacity-50'}`}
                />
                {item.state === 'failed' && deviceToken && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueue((q) =>
                        q.map((x) =>
                          x.key === item.key ? { ...x, state: 'uploading' } : x,
                        ),
                      )
                      void uploadOne({ ...item, state: 'uploading' }, deviceToken)
                    }}
                    className="absolute inset-0 grid place-items-center text-xs font-medium text-white"
                    style={{ background: 'rgb(0 0 0 / 0.55)' }}
                  >
                    Tap to retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium">Your posts</h2>
          <div className="mt-2 flex flex-col gap-2">
            {mine.map((post) => (
              <div key={post.id} className="card flex items-center gap-3 p-2 pr-3">
                {post.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.photoUrl}
                    alt=""
                    className="h-14 w-14 rounded-md object-cover"
                  />
                ) : (
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-md text-xl"
                    style={{ background: 'var(--accent-soft)' }}
                  >
                    💌
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {post.message && (
                    <p className="truncate text-sm">{post.message}</p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {post.status === 'approved'
                      ? 'On the wall ✨'
                      : 'Waiting for the hosts'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deletePost(post.id)}
                  className="touch-target-sm text-sm"
                  style={{ color: 'var(--ink-faint)' }}
                  aria-label="Delete this post"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        Photos you share here are seen by the couple and their guests, and the
        couple keeps them after tonight. Delete any of yours at any time.
      </p>
    </main>
  )
}
