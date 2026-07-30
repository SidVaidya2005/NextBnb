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
        {/* Skip link — first focusable element in the document, so a keyboard
            user can bypass the nav on all 16 routes. Inline rather than a
            component on purpose: the `href` here and the `id` on <main> below
            are two halves of one contract, and splitting them across files is
            how one gets edited without the other.

            `tabIndex={-1}` on <main> is load-bearing, not decoration. Without
            it, activating this link scrolls the viewport and leaves focus where
            it was — the page looks like it jumped while the keyboard user is
            still in the nav. */}
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <TopNav />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  )
}
