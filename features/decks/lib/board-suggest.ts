import { search, type Hit, type IndexEntry } from '@/lib/search/engine'
import { sinnerName, sinnerTexts } from '@/lib/search/sinner-names'
import { localizeDeckKeyword } from '@/lib/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n/types'
import { getIdentityImageUrl } from '@/lib/utils/images'
import type { IdentityNameEntry } from './filter-params'

// The search boxes of the deck and plan boards: what they index (an identity entry's `href` is its id, a keyword's its Korean
// name) and what the panel lists. Picking enters `names.ko`, the Korean name the boards filter by.

const ROWS = 5

type KeywordNames = { nameEn?: string | null; nameJp?: string | null }

/** One entry per identity (found by its names in three languages and by its sinner's name) and one per keyword. */
export function boardEntries(
  identities: readonly IdentityNameEntry[],
  keywords: { names: readonly string[]; info: Readonly<Record<string, KeywordNames | undefined>>; icon: (keyword: string) => string | null },
  lang: SupportedLang,
): IndexEntry[] {
  return [
    ...identities.map((identity): IndexEntry => ({
      type: 'identity',
      href: identity.id,
      label: identity.name_kr,
      sublabel: sinnerName(identity.sinner_id, lang),
      icon: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal`) : undefined,
      names: { ko: identity.name_kr, en: identity.name_en, ja: identity.name_jp },
      context: sinnerTexts(identity.sinner_id).map(text => ({ field: 'sinner' as const, text })),
    })),
    ...keywords.names.map((keyword): IndexEntry => ({
      type: 'keyword',
      href: keyword,
      label: localizeDeckKeyword(keyword, keywords.info[keyword], lang),
      icon: keywords.icon(keyword) ?? undefined,
      names: { ko: keyword, en: keywords.info[keyword]?.nameEn, ja: keywords.info[keyword]?.nameJp },
    })),
  ]
}

/** The identities and the keywords that complete `term` (the part of the box being typed), best first, five of each. */
export function boardSuggestions(entries: IndexEntry[], term: string): { identities: Hit[]; keywords: Hit[] } {
  const hits = search(entries, term)
  const of = (type: IndexEntry['type']) => hits.filter(hit => hit.entry.type === type).slice(0, ROWS)
  return { identities: of('identity'), keywords: of('keyword') }
}
