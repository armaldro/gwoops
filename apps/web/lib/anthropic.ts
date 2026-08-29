import Anthropic from '@anthropic-ai/sdk'
import { serverEnv } from '@/lib/env'

/** Every Claude call in this app goes through this model. */
export const MODEL = 'claude-opus-5'

let client: Anthropic | null = null

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: serverEnv.anthropicKey() })
  }
  return client
}
