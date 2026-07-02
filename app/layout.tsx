import type { Metadata, Viewport } from 'next'
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Display serif — bold headings + brand wordmark (Black for the playful look)
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-display',
  display: 'swap',
})

// Body / labels / controls
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
})

// Numbers — tabular mono
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NomLog',
  description: 'Know what you ate. See how it adds up.',
  // When added to the iOS home screen, open as a standalone app
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'NomLog' },
  icons: { apple: '/apple-touch-icon.png', icon: '/icon.svg' },
}

export const viewport: Viewport = {
  // Extend under the iPhone status bar / home indicator so safe-area insets work
  viewportFit: 'cover',
  themeColor: '#F8F1E2',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
