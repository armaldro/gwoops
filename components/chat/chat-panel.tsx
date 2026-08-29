'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/primitives'
import { ToolCard } from '@/components/chat/tool-card'

/** Mirrors the server's StreamEvent, minus the parts the UI does not use. */
type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'done'; messages: unknown[] }
  | { type: 'error'; message: string }

interface Turn {
  role: 'user' | 'assistant'
  text: string
  tools: { name: string; input: unknown }[]
  error?: string
}

export function ChatPanel({
  canWrite,
  homeNames,
  hasItems,
}: {
  canWrite: boolean
  homeNames: string[]
  hasItems: boolean
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // The raw ContentBlock[] history, so tool calls replay on the next turn.
  const historyRef = useRef<unknown[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  async function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || busy) return

    setInput('')
    setBusy(true)
    setTurns((current) => [
      ...current,
      { role: 'user', text: trimmed, tools: [] },
      { role: 'assistant', text: '', tools: [] },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: historyRef.current }),
      })

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'The assistant is unavailable.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // NDJSON: a chunk may split a line, so only parse up to the last newline.
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let event: StreamEvent
          try {
            event = JSON.parse(line) as StreamEvent
          } catch {
            continue
          }
          applyEvent(event)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      setTurns((current) =>
        current.map((turn, i) =>
          i === current.length - 1 ? { ...turn, error: message } : turn,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function applyEvent(event: StreamEvent) {
    setTurns((current) => {
      const last = current.length - 1
      return current.map((turn, i) => {
        if (i !== last) return turn
        switch (event.type) {
          case 'text':
            return { ...turn, text: turn.text + event.text }
          case 'tool':
            return { ...turn, tools: [...turn.tools, { name: event.name, input: event.input }] }
          case 'error':
            return { ...turn, error: event.message }
          default:
            return turn
        }
      })
    })

    if (event.type === 'done') historyRef.current = event.messages
  }

  const suggestions = buildSuggestions(homeNames, canWrite)

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {turns.length === 0 && (
          <div className="card p-5">
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {hasItems
                ? 'Ask anything about what you own and where it lives.'
                : 'Once you have photographed a few things, this is where you plan what goes where.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!hasItems}
                  onClick={() => void ask(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i}>
            {turn.role === 'user' ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                  style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }}
                >
                  {turn.text}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {turn.tools.map((tool, t) => (
                  <ToolCard key={t} name={tool.name} input={tool.input} />
                ))}

                {turn.text && (
                  <div className="card whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">
                    {turn.text}
                  </div>
                )}

                {!turn.text && !turn.error && busy && i === turns.length - 1 && (
                  <div
                    className="animate-pulse-soft px-1 text-sm"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    Thinking…
                  </div>
                )}

                {turn.error && (
                  <div
                    role="alert"
                    className="rounded-lg px-4 py-2.5 text-sm"
                    style={{ background: 'var(--accent-soft)', color: 'var(--danger)' }}
                  >
                    {turn.error}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void ask(input)
        }}
        className="sticky bottom-20 flex gap-2 sm:bottom-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Split my shoes evenly between the houses…"
          className="field shadow-lg"
          disabled={busy}
          aria-label="Ask the assistant"
        />
        <Button type="submit" disabled={busy || !input.trim()} className="shadow-lg">
          {busy ? '…' : 'Ask'}
        </Button>
      </form>

      {!canWrite && (
        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
          Your account is read-only, so the assistant can plan but not save packing lists.
        </p>
      )}
    </div>
  )
}

function buildSuggestions(homeNames: string[], canWrite: boolean): string[] {
  const [first, second] = homeNames
  const suggestions = [
    'Split my shoes evenly between the houses',
    'Where are my running shoes?',
  ]
  if (first) suggestions.push(`What am I missing in ${first}?`)
  if (second) suggestions.push(`What is over-provisioned across ${first} and ${second}?`)
  if (canWrite) suggestions.push('Balance my clothes and make me a packing list')
  return suggestions.slice(0, 4)
}
