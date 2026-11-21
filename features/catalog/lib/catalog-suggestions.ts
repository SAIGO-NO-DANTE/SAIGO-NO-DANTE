import { search, type ContextField, type Hit, type IndexEntry } from '@/lib/search/engine'
import { sinnerName, sinnerTexts } from '@/lib/search/sinner-names'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getIdentityImageUrl } from '@/lib/utils/images'

// The search boxes of the identity and E.G.O lists: what to index (an entry's `href` is the row's id) and what the panel lists.

type Named = { id: string; sinner_id: string; name?: string | null; name_kr?: string | null; name_en?: string | null; name_jp?: string | null }
type Context = { field: ContextField; text: string }[]

const names = (row: Named) => ({ ko: row.name_kr || row.name || '', en: row.name_en, ja: row.name_jp })
const label = (row: Named, lang: SupportedLang) => getLocalizedName({ name_kr: names(row).ko, name_en: row.name_en, name_jp: row.name_jp }, lang)

/** A sinner's names as search context: "료슈" finds her rows, below the rows named so. */
export const sinnerContext = (sinnerId: string): Context => sinnerTexts(sinnerId).map(text => ({ field: 'sinner', text }))

/** One entry per identity; `sublabel` is its sinner's name and `context` what else finds it. */
export function identityEntries<T extends Named & { folder_name?: string | null; game_id?: string | null }>(rows: readonly T[], lang: SupportedLang, context: (row: T) => Context): IndexEntry[] {
  return rows.map(row => ({
    type: 'identity',
    href: row.id,
    label: label(row, lang),
    sublabel: sinnerName(row.sinner_id, lang),
    icon: row.folder_name && row.game_id ? getIdentityImageUrl(row.sinner_id, row.folder_name, `${row.game_id}_normal`) : undefined,
    names: names(row),
    context: context(row),
  }))
}

/** One entry per E.G.O, as identityEntries makes them. */
export function egoEntries<T extends Named & { image_url?: string | null }>(rows: readonly T[], lang: SupportedLang, context: (row: T) => Context): IndexEntry[] {
  return rows.map(row => ({
    type: 'ego',
    href: row.id,
    label: label(row, lang),
    sublabel: sinnerName(row.sinner_id, lang),
    icon: row.image_url ?? undefined,
    names: names(row),
    context: context(row),
  }))
}

/** Every hit for the list, best first, and the first `cap` of them for the suggestion panel. */
export function searchNames(entries: IndexEntry[], query: string, cap = 6): { hits: Hit[]; names: Hit[] } {
  const hits = search(entries, query)
  return { hits, names: hits.slice(0, cap) }
}
