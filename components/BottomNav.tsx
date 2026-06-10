'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard', label: 'Today', icon: '🍽️' },
  { href: '/analytics', label: 'Insights', icon: '📈' },
  { href: '/profile', label: 'You', icon: '👤' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border-subtle bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                active ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <span className={`text-lg transition ${active ? 'scale-110' : ''}`}>{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
