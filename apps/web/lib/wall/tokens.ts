/**
 * URL-safe random identifiers.
 *
 * The slug and guest token are capability URLs: whoever holds them gets the
 * corresponding access, so they must be unguessable. 62^n with n from
 * crypto-strength bytes; no ambiguous-character pruning because these are
 * scanned or clicked, never typed.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function randomToken(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/** Screen URL key: /w/<slug>. Short enough to read out loud to the AV crew. */
export const newSlug = () => randomToken(10)

/** Printed QR token: /j/<token>. Rotatable without touching the screen URL. */
export const newGuestToken = () => randomToken(12)

/** Per-device guest secret, held in localStorage. Long: it authorises deletes. */
export const newDeviceToken = () => randomToken(28)
