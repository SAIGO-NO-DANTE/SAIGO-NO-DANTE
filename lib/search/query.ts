import type { Hit } from '@/lib/search/engine'

/** The last word of the query: what a keyword suggestion completes. */
export const lastWord = (query: string) => query.trim().split(/\s+/).pop() ?? ''

/** The query with its last word replaced, as picking a keyword suggestion does. */
export const replaceLastWord = (query: string, word: string) => [...query.trim().split(/\s+/).slice(0, -1), word].join(' ')

/**
 * The items a search found (an item's key is its entry's `href`), best match first, or in the order they came in when
 * `keepOrder`: a list the person sorted by hand keeps that sort.
 */
export function keepFound<T>(items: readonly T[], hits: readonly Hit[], keyOf: (item: T) => string, keepOrder: boolean): T[] {
  const rank = new Map(hits.map((hit, i) => [hit.entry.href, i]))
  const found = items.filter(item => rank.has(keyOf(item)))
  return keepOrder ? found : found.sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!)
}
