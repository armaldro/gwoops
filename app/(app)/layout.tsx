import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { BRAND } from '@/lib/brand'
import { NavLink } from '@/components/ui/nav-link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const NAV = [
  { href: '/', label: 'Home', icon: '🏡' },
  { href: '/inventory', label: 'Inventory', icon: '🗄️' },
  { href: '/capture', label: 'Add', icon: '📸' },
  { href: '/chat', label: 'Ask', icon: '💬' },
  { href: '/packing', label: 'Packing', icon: '🧳' },
] as const

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <div className="min-h-dvh">
      {/* Desktop / tablet top bar */}
      <header
        className="sticky top-0 z-30 hidden border-b backdrop-blur sm:block"
        style={{ background: 'color-mix(in oklab, var(--ground) 88%, transparent)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3">
          <Link href="/" className="mr-4 font-display text-lg">
            {BRAND.name}
          </Link>
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/settings"
              className="rounded-full px-2.5 py-1.5 text-sm"
              style={{ color: 'var(--ink-muted)' }}
              title={`${session.member.display_name} · ${session.member.role}`}
            >
              <span aria-hidden>{session.member.avatar_emoji}</span>
              <span className="sr-only">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile title bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur sm:hidden"
        style={{ background: 'color-mix(in oklab, var(--ground) 88%, transparent)' }}
      >
        <Link href="/" className="font-display text-lg">
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/settings" className="px-2 py-1 text-lg" aria-label="Settings">
            <span aria-hidden>{session.member.avatar_emoji}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:pb-10">
        {children}
      </main>

      {/* Mobile tab bar — primary actions within thumb reach */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur sm:hidden"
        style={{
          background: 'color-mix(in oklab, var(--ground) 94%, transparent)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} variant="tab">
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
