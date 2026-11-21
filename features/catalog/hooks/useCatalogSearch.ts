'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { SuggestGroup } from '@/components/ui/SearchBox'
import { nameGroup } from '@/components/ui/SearchRows'
import type { SupportedLang } from '@/lib/i18n/types'
import { keepFound } from '@/lib/search/query'
import { egoEntries, identityEntries, searchNames, sinnerContext } from '@/features/catalog/lib/catalog-suggestions'

type Row = {
  id: string
  sinner_id: string
  name?: string | null
  name_kr?: string | null
  name_en?: string | null
  name_jp?: string | null
  folder_name?: string | null
  game_id?: string | null
  image_url?: string | null
}

/**
 * The search box of the identity or E.G.O list. `all` is what the box searches, `visible` what the list shows under its
 * other filters and sort: with a query the list keeps the rows found, best match first unless `keepOrder` (a sort was
 * picked). `open` is what clicking the row's card does.
 */
export function useCatalogSearch<T extends Row>(kind: 'identity' | 'ego', all: readonly T[], visible: readonly T[], query: string, keepOrder: boolean, open: (row: T) => void) {
  const lang = useLocale() as SupportedLang
  const identityTitle = useTranslations('sinners')('identities')
  const entries = useMemo(
    () => kind === 'ego' ? egoEntries(all, lang, row => sinnerContext(row.sinner_id)) : identityEntries(all, lang, row => sinnerContext(row.sinner_id)),
    [kind, all, lang],
  )
  const found = useMemo(() => query.trim() ? searchNames(entries, query) : null, [entries, query])
  const list = useMemo(() => found ? keepFound(visible, found.hits, row => row.id, keepOrder) : visible, [found, visible, keepOrder])

  const byId = useMemo(() => new Map(all.map(row => [row.id, row])), [all])
  const groups: SuggestGroup[] = found ? [nameGroup(kind === 'ego' ? 'E.G.O' : identityTitle, found.names, hit => open(byId.get(hit.entry.href)!))] : []
  return { list, groups }
}
