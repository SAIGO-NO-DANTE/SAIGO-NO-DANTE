'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import SearchBox, { SuggestCut, SuggestRow, nameMarks, type SuggestGroup } from '@/components/ui/SearchBox'
import type { IndexEntry } from '@/lib/search/engine'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { KEYWORD_COLORS, type EgoGift } from '@/features/mirror-dungeon/types'
import { giftSuggestions, keywordEntries } from '@/features/mirror-dungeon/lib/search-suggestions'
import { replaceLastWord } from '@/lib/search/query'

/** The gift search field: gifts by name, keywords the last word may mean and effects holding the query. */
export default function GiftSearchBox({ gifts, entries, keywordOrder, keywordLabels, getGiftKeywordIcon, usable, onPick, value, onChange, label, clearLabel, className }: {
  gifts: readonly EgoGift[]
  /** The gift index (giftEntries), null while nothing is typed */
  entries: IndexEntry[] | null
  keywordOrder: readonly string[]
  keywordLabels: Readonly<Record<string, string>>
  getGiftKeywordIcon: (keyword: string) => string | null
  /** Gifts the host cannot pick (a card that is disabled) are not suggested */
  usable: (gift: EgoGift) => boolean
  /** What a click on the gift's card does in this host */
  onPick: (gift: EgoGift) => void
  value: string
  onChange: (value: string) => void
  label: string
  clearLabel: string
  className?: string
}) {
  const lang = useLocale() as SupportedLang
  const tp = useTranslations('mirrorDungeonPage')
  const giftWord = translations['mirrorDungeon.tab.gifts'][lang]
  const byId = useMemo(() => new Map(gifts.map(gift => [gift.id, gift])), [gifts])
  const keywords = useMemo(() => keywordEntries(gifts, keywordOrder, key => keywordLabels[key] ?? key), [gifts, keywordOrder, keywordLabels])
  const found = entries && giftSuggestions(entries, keywords, value, id => usable(byId.get(id)!))

  const groups: SuggestGroup[] = found ? [
    {
      title: giftWord,
      rows: found.names.map(hit => {
        const gift = byId.get(hit.entry.href)!
        return {
          key: `g${gift.id}`,
          onPick: () => onPick(gift),
          body: <SuggestRow image={gift.image_url} name={hit.entry.label} marks={nameMarks(hit)} right={hit.entry.sublabel} rightColor={KEYWORD_COLORS[gift.keyword]} />,
        }
      }),
    },
    {
      title: tp('suggestKeyword'),
      rows: found.keywords.map(hit => ({
        key: `k${hit.entry.href}`,
        onPick: () => onChange(replaceLastWord(value, hit.entry.label)),
        body: <SuggestRow image={getGiftKeywordIcon(hit.entry.href)} name={hit.entry.label} marks={nameMarks(hit)} right={`${giftWord} ${hit.entry.sublabel}`} />,
      })),
    },
    {
      title: tp('suggestEffect'),
      rows: found.effects.map(hit => {
        const gift = byId.get(hit.entry.href)!
        return { key: `t${gift.id}`, onPick: () => onPick(gift), body: <SuggestCut image={gift.image_url} name={hit.entry.label} {...hit.snippet!} /> }
      }),
    },
  ].filter(group => group.rows.length > 0) : []

  return <SearchBox value={value} onChange={onChange} label={label} clearLabel={clearLabel} groups={groups} className={className} />
}
