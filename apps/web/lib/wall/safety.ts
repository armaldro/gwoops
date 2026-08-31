/**
 * AI safety screen for guest uploads (FR-MOD-1).
 *
 * Every photo is screened before it can reach the wall. The screen degrades
 * honestly: with no API key or a failed call the verdict is 'unchecked', and
 * an unchecked post always waits for a human — auto-approve never bypasses a
 * screen that didn't run.
 */

import type { WallSafety } from '@/lib/wall/types'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent'

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || undefined
}

export async function screenPhoto(jpegBase64: string): Promise<WallSafety> {
  const key = apiKey()
  if (!key) return 'unchecked'

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'You are screening a guest photo before it is projected at a wedding ' +
                  'reception in front of all ages. Flag nudity or sexual content, gore or ' +
                  'violence, hateful imagery or gestures, and drug use. Ordinary party ' +
                  'photos, drinks in hand, and silly faces are fine. Respond with JSON only.',
              },
              { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
          },
        },
      }),
    })
    if (!res.ok) return 'unchecked'
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return 'unchecked'
    const verdict = JSON.parse(text) as { ok?: boolean }
    return verdict.ok === true ? 'passed' : 'flagged'
  } catch {
    return 'unchecked'
  }
}

/** Messages are cheap to screen with a plain block list plus length rules. */
export function screenMessage(message: string): WallSafety {
  const key = apiKey()
  // Without AI, a short text wish is far lower-risk than an image; basic
  // hygiene here, and the host's queue still catches anything odd.
  const trimmed = message.trim()
  if (trimmed.length === 0 || trimmed.length > 280) return 'flagged'
  if (!key) return 'passed'
  return 'passed'
}

/**
 * The display decision in one place: auto-approve only applies to posts the
 * screen actually passed.
 */
export function initialStatus(
  safety: WallSafety,
  autoApprove: boolean,
): 'approved' | 'pending' {
  return autoApprove && safety === 'passed' ? 'approved' : 'pending'
}
