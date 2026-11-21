import type { EGO, Identity } from '@/lib/data/sinners'
import type { Hit } from '@/lib/search/engine'
import { keepFound } from '@/lib/search/query'

export type OwnershipFilter = 'all' | 'owned' | 'unowned'

const getEgoReleaseTime = (ego: EGO) => {
  if (!ego.release_date) return null
  const time = Date.parse(ego.release_date)
  return Number.isNaN(time) ? null : time
}

const compareEgoFallback = (a: EGO, b: EGO) => {
  const aGameId = parseInt(a.game_id ?? '', 10)
  const bGameId = parseInt(b.game_id ?? '', 10)
  if (!Number.isNaN(aGameId) && !Number.isNaN(bGameId) && aGameId !== bGameId) {
    return aGameId - bGameId
  }
  return a.id.localeCompare(b.id)
}

const compareEgosByReleaseDate = (a: EGO, b: EGO, sortOrder: 'newest' | 'oldest') => {
  const aTime = getEgoReleaseTime(a)
  const bTime = getEgoReleaseTime(b)

  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
  }
  if (aTime !== null && bTime === null) return -1
  if (aTime === null && bTime !== null) return 1
  const fallbackOrder = compareEgoFallback(a, b)
  return sortOrder === 'newest' ? -fallbackOrder : fallbackOrder
}

/** How many of the lists hold each keyword, most common first. */
export function countKeywords(lists: Iterable<readonly string[] | null | undefined>) {
  const freq = new Map<string, number>()
  for (const list of lists) {
    for (const kw of list ?? []) freq.set(kw, (freq.get(kw) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kw, count]) => ({ kw, count }))
}

interface SinnerFilter {
  /** What the search found, best first; null when nothing is searched */
  hits: readonly Hit[] | null
  /** The person picked newest or oldest: the list keeps that order instead of the search's */
  sortPicked: boolean
  sortOrder: 'newest' | 'oldest'
  ownershipFilter: OwnershipFilter
  ownedIds: ReadonlySet<string> | null
}

/** 인격 필터링: 등급 → 보유, then by game id; with a search only the identities it found, in its order unless a sort is picked. */
export function filterSinnerIdentities(identities: Identity[], f: SinnerFilter & { rarityFilter: string | null }) {
  const { rarityFilter, hits, sortPicked, sortOrder, ownershipFilter, ownedIds } = f
  let result = identities
  if (rarityFilter) result = result.filter(i => `${i.rarity}성` === rarityFilter)
  if (ownershipFilter !== 'all' && ownedIds) {
    result = result.filter(i =>
      ownershipFilter === 'owned' ? ownedIds.has(i.id) : !ownedIds.has(i.id)
    )
  }
  const sorted = [...result].sort((a, b) => {
    const aId = parseInt(a.game_id ?? '0')
    const bId = parseInt(b.game_id ?? '0')
    return sortOrder === 'newest' ? bId - aId : aId - bId
  })
  return hits ? keepFound(sorted, hits, i => i.id, sortPicked) : sorted
}

/** EGO 필터링: 보유, then by release date; with a search as filterSinnerIdentities does. */
export function filterSinnerEgos(egos: EGO[], f: SinnerFilter) {
  const { hits, sortPicked, sortOrder, ownershipFilter, ownedIds } = f
  let result = egos
  if (ownershipFilter !== 'all' && ownedIds) {
    result = result.filter(e =>
      ownershipFilter === 'owned' ? ownedIds.has(e.id) : !ownedIds.has(e.id)
    )
  }
  const sorted = [...result].sort((a, b) => compareEgosByReleaseDate(a, b, sortOrder))
  return hits ? keepFound(sorted, hits, e => e.id, sortPicked) : sorted
}
