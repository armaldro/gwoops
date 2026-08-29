'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LocationRow } from '@/lib/supabase/types'
import {
  mapWithConcurrency,
  prepareImage,
  readPhotoMetadata,
  type PhotoMetadata,
  type PreparedImage,
} from '@/lib/image'
import { suggestLocation, type LocationSuggestion } from '@/lib/geo'
import { Button } from '@/components/ui/primitives'
import { ReviewSheet, type Draft } from '@/components/capture/review-sheet'
import { LocationPicker } from '@/components/capture/location-picker'

type Mode = 'choose' | 'camera' | 'reviewing'

interface Pending {
  image: PreparedImage
  takenAt: string | null
  exif: { lat: number | null; lng: number | null }
  draft: Draft | null
  duplicates: DuplicateHint[]
  error: string | null
  loading: boolean
}

export interface DuplicateHint {
  id: string
  name: string
  locationId: string | null
  quantity: number
  reasons: string[]
}

export function CaptureStudio({ locations }: { locations: LocationRow[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [queue, setQueue] = useState<Pending[]>([])
  const [index, setIndex] = useState(0)
  const [locationId, setLocationId] = useState<string | null>(
    locations.find((l) => l.is_default)?.id ?? null,
  )
  const [suggestion, setSuggestion] = useState<LocationSuggestion | null>(null)
  const [deviceFix, setDeviceFix] = useState<{ lat: number; lng: number } | null>(null)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  // Ask for a fix as soon as the page opens: by the time the first photo is
  // taken the answer is usually already in hand.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fix = { lat: position.coords.latitude, lng: position.coords.longitude }
        setDeviceFix(fix)
        const result = suggestLocation(
          fix,
          locations.map((l) => ({
            id: l.id,
            name: l.name,
            emoji: l.emoji,
            radius_m: l.radius_m,
            lat: l.lat ?? undefined,
            lng: l.lng ?? undefined,
          })),
        )
        setSuggestion(result)
        if (result.kind === 'confident' || result.kind === 'nearby') {
          setLocationId(result.match.location.id)
        }
      },
      () => setSuggestion({ kind: 'unknown', nearest: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120_000 },
    )
  }, [locations])

  const recognise = useCallback(
    async (image: PreparedImage, forLocationId: string | null) => {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.base64,
          mediaType: image.mediaType,
          locationId: forLocationId,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Recognition failed.')
      return payload as { draft: Draft; duplicates: DuplicateHint[] }
    },
    [],
  )

  const ingest = useCallback(
    async (files: File[], fromGallery: boolean) => {
      if (files.length === 0) return

      const prepared = await Promise.all(
        files.map(async (file) => {
          const [image, meta] = await Promise.all([
            prepareImage(file),
            fromGallery
              ? readPhotoMetadata(file)
              : Promise.resolve<PhotoMetadata>({}),
          ])
          return { image, meta }
        }),
      )

      // A gallery photo's own EXIF beats the device's current position — the
      // phone is in the kitchen; the photo was taken in Bali.
      let effectiveLocation = locationId
      const firstFix = prepared.find((p) => p.meta.lat != null && p.meta.lng != null)
      if (fromGallery && firstFix?.meta.lat != null && firstFix.meta.lng != null) {
        const exifSuggestion = suggestLocation(
          { lat: firstFix.meta.lat, lng: firstFix.meta.lng },
          locations.map((l) => ({
            id: l.id,
            name: l.name,
            emoji: l.emoji,
            radius_m: l.radius_m,
            lat: l.lat ?? undefined,
            lng: l.lng ?? undefined,
          })),
        )
        setSuggestion(exifSuggestion)
        if (exifSuggestion.kind !== 'unknown') {
          effectiveLocation = exifSuggestion.match.location.id
          setLocationId(effectiveLocation)
        } else {
          effectiveLocation = null
          setLocationId(null)
        }
      } else if (fromGallery) {
        // No EXIF and not shot in-app: we genuinely do not know. Ask.
        setSuggestion({ kind: 'unknown', nearest: null })
        effectiveLocation = null
        setLocationId(null)
      }

      setLocationConfirmed(!fromGallery && suggestion?.kind === 'confident')

      const initial: Pending[] = prepared.map(({ image, meta }) => ({
        image,
        takenAt: meta.takenAt ?? null,
        exif: { lat: meta.lat ?? null, lng: meta.lng ?? null },
        draft: null,
        duplicates: [],
        error: null,
        loading: true,
      }))

      setQueue(initial)
      setIndex(0)
      setMode('reviewing')

      // Three at a time: enough to hide latency on a batch, not so many that a
      // twenty-photo import opens twenty model calls at once.
      void mapWithConcurrency(
        initial,
        3,
        async (pending) => recognise(pending.image, effectiveLocation),
        (position, result, error) => {
          setQueue((current) =>
            current.map((entry, i) =>
              i === position
                ? {
                    ...entry,
                    loading: false,
                    draft: result?.draft ?? null,
                    duplicates: result?.duplicates ?? [],
                    error: result
                      ? null
                      : error instanceof Error
                        ? error.message
                        : 'Recognition failed.',
                  }
                : entry,
            ),
          )
        },
      )
    },
    [locationId, locations, recognise, suggestion?.kind],
  )

  function handleSaved() {
    setSavedCount((n) => n + 1)
    if (index + 1 < queue.length) {
      setIndex(index + 1)
    } else {
      setQueue([])
      setIndex(0)
      setMode('choose')
      router.refresh()
    }
  }

  function handleSkipped() {
    if (index + 1 < queue.length) setIndex(index + 1)
    else {
      setQueue([])
      setIndex(0)
      setMode('choose')
    }
  }

  const current = queue[index]

  return (
    <div className="space-y-5">
      <LocationPicker
        locations={locations}
        value={locationId}
        suggestion={suggestion}
        confirmed={locationConfirmed}
        deviceFix={deviceFix}
        onConfirm={() => setLocationConfirmed(true)}
        onChange={(id) => {
          setLocationId(id)
          setLocationConfirmed(true)
        }}
      />

      {mode === 'choose' && (
        <ChooseSource
          onFiles={(files) => void ingest(files, true)}
          onCamera={() => setMode('camera')}
          savedCount={savedCount}
        />
      )}

      {mode === 'camera' && (
        <CameraView
          onCapture={(file) => void ingest([file], false)}
          onCancel={() => setMode('choose')}
        />
      )}

      {mode === 'reviewing' && current && (
        <ReviewSheet
          key={index}
          position={index + 1}
          total={queue.length}
          previewUrl={current.image.dataUrl}
          imageBase64={current.image.base64}
          takenAt={current.takenAt}
          exif={current.exif}
          draft={current.draft}
          duplicates={current.duplicates}
          loading={current.loading}
          error={current.error}
          locations={locations}
          locationId={locationId}
          onLocationChange={setLocationId}
          onSaved={handleSaved}
          onSkip={handleSkipped}
        />
      )}
    </div>
  )
}

function ChooseSource({
  onFiles,
  onCamera,
  savedCount,
}: {
  onFiles: (files: File[]) => void
  onCamera: () => void
  savedCount: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      {savedCount > 0 && (
        <p
          className="rounded-lg px-4 py-2.5 text-sm"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {savedCount} {savedCount === 1 ? 'item' : 'items'} added this session.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCamera}
          className="card flex flex-col items-center gap-2 px-6 py-10 transition hover:-translate-y-0.5"
        >
          <span aria-hidden className="text-4xl">
            📸
          </span>
          <span className="font-display text-lg">Take a photo</span>
          <span className="text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
            Files to the home you&rsquo;re standing in
          </span>
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="card flex flex-col items-center gap-2 px-6 py-10 transition hover:-translate-y-0.5"
        >
          <span aria-hidden className="text-4xl">
            🖼️
          </span>
          <span className="font-display text-lg">Choose from gallery</span>
          <span className="text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
            Pick several at once — we&rsquo;ll ask where they are
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          onFiles(files)
        }}
      />
    </div>
  )
}

function CameraView({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fallbackRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Camera access was refused. You can still pick a photo from your gallery.',
          )
        }
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function shoot() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        streamRef.current?.getTracks().forEach((t) => t.stop())
        onCapture(new File([blob], 'capture.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  if (error) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {error}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => fallbackRef.current?.click()}>Choose a photo</Button>
          <Button variant="secondary" onClick={onCancel}>
            Back
          </Button>
        </div>
        <input
          ref={fallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onCapture(file)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ background: '#000' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
        />
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={shoot}
          aria-label="Take photo"
          className="h-16 w-16 rounded-full border-4 transition active:scale-95"
          style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}
        />
      </div>
    </div>
  )
}
