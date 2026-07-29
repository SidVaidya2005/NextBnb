// Shared classes for the three /admin tables, in one place because both the
// Server Components that render the rows and the Client Components that render
// the controls inside them use these — and a copy in each would be two chances to
// drift. Directive-free module for exactly that reason: neither can import a
// const from the other without dragging its whole module into the wrong graph.
// Same arrangement as `host/hostControlStyles.ts` and `ui/fieldStyles.ts`.
//
// DESIGN.md specs no table, so these are its existing primitives applied to one:
// hairline rules, ink headings, muted secondary text, no fills and no zebra
// striping (the palette has one accent and a table is not where it goes).

/**
 * The horizontal-scroll container every table must sit in.
 *
 * `code-standards.md`'s "grids drop columns, never reflow rows" governs *card
 * grids* — dropping a column there loses a decoration, and dropping one here
 * would lose data an operator is moderating on. So the table keeps every column
 * at every width and scrolls within its own box instead, which also keeps the
 * page body from ever scrolling horizontally.
 */
export const TABLE_SCROLL = '-mx-6 overflow-x-auto px-6 tablet:mx-0 tablet:px-0'

export const TABLE = 'w-full min-w-[44rem] border-collapse text-left text-sm'

export const TABLE_HEAD_CELL =
  'border-b border-hairline pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-muted'

export const TABLE_CELL = 'border-b border-hairline py-4 pr-4 align-top text-body'

/** For the one cell per row that names the thing — the row's own heading. */
export const TABLE_CELL_PRIMARY = 'font-medium text-ink'

/** Numeric columns: tabular figures so prices and counts line up down the column. */
export const TABLE_CELL_NUMERIC = 'tabular-nums whitespace-nowrap'
