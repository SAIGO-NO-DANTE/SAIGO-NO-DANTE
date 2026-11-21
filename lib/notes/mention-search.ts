import { rankItems } from '@/lib/search/rank-items'

// Kept apart from mention.ts: pages that only show a note import that file and must not carry the search engine.

/**
 * Pool entries that match the query in any language, best match first: the label and the other names (`aliases`, the sinner's
 * name among them) by the engine's rules (initials, a typo, no spaces, several words in any order). A bare `@` lists the first ones.
 */
export function filterMentions<T extends { label: string; aliases?: string[] }>(pool: T[], query: string, limit: number): T[] {
  if (!query.trim()) return pool.slice(0, limit)
  return rankItems(pool, query).slice(0, limit)
}
