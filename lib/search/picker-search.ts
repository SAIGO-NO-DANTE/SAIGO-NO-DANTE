import { search, type Hit, type IndexEntry } from '@/lib/search/engine'
import { keepFound } from '@/lib/search/query'
import { sinnerName, sinnerTexts } from '@/lib/search/sinner-names'
import type { SupportedLang } from '@/lib/i18n/types'
import { getIdentityImageUrl } from '@/lib/utils/images'

// The search of the pickers (windows where an identity or E.G.O is searched, then picked): what to index and what a query finds.

export type PickRow = {
  id: string
  /** The name the card shows */
  label: string
  names: IndexEntry['names']
  /** Only when the picker lists several sinners: the sinner is then searchable and named at the right edge of a row */
  sinner?: string
  icon?: string | null
}

/** The small picture of an identity in a suggestion row (its normal art); none while the row has no art folder. */
export const identityIcon = ({ sinner_id, folder_name, game_id }: { sinner_id: string; folder_name?: string | null; game_id?: string | null }) =>
  folder_name && game_id ? getIdentityImageUrl(sinner_id, folder_name, `${game_id}_normal`) : undefined

/** One entry per row of a picker; an entry's `href` is the row's id. */
export function pickerEntries<T>(type: 'identity' | 'ego', rows: readonly T[], lang: SupportedLang, read: (row: T) => PickRow): IndexEntry[] {
  return rows.map(row => {
    const { id, label, names, sinner, icon } = read(row)
    return {
      type,
      href: id,
      label,
      names,
      icon: icon ?? undefined,
      ...(sinner ? { sublabel: sinnerName(sinner, lang), context: sinnerTexts(sinner).map(text => ({ field: 'sinner' as const, text })) } : {}),
    }
  })
}

/**
 * What a query finds among the `visible` items (the host's filters applied): `list` is the grid, best match first (the
 * items as they came for an empty query); `top` the first six items `pickable` allows, each with its hit, for the suggestion panel; `total` how many it allows in all.
 */
export function pickerFound<T>(entries: IndexEntry[], visible: readonly T[], idOf: (item: T) => string, query: string, pickable: (item: T, hit: Hit) => boolean = () => true) {
  if (!query.trim()) return { list: visible, top: [] as { item: T; hit: Hit }[], total: 0 }
  const hits = search(entries, query)
  const hitOf = new Map(hits.map(hit => [hit.entry.href, hit]))
  const list = keepFound(visible, hits, idOf, false)
  const allowed = list.flatMap(item => pickable(item, hitOf.get(idOf(item))!) ? [{ item, hit: hitOf.get(idOf(item))! }] : [])
  return { list, top: allowed.slice(0, 6), total: allowed.length }
}
