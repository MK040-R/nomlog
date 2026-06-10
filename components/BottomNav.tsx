'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LineChart, User } from 'lucide-react'

const TABS = [
  { href: '/dashboard', label: 'Today', Icon: Home },
  { href: '/analytics', label: 'Insights', Icon: LineChart },
  { href: '/profile', label: 'You', Icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[420px] items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-[0.16em] transition-opacity hover:opacity-70 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.6} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
