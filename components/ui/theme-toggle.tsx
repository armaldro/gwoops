'use client'

import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'
const ORDER: Theme[] = ['system', 'light', 'dark']
const LABEL: Record<Theme, string> = { system: '🌗', light: '☀️', dark: '🌙' }

/**
 * Cycles system → light → dark. Preference is a per-device convenience, so
 * localStorage is the right home for it; every access is guarded because
 * private windows and blocked site data both make it throw.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('nest-theme') as Theme | null
      if (stored && ORDER.includes(stored)) {
        setTheme(stored)
        apply(stored)
      }
    } catch {
      // No stored preference available; system default is correct.
    }
  }, [])

  function apply(next: Theme) {
    const root = document.documentElement
    if (next === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', next)
  }

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    setTheme(next)
    apply(next)
    try {
      localStorage.setItem('nest-theme', next)
    } catch {
      // Preference simply will not persist; the toggle still works this session.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="rounded-full px-2 py-1.5 text-sm"
      style={{ color: 'var(--ink-muted)' }}
      title={`Theme: ${theme}`}
    >
      <span aria-hidden>{mounted ? LABEL[theme] : LABEL.system}</span>
      <span className="sr-only">Switch theme (currently {theme})</span>
    </button>
  )
}
