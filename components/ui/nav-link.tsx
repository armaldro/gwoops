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
  variant?: 'pill' | 'tab' | 'rail'
}) {
  const pathname = usePathname()
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
  const tone = active ? 'var(--accent)' : 'var(--ink-muted)'

  if (variant === 'tab') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]"
        style={{ color: tone }}
      >
        <span aria-hidden className="text-lg leading-none">
          {icon}
        </span>
        {children}
      </Link>
    )
  }

  if (variant === 'rail') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className="flex min-h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition"
        style={{
          background: active ? 'var(--accent-soft)' : 'transparent',
          color: tone,
        }}
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
      className="touch-target rounded-full px-3 text-sm font-medium transition"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: tone,
      }}
    >
      <span aria-hidden className="mr-1.5">
        {icon}
      </span>
      {children}
    </Link>
  )
}
