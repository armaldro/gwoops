'use client'

/**
 * The 16:9 wall (FR-WALL).
 *
 * Design decisions with reasons:
 * - Polls rather than holding a socket: on hotel AV Wi-Fi a poll loop with
 *   backoff recovers from anything, and 2.5s is inside the 3s budget.
 * - Never shows an error: on failure it keeps rendering what it has and
 *   quietly retries. The failure mode of a wedding wall is a blank screen,
 *   so every path renders something.
 * - DOM is bounded: at most GRID_LIMIT cards mounted, whatever the night's
 *   volume, so a six-hour run cannot leak its way to a crash.
 * - Dark ground: a projector in a dim ballroom should never blast white.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface Card {
  id: string
  kind: 'photo' | 'message'
  photoUrl: string | null
  message: string | null
  guestName: string
  createdAt: string
}

interface Feed {
  event: {
    name: string
    date: string | null
    venue: string | null
    status: string
    showQr: boolean
  }
  joinUrl: string
  cards: Card[]
}

const POLL_MS = 2500
const MAX_BACKOFF_MS = 15000
const GRID_LIMIT = 24
const SPOTLIGHT_MS = 6000
const MEMORY_MS = 25000

export function WallScreen({ slug }: { slug: string }) {
  const feedRef = useRef<Feed | null>(null)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [spotlight, setSpotlight] = useState<Card | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const seenIds = useRef<Set<string>>(new Set())
  const spotlightQueue = useRef<Card[]>([])
  const spotlightUntil = useRef(0)
  const lastNewCardAt = useRef(Date.now())
  const backoff = useRef(POLL_MS)

  const applyFeed = useCallback((next: Feed) => {
    setFeed(next)
    const fresh = next.cards.filter((c) => !seenIds.current.has(c.id))
    const firstLoad = seenIds.current.size === 0
    for (const c of next.cards) seenIds.current.add(c.id)
    if (!firstLoad && fresh.length > 0) {
      lastNewCardAt.current = Date.now()
      // Oldest of the fresh batch first, so a burst plays in order.
      spotlightQueue.current.push(...[...fresh].reverse())
    }
  }, [])

  // Poll loop with backoff; a failure never clears the current render.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      try {
        const res = await fetch(`/api/wall/feed?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const body = (await res.json()) as Feed
          if (!cancelled) applyFeed(body)
          backoff.current = POLL_MS
        } else {
          backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS)
        }
      } catch {
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS)
      }
      if (!cancelled) timer = setTimeout(tick, backoff.current)
    }

    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slug, applyFeed])

  // Spotlight scheduler: fresh cards first; otherwise, when the room goes
  // quiet, resurface a random memory.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (now < spotlightUntil.current) return
      const next = spotlightQueue.current.shift()
      if (next) {
        setSpotlight(next)
        spotlightUntil.current = now + SPOTLIGHT_MS
        return
      }
      if (spotlight) {
        setSpotlight(null)
        spotlightUntil.current = now + 1500
        return
      }
      const cards = feedRef.current?.cards ?? []
      if (cards.length > 3 && now - lastNewCardAt.current > MEMORY_MS) {
        const pick = cards[Math.floor(Math.random() * cards.length)]
        setSpotlight(pick)
        spotlightUntil.current = now + SPOTLIGHT_MS
        lastNewCardAt.current = now - MEMORY_MS + 12000 // next memory in ~12s
      }
    }, 500)
    return () => clearInterval(interval)
  }, [spotlight])

  useEffect(() => {
    feedRef.current = feed
  }, [feed])

  // QR for the corner and the empty state.
  useEffect(() => {
    if (!feed?.joinUrl) return
    let cancelled = false
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(feed.joinUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
        color: { dark: '#1c1917', light: '#faf8f5' },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [feed?.joinUrl])

  const cards = (feed?.cards ?? []).slice(0, GRID_LIMIT)
  const hasCards = cards.length > 0

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 120% at 50% 0%, #211d19 0%, #171412 55%, #100e0c 100%)',
        color: '#f4f0ea',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Empty state: the wall invites (FR-WALL-6). */}
      {!hasCards && feed && (
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <div className="font-display text-6xl" style={{ letterSpacing: '-0.01em' }}>
              {feed.event.name}
            </div>
            {feed.event.date && (
              <div className="mt-3 text-xl" style={{ color: '#c7bfb4' }}>
                {formatDate(feed.event.date)}
                {feed.event.venue ? ` · ${feed.event.venue}` : ''}
              </div>
            )}
            {qrDataUrl && (
              <div className="mx-auto mt-10 w-fit rounded-2xl bg-white p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Scan to share your photos" className="h-64 w-64" />
              </div>
            )}
            <div className="mt-8 text-2xl" style={{ color: '#e5ddd1' }}>
              Scan · say who you are · share your photos
            </div>
            <div className="mt-2 text-lg" style={{ color: '#8f867b' }}>
              They&rsquo;ll appear right here.
            </div>
          </div>
        </div>
      )}

      {/* The wall itself. */}
      {hasCards && feed && (
        <div className="flex h-full">
          <aside
            className="flex w-[24%] min-w-[280px] flex-col justify-between p-10"
            style={{ borderRight: '1px solid rgb(244 240 234 / 0.08)' }}
          >
            <div>
              <div className="font-display text-4xl leading-tight">{feed.event.name}</div>
              {feed.event.date && (
                <div className="mt-2 text-base" style={{ color: '#c7bfb4' }}>
                  {formatDate(feed.event.date)}
                </div>
              )}
            </div>
            {feed.event.showQr && qrDataUrl && (
              <div>
                <div className="w-fit rounded-xl bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Scan to share your photos" className="h-40 w-40" />
                </div>
                <div className="mt-3 text-sm" style={{ color: '#c7bfb4' }}>
                  Scan to add your photos ✨
                </div>
              </div>
            )}
            <div className="text-sm" style={{ color: '#8f867b' }}>
              {feed.cards.length} memor{feed.cards.length === 1 ? 'y' : 'ies'} and counting
            </div>
          </aside>

          <div className="flex-1 overflow-hidden p-6">
            <div style={{ columns: 4, columnGap: '1rem' }}>
              {cards.map((card) => (
                <WallCardView key={card.id} card={card} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spotlight: the newest arrival, big. */}
      {spotlight && (
        <div
          className="absolute inset-0 grid place-items-center animate-sheet-in"
          style={{ background: 'rgb(16 14 12 / 0.82)' }}
        >
          <figure
            className="max-w-[62%] rounded-2xl p-5 pb-4"
            style={{ background: '#faf8f5', color: '#1c1917', boxShadow: '0 40px 120px -20px rgb(0 0 0 / 0.8)' }}
          >
            {spotlight.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={spotlight.photoUrl}
                alt=""
                className="max-h-[62vh] w-full rounded-lg object-contain"
              />
            )}
            {spotlight.kind === 'message' && (
              <blockquote className="max-w-2xl px-6 py-10 text-center font-display text-4xl leading-snug">
                &ldquo;{spotlight.message}&rdquo;
              </blockquote>
            )}
            <figcaption className="mt-3 flex items-baseline justify-between gap-6 px-1">
              <span className="font-display text-2xl">{spotlight.guestName}</span>
              {spotlight.kind === 'photo' && spotlight.message && (
                <span className="truncate text-lg" style={{ color: '#6f665d' }}>
                  {spotlight.message}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}

      {/* First load, before anything is known: a calm mark, never an error. */}
      {!feed && (
        <div className="grid h-full place-items-center">
          <div className="animate-pulse-soft font-display text-3xl" style={{ color: '#8f867b' }}>
            ✦
          </div>
        </div>
      )}
    </div>
  )
}

function WallCardView({ card }: { card: Card }) {
  return (
    <figure
      className="mb-4 break-inside-avoid rounded-xl p-3"
      style={{ background: '#faf8f5', color: '#1c1917' }}
    >
      {card.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photoUrl} alt="" className="w-full rounded-md" loading="lazy" />
      )}
      {card.kind === 'message' && (
        <blockquote className="px-2 pt-3 text-center font-display text-lg leading-snug">
          &ldquo;{card.message}&rdquo;
        </blockquote>
      )}
      <figcaption className="mt-2 px-1 pb-1">
        <div className="font-display text-base">{card.guestName}</div>
        {card.kind === 'photo' && card.message && (
          <div className="truncate text-xs" style={{ color: '#6f665d' }}>
            {card.message}
          </div>
        )}
      </figcaption>
    </figure>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
