'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { SuggestGroup } from '@/components/ui/SearchBox'
import { nameGroup } from '@/components/ui/SearchRows'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import type { EGO, Identity } from '@/lib/data/sinners'
import type { SupportedLang } from '@/lib/i18n/types'
import { lastWord, replaceLastWord } from '@/lib/search/query'
import { searchNames } from '@/features/catalog/lib/catalog-suggestions'
import { keywordStatEntries, sinnerEgoEntries, sinnerIdentityEntries } from '@/features/catalog/lib/sinner-search'

/** What the old list offered, five rows a group. */
const ROWS = 5

/**
 * The search box of a sinner's page: the hits of the identities and of the E.G.O (null while nothing is typed) for the
 * lists, and the suggestion groups. A name row opens that identity or E.G.O (`open*`); a keyword row, of the keywords
 * of the tab being shown, completes the word being typed.
 */
export function useSinnerSearch({ identities, egos, tab, query, setQuery, openIdentity, openEgo, keywordStats, egoKeywordStats, keywordIcons }: {
  identities: readonly Identity[]
  egos: readonly EGO[]
  tab: 'identities' | 'ego'
  query: string
  setQuery: (query: string) => void
  openIdentity: (identity: Identity) => void
  openEgo: (ego: EGO) => void
  keywordStats: readonly { kw: string; count: number }[]
  egoKeywordStats: readonly { kw: string; count: number }[]
  /** Keyword name -> icon slug */
  keywordIcons: Readonly<Record<string, string | undefined>>
}) {
  const lang = useLocale() as SupportedLang
  const t = useTranslations()
  const identityIndex = useMemo(() => sinnerIdentityEntries(identities, lang), [identities, lang])
  const egoIndex = useMemo(() => sinnerEgoEntries(egos, lang), [egos, lang])
  const keywordIndex = useMemo(
    () => keywordStatEntries(tab === 'ego' ? egoKeywordStats : keywordStats, kw => keywordIcons[kw] ? getKeywordIconUrl(kw, keywordIcons[kw]) ?? undefined : undefined),
    [tab, keywordStats, egoKeywordStats, keywordIcons],
  )
  const found = useMemo(() => query.trim() ? {
    identities: searchNames(identityIndex, query, ROWS),
    egos: searchNames(egoIndex, query, ROWS),
    keywords: searchNames(keywordIndex, lastWord(query), ROWS),
  } : null, [identityIndex, egoIndex, keywordIndex, query])

  const identityById = useMemo(() => new Map(identities.map(identity => [identity.id, identity])), [identities])
  const egoById = useMemo(() => new Map(egos.map(ego => [ego.id, ego])), [egos])
  const groups: SuggestGroup[] = found ? [
    nameGroup(t('sinnerDetail.identity'), found.identities.names, hit => openIdentity(identityById.get(hit.entry.href)!),
      hit => t('browser.rarityStar', { n: identityById.get(hit.entry.href)!.rarity })),
    nameGroup('E.G.O', found.egos.names, hit => openEgo(egoById.get(hit.entry.href)!), hit => egoById.get(hit.entry.href)!.grade),
    nameGroup(t('sinnerDetail.keyword'), found.keywords.names, hit => setQuery(replaceLastWord(query, hit.entry.label)),
      hit => `${hit.entry.sublabel}${t('sinnerDetail.count')}`),
  ].filter(group => group.rows.length > 0) : []
  return { identityHits: found?.identities.hits ?? null, egoHits: found?.egos.hits ?? null, groups }
}
