import type { Hit, IndexEntry } from '@/lib/search/engine'
import type { KeywordEntry } from './KeywordCard'

// The search box of the keyword list: an entry's `href` is the keyword's name, its `text` the description without markup.

/** One entry per keyword: its name in the page language (and in all three), picture and plain description. */
export function keywordEntries(keywords: readonly KeywordEntry[], name: (keyword: KeywordEntry) => string, plain: (keyword: KeywordEntry) => string, icon: (keyword: KeywordEntry) => string | null): IndexEntry[] {
  return keywords.map(keyword => ({
    type: 'keyword',
    href: keyword.name,
    label: name(keyword),
    icon: icon(keyword) ?? undefined,
    names: { ko: keyword.name, en: keyword.name_en, ja: keyword.name_jp },
    text: plain(keyword) || undefined,
  }))
}

/** Keywords found by name (6) and, apart, those found only in their description (4): a name hit is never listed twice. */
export function keywordRows(hits: readonly Hit[]) {
  return { names: hits.filter(hit => hit.kind !== 'text').slice(0, 6), texts: hits.filter(hit => hit.kind === 'text').slice(0, 4) }
}
