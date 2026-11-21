'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import type { SuggestGroup } from '@/components/ui/SearchBox'
import type { Hit } from '@/lib/search/engine'
import { nameGroup } from '@/components/ui/SearchRows'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import type { SupportedLang } from '@/lib/i18n/types'
import { boardEntries, boardSuggestions } from '../lib/board-suggest'
import type { IdentityNameEntry } from '../lib/filter-params'

const NO_IDENTITIES: IdentityNameEntry[] = []

/**
 * The suggestion groups of a board's search box for `term`, the part of the box being typed: identities (a board that offers
 * them gives their `identities` and a title) and keywords. Picking a row hands the Korean name to `pick`, which puts it
 * into the box.
 */
export function useBoardSuggest({ term, pick, titles, identities = NO_IDENTITIES }: {
  term: string
  pick: (name: string) => void
  titles: { identity?: string; keyword: string }
  identities?: readonly IdentityNameEntry[]
}): SuggestGroup[] {
  const lang = useLocale() as SupportedLang
  const { iconMap, getIconUrl } = useKeywordData()
  const info = useKeywords()
  const entries = useMemo(
    () => boardEntries(identities, { names: Object.keys(iconMap), info, icon: getIconUrl }, lang),
    [identities, iconMap, info, getIconUrl, lang],
  )
  const found = useMemo(() => boardSuggestions(entries, term), [entries, term])
  const enter = (hit: Hit) => pick(hit.entry.names.ko!)
  const groups = [nameGroup(titles.keyword, found.keywords, enter)]
  if (titles.identity) groups.unshift(nameGroup(titles.identity, found.identities, enter))
  return groups.filter(group => group.rows.length > 0)
}
