import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { requireWallUser } from '@/lib/wall/session'
import { wallAdmin } from '@/lib/wall/db'
import { publicEnv } from '@/lib/env'
import { PrintButton } from '@/components/wall/print-button'
import type { WallEvent } from '@/lib/wall/types'

export const metadata = { title: 'QR posters' }
export const dynamic = 'force-dynamic'

/**
 * Print-ready QR kit (FR-QR). One elegant serif theme for now: an A4 poster
 * and a folded A5 table tent, both from the same design. Error correction H
 * so a wine splash on the print still scans.
 */
export default async function PrintKitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireWallUser()
  const db = wallAdmin()

  const { data } = await db
    .from('wall_events')
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', userId)
    .maybeSingle()
  const event = data as WallEvent | null
  if (!event) notFound()

  const joinUrl = `${publicEnv.siteUrl()}/j/${event.guest_token}`
  const qr = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: 'H',
    margin: 0,
    width: 1024,
    color: { dark: '#2b2620', light: '#ffffff' },
  })

  const date = event.event_date
    ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div style={{ background: '#e9e5dc', minHeight: '100dvh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap"
      />
      <style>{`
        .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fdfcf9; color: #2b2620; }
        .tent-sheet { width: 210mm; min-height: 148mm; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { margin: 0; box-shadow: none !important; page-break-after: always; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between px-4 py-4">
        <a href={`/wall/events/${event.id}`} className="text-sm" style={{ color: '#8a6a3f' }}>
          ← Back to the event
        </a>
        <PrintButton />
      </div>

      {/* A4 poster */}
      <div className="sheet" style={{ boxShadow: '0 10px 40px rgb(0 0 0 / 0.15)', padding: '28mm 22mm', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div className="serif" style={{ fontSize: '15pt', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#8a6a3f' }}>
          Share the moment
        </div>
        <div style={{ width: '38mm', height: '1px', background: '#c9bda6', margin: '10mm 0' }} />
        <h1 className="serif" style={{ fontSize: '38pt', fontWeight: 600, lineHeight: 1.15, margin: 0 }}>
          {event.name}
        </h1>
        {date && (
          <div className="serif" style={{ fontSize: '15pt', fontStyle: 'italic', marginTop: '4mm', color: '#6d6355' }}>
            {date}
            {event.venue ? ` · ${event.venue}` : ''}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code linking to ${joinUrl}`}
          style={{ width: '92mm', height: '92mm', margin: '14mm 0 10mm', border: '1px solid #e2d9c6', borderRadius: '3mm', padding: '6mm', background: '#fff' }}
        />
        <ol className="serif" style={{ fontSize: '16pt', lineHeight: 2, listStyle: 'none', padding: 0, margin: 0 }}>
          <li>1 · Scan with your camera</li>
          <li>2 · Tell us who you are</li>
          <li>3 · Snap away — watch the big screen ✦</li>
        </ol>
        <div style={{ marginTop: 'auto', fontSize: '9pt', color: '#a99e8c', fontFamily: 'system-ui, sans-serif' }}>
          {joinUrl}
        </div>
      </div>

      {/* Table tent: A4 landscape-height sheet, fold along the dashed line. */}
      <div className="sheet tent-sheet" style={{ marginTop: '2rem', boxShadow: '0 10px 40px rgb(0 0 0 / 0.15)', display: 'flex', flexDirection: 'column' }}>
        {[0, 1].map((half) => (
          <div
            key={half}
            style={{
              height: '74mm',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12mm',
              transform: half === 0 ? 'rotate(180deg)' : undefined,
              borderBottom: half === 0 ? '1px dashed #c9bda6' : undefined,
              padding: '0 16mm',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt=""
              style={{ width: '48mm', height: '48mm', border: '1px solid #e2d9c6', borderRadius: '2mm', padding: '3mm', background: '#fff' }}
            />
            <div>
              <div className="serif" style={{ fontSize: '17pt', fontWeight: 600, lineHeight: 1.2 }}>
                {event.name}
              </div>
              <div className="serif" style={{ fontSize: '12.5pt', fontStyle: 'italic', color: '#6d6355', marginTop: '2mm' }}>
                Scan · say hello · share your photos
              </div>
              <div className="serif" style={{ fontSize: '12.5pt', color: '#8a6a3f', marginTop: '1mm' }}>
                They appear on the big screen ✦
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="no-print pb-10 pt-4 text-center text-xs" style={{ color: '#6d6355' }}>
        Page 1: A4 poster. Page 2: table tent — fold along the dashed line so it
        stands on its own.
      </div>
    </div>
  )
}
