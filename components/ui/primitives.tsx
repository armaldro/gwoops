import Link from 'next/link'
import { locationColorVar } from '@/lib/colors'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  )
}

export function LocationChip({
  name,
  emoji,
  color,
  href,
  size = 'md',
}: {
  name: string
  emoji?: string
  color?: string | null
  href?: string
  size?: 'sm' | 'md'
}) {
  const tone = locationColorVar(color)
  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ borderColor: tone, color: tone }}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {name}
    </span>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <div aria-hidden className="mb-3 text-4xl opacity-70">
        {icon}
      </div>
      <h2 className="font-display text-lg">{title}</h2>
      <p
        className="mt-2 max-w-xs text-sm leading-relaxed"
        style={{ color: 'var(--ink-muted)' }}
      >
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>
        {label}
      </div>
      <div className="tabular mt-1 font-display text-2xl">{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'var(--accent-ink)' },
    secondary: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--border-strong)',
    },
    ghost: { background: 'transparent', color: 'var(--ink-muted)' },
    danger: {
      background: 'transparent',
      color: 'var(--danger)',
      border: '1px solid var(--danger)',
    },
  }
  return (
    <button
      {...props}
      style={{ ...styles[variant], ...props.style }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${className}`}
    />
  )
}

export function LinkButton({
  href,
  variant = 'primary',
  className = '',
  children,
}: {
  href: string
  variant?: 'primary' | 'secondary'
  className?: string
  children: React.ReactNode
}) {
  const style =
    variant === 'primary'
      ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
      : {
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--border-strong)',
        }
  return (
    <Link
      href={href}
      style={style}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${className}`}
    >
      {children}
    </Link>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse-soft rounded-lg ${className}`}
      style={{ background: 'var(--surface-sunk)' }}
    />
  )
}
