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

/**
 * Two navigation systems, not three.
 *
 * Folded (and on any phone) the bottom tab bar is the most reachable place for
 * primary actions. Unfolded, the screen is near-square and still handheld — a
 * full-width bar under it wastes the width that unfolding just bought, and a
 * top bar puts navigation at the worst possible reach. A left rail spends the
 * width, keeps every target inside the thumb's arc, and gives the content back
 * its vertical space. It carries up to desktop unchanged.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <div className="min-h-dvh">
      {/* Rail — unfolded, landscape, and desktop */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r py-3 fold:flex"
        style={{
          background: 'var(--surface)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        <Link
          href="/"
          className="mb-4 grid h-10 w-10 place-items-center rounded-xl text-lg"
          style={{ background: 'var(--accent-soft)' }}
          aria-label={BRAND.name}
        >
          <span aria-hidden>🏡</span>
        </Link>

        <div className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} variant="rail">
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1 border-t pt-3">
          <ThemeToggle />
          <Link
            href="/settings"
            className="touch-target grid w-14 justify-center rounded-lg text-lg"
            title={`${session.member.display_name} · ${session.member.role}`}
          >
            <span aria-hidden>{session.member.avatar_emoji}</span>
            <span className="sr-only">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Title bar — folded only; the rail carries the branding above fold: */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-2 backdrop-blur fold:hidden"
        style={{
          background: 'color-mix(in oklab, var(--ground) 88%, transparent)',
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        }}
      >
        <Link href="/" className="touch-target font-display text-lg">
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/settings"
            className="touch-target px-2 text-lg"
            aria-label="Settings"
          >
            <span aria-hidden>{session.member.avatar_emoji}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 fold:pl-24 fold:pr-6 fold:pb-10">
        {children}
      </main>

      {/* Tab bar — folded only */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur fold:hidden"
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
