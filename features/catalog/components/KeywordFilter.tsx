'use client'

// Design Ref: §5.4 — 키워드 자동완성 필터 (AND 조합)
import { useMemo, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import SearchBox from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import { getLocalizedKeywordName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { keywordFilterEntries, keywordFilterRows } from '@/features/catalog/lib/keyword-suggestions'
import { filterStyles } from './FilterToggleGroup'

type Props = {
  selected: Set<string>
  onToggle: (keyword: string) => void
}

export default function KeywordFilter({ selected, onToggle }: Props) {
  const { getIconUrl, keywords } = useKeywordData()
  const t = useTranslations('browser')
  const clearLabel = useTranslations('globalSearch')('clear')
  const lang = useLocale() as SupportedLang
  const label = (kw: string) => getLocalizedKeywordName(kw, keywords[kw], lang)
  // The filter keeps the Korean keys; the search reads the names in all three languages.
  const [query, setQuery] = useState('')
  const entries = useMemo(() => keywordFilterEntries(keywords, lang, getIconUrl), [keywords, lang, getIconUrl])
  const rows = useMemo(() => keywordFilterRows(entries, query, selected), [entries, query, selected])

  // A pick adds the keyword (one already in the filter stays) and empties the field, which keeps the focus.
  const add = (kw: string) => {
    if (!selected.has(kw)) onToggle(kw)
    setQuery('')
  }

  return (
    <div
      onKeyDown={event => {
        // SearchBox takes Enter itself for a highlighted row (and prevents the default); with none, Enter adds the first suggestion.
        // Only in the field: Enter on the clear button or a chip keeps its own meaning.
        if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement) || event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || !rows.length) return
        event.preventDefault()
        add(rows[0].keyword)
      }}
    >
      <div className={filterStyles.label}>
        {t('keyword')}
      </div>

      {/* 선택된 키워드 칩 (상단) */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {[...selected].map(kw => {
            const iconUrl = getIconUrl(kw)
            return (
              <button
                key={kw}
                onClick={() => onToggle(kw)}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors hover:opacity-80"
                style={{
                  cursor: 'pointer',
                  background: 'rgba(200,144,10,0.15)',
                  border: '1px solid rgba(200,144,10,0.3)',
                  color: 'var(--gold)',
                  fontSize: '0.625rem',
                }}
                aria-label={t('keywordRemove', { kw: label(kw) })}
              >
                {iconUrl && (
                  <Image
                    src={iconUrl}
                    alt=""
                    width={12}
                    height={12}
                    style={{ width: '0.75rem', height: '0.75rem' }}
                    unoptimized
                  />
                )}
                {label(kw)}
                <X size={10} />
              </button>
            )
          })}
        </div>
      )}

      <SearchBox
        value={query}
        onChange={setQuery}
        label={t('keywordSearchLabel')}
        clearLabel={clearLabel}
        groups={[pickGroup(translations['sinnerDetail.keyword'][lang], rows.map(row => ({ item: row, hit: row.hit })), row => add(row.keyword), row => row.added ? t('added') : undefined)]}
      />
    </div>
  )
}
