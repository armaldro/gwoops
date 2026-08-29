import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODEL } from '@/lib/anthropic'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { buildTools } from '@/lib/agent/tools'
import {
  ASSISTANT_SYSTEM_PROMPT,
  buildHouseholdContext,
} from '@/lib/agent/prompt'

export const maxDuration = 300

/**
 * Events pushed to the browser as newline-delimited JSON. Deliberately small:
 * enough for the UI to show text as it arrives and render a card per tool call,
 * without leaking raw API shapes into the client.
 */
type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  /** A packing list was saved; the UI opens it beside the conversation. */
  | { type: 'plan'; planId: string }
  | { type: 'done'; messages: Anthropic.Beta.BetaMessageParam[] }
  | { type: 'error'; message: string }

interface ChatBody {
  message: string
  threadId?: string | null
  /** Prior turns, replayed verbatim so tool calls stay intact. */
  history?: Anthropic.Beta.BetaMessageParam[]
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body: ChatBody
  try {
    body = (await request.json()) as ChatBody
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Empty message.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Filled in by the create_packing_list tool if it runs, then flushed to the
  // client once the turn it happened in completes.
  let createdPlanId: string | null = null
  const tools = buildTools({
    supabase,
    session,
    onPackingListCreated: (id) => {
      createdPlanId = id
    },
  })

  const [{ data: homes }, { data: members }] = await Promise.all([
    supabase.from('locations').select('name, emoji, notes').order('sort_order'),
    supabase.from('household_members').select('display_name'),
  ])

  const context = buildHouseholdContext({
    homes: homes ?? [],
    members: (members ?? []).map((m) => ({ name: m.display_name })),
    currency: 'SGD',
    today: new Date().toISOString().slice(0, 10),
  })

  const history = body.history ?? []
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history,
    {
      role: 'user',
      // The household context rides with the first turn only; on later turns
      // it is already present in the replayed history.
      content: history.length === 0 ? `${context}\n\n${body.message}` : body.message,
    },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        const runner = anthropic().beta.messages.toolRunner({
          model: MODEL,
          max_tokens: 16000,
          stream: true,
          system: [
            {
              type: 'text',
              text: ASSISTANT_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          tools,
          messages,
        })

        for await (const messageStream of runner) {
          messageStream.on('text', (delta) => send({ type: 'text', text: delta }))

          const message = await messageStream.finalMessage()

          for (const block of message.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool', name: block.name, input: block.input })
            }
          }

          if (createdPlanId) {
            send({ type: 'plan', planId: createdPlanId })
            createdPlanId = null
          }

          // A paused turn is not resumed by the runner on its own; push the
          // assistant turn back so the loop continues instead of silently
          // returning a truncated answer.
          if (message.stop_reason === 'pause_turn') {
            runner.pushMessages({ role: 'assistant', content: message.content })
          }
        }

        const finalMessages = runner.params.messages
        send({ type: 'done', messages: finalMessages })

        if (body.threadId) {
          await persistTurn(supabase, session.householdId, body.threadId, finalMessages)
        }
      } catch (error) {
        send({ type: 'error', message: describeError(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

/**
 * Replace the thread's stored messages with the runner's final view. Storing
 * the whole ContentBlock[] rather than plain text is what lets a resumed
 * conversation still carry its tool calls.
 */
async function persistTurn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  threadId: string,
  messages: Anthropic.Beta.BetaMessageParam[],
): Promise<void> {
  await supabase.from('chat_messages').delete().eq('thread_id', threadId)

  const rows = messages.map((message) => ({
    household_id: householdId,
    thread_id: threadId,
    role: message.role as 'user' | 'assistant',
    content: message.content as never,
  }))

  if (rows.length) await supabase.from('chat_messages').insert(rows)

  await supabase
    .from('chat_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', threadId)
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limited — give it a moment and ask again.'
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key is missing or invalid.'
  }
  if (error instanceof Anthropic.APIError) {
    return `The assistant failed (${error.status}). Try rephrasing.`
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
