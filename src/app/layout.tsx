import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Footer } from '@/components/navigation/Footer'
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
      {/* `flex flex-col` + `flex-1` on <main> is what keeps the footer at the
          bottom of a short page (an empty /messages or /favorites) instead of
          floating mid-viewport above dead white space. The sticky header still
          sticks: its containing block is <body>, which is not a scroll
          container. */}
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        {/* Skip link — first focusable element in the document, so a keyboard
            user can bypass the nav on all 16 routes. Inline rather than a
            component on purpose: the `href` here and the `id` on <main> below
            are two halves of one contract, and splitting them across files is
            how one gets edited without the other.

            `tabIndex={-1}` on <main> is load-bearing, not decoration. Without
            it, activating this link scrolls the viewport and leaves focus where
            it was — the page looks like it jumped while the keyboard user is
            still in the nav. */}
        {/* `z-[60]` is deliberate and must outrank the header's `z-50`: revealed
            at top-4 the link sits inside the sticky header's 80px band, so a
            lower z-index paints it underneath — visible to a geometry check and
            unclickable at the same time. Not an arbitrary value to tidy away. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:border focus:border-hairline focus:bg-canvas focus:px-4 focus:py-3.5 focus:text-sm focus:font-medium focus:text-ink focus:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Skip to content
        </a>
        <TopNav />
        {/* `focus:outline-none` — measured, not assumed. Chrome's `getComputedStyle`
            painted a focus ring on <main> (`outlineStyle: "auto"`, `outlineWidth:
            "1px"`) when it was reached by activating the skip link from the
            keyboard — focus followed an Enter keypress, so the last input was a
            keyboard one. The skip link itself already carries the project's
            one focus treatment
            (`focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-ink`), so <main> gaining a second, unstyled
            ring on arrival is redundant rather than useful. */}
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
