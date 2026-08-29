'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

export interface BinLabel {
  id: string
  name: string
  emoji: string
  slug: string
  itemCount: number
  locationName: string | null
  url: string
}

/**
 * Six labels to an A4 page, sized for a standard 99×93mm label sheet.
 * QR codes are rendered client-side so nothing has to be stored or fetched.
 */
export function LabelSheet({ labels }: { labels: BinLabel[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      labels.map(async (label) => {
        const dataUrl = await QRCode.toDataURL(label.url, {
          margin: 0,
          width: 320,
          errorCorrectionLevel: 'M',
          color: { dark: '#1c1917', light: '#ffffff' },
        })
        return [label.id, dataUrl] as const
      }),
    ).then((entries) => {
      if (!cancelled) setCodes(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [labels])

  if (labels.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl">Nothing to print</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Create a bundle of kind “Storage bin” and it gets a label here.
        </p>
        <Link
          href="/bundles"
          className="mt-6 inline-block rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Back to bundles
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[210mm] p-6 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl">Bin labels</h1>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {labels.length} {labels.length === 1 ? 'label' : 'labels'}. Scanning one opens
            that bin&rsquo;s contents.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/bundles"
            className="rounded-lg border px-3.5 py-2 text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg px-3.5 py-2 text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 print:gap-0">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex h-[93mm] items-center gap-4 border p-4 print:break-inside-avoid"
            style={{ borderColor: '#d5cabb', background: '#fff', color: '#1c1917' }}
          >
            {codes[label.id] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={codes[label.id]} alt="" className="h-28 w-28 shrink-0" />
            ) : (
              <div className="h-28 w-28 shrink-0" style={{ background: '#f2eee8' }} />
            )}

            <div className="min-w-0">
              <div className="font-display text-xl leading-tight">
                <span aria-hidden className="mr-1">{label.emoji}</span>
                {label.name}
              </div>
              {label.locationName && (
                <div className="mt-1 text-sm" style={{ color: '#6f665d' }}>
                  {label.locationName}
                </div>
              )}
              <div className="mt-2 text-sm" style={{ color: '#6f665d' }}>
                {label.itemCount} {label.itemCount === 1 ? 'item' : 'items'}
              </div>
              <div
                className="mt-3 font-mono text-xs tracking-widest"
                style={{ color: '#9c9289' }}
              >
                {label.slug}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
