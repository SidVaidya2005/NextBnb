import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { TopNav } from '@/components/navigation/TopNav'
import './globals.css'

// Inter as the Cereal VF substitute (DESIGN.md). Exposed as --font-inter, which
// globals.css maps onto --font-sans so it becomes the base + font-sans stack.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NextBnb — Book unique stays',
  description:
    'Discover, filter, and instantly book short-term stays. Or become a host and list your space.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-canvas text-ink">
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  )
}
