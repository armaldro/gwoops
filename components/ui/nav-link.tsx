'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({
  href,
  icon,
  children,
  variant = 'pill',
}: {
  href: string
  icon: string
  children: React.ReactNode
  variant?: 'pill' | 'tab'
}) {
  const pathname = usePathname()
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href)

  if (variant === 'tab') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center gap-0.5 py-2 text-[11px]"
        style={{ color: active ? 'var(--accent)' : 'var(--ink-muted)' }}
      >
        <span aria-hidden className="text-lg leading-none">
          {icon}
        </span>
        {children}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="rounded-full px-3 py-1.5 text-sm font-medium transition"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--ink-muted)',
      }}
    >
      <span aria-hidden className="mr-1.5">
        {icon}
      </span>
      {children}
    </Link>
  )
}
