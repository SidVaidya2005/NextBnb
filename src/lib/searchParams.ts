/**
 * Helpers for editing the search URL.
 *
 * The URL is the source of truth for search state, so every control edits the
 * *existing* params rather than rebuilding them: the search bar must not drop
 * the filter panel's selections, and the filter panel must not drop the search
 * bar's. Both go through here.
 */

/** Set a param, or remove it entirely when the value is empty. */
export function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
): void {
  const next = value === null || value === undefined ? '' : String(value).trim()

  if (next === '') {
    params.delete(key)
    return
  }
  params.set(key, next)
}

/** `/?a=1&b=2`, or plain `/` when nothing is set — no bare trailing `?`. */
export function homeHref(params: URLSearchParams): string {
  const query = params.toString()
  return query ? `/?${query}` : '/'
}
