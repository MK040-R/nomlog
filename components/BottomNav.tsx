'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LineChart, Sparkles, User } from 'lucide-react'

const TABS = [
  { href: '/dashboard', label: 'Today', Icon: Home },
  { href: '/ask', label: 'Ask', Icon: Sparkles },
  { href: '/analytics', label: 'Insights', Icon: LineChart },
  { href: '/profile', label: 'You', Icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-[420px] items-stretch justify-around pt-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-semibold uppercase tracking-wide transition-opacity hover:opacity-70 ${
                active ? 'text-tomato' : 'text-ink/55'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.4} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
