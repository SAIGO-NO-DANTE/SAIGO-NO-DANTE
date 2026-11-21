import { search, type Hit, type IndexEntry } from '@/lib/search/engine'
import { getLocalizedKeywordName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

type Names = { nameEn?: string | null; nameJp?: string | null }

/** One entry per keyword of the catalog: its name in the page language and in all three, and its icon. An entry's `href` is the keyword's Korean key (what the filter keeps). */
export function keywordFilterEntries(keywords: Readonly<Record<string, Names>>, lang: SupportedLang, iconOf: (keyword: string) => string | null | undefined): IndexEntry[] {
  return Object.entries(keywords).map(([key, info]) => ({
    type: 'keyword',
    href: key,
    label: getLocalizedKeywordName(key, info, lang),
    icon: iconOf(key) ?? undefined,
    names: { ko: key, en: info.nameEn, ja: info.nameJp },
  }))
}

/** The first six keywords a query finds, best first; `added` is a keyword already in the filter (it stays listed, marked). */
export const keywordFilterRows = (entries: IndexEntry[], query: string, selected: ReadonlySet<string>): { keyword: string; hit: Hit; added: boolean }[] =>
  search(entries, query).slice(0, 6).map(hit => ({ keyword: hit.entry.href, hit, added: selected.has(hit.entry.href) }))
