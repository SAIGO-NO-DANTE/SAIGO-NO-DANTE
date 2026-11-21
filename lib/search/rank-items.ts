import { search, type IndexEntry } from '@/lib/search/engine'

// The engine caches what it folds per entry object, so an item gets its entry once and must not be edited afterwards.
const entries = new WeakMap<object, IndexEntry>()

/**
 * The items a query finds, best match first. `aliases` (and whatever `more` adds) are other names the item is found by,
 * below its label. A pool typed over and over keeps its entries, so each keystroke only matches.
 */
export function rankItems<T extends { label: string; aliases?: string[] }>(items: readonly T[], query: string, more?: (item: T) => string[]): T[] {
  const byEntry = new Map<IndexEntry, T>()
  const pool = items.map(item => {
    let entry = entries.get(item)
    if (!entry) {
      const context = [...(item.aliases ?? []), ...(more?.(item) ?? [])].map(text => ({ field: 'alias' as const, text }))
      // The type only breaks ties between kinds and one pool is one kind.
      entries.set(item, entry = { type: 'page', href: '', label: item.label, names: {}, context })
    }
    byEntry.set(entry, item)
    return entry
  })
  return search(pool, query).map(hit => byEntry.get(hit.entry)!)
}
