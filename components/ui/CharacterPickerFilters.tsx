'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import SearchBox, { type SuggestGroup } from '@/components/ui/SearchBox'
import { getSinnerLogoUrl, getEgoGradeBannerUrl } from '@/lib/utils/images'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import './character-picker.css'

export default function CharacterPickerFilters({ query, onQuery, groups, grade, onGrade, grades, count, sinner = '', onSinner, sinners = [], onReset, canReset }: {
  query: string; onQuery: (value: string) => void
  /** The suggestions under the search field (see pickerFound) */
  groups: SuggestGroup[]
  grade: string; onGrade: (value: string) => void
  grades: { value: string; label: string }[]; count: number
  sinner?: string; onSinner?: (value: string) => void
  sinners?: { id: string; name: string }[]
  /** Replaces what reset clears (by default the search, the grade and the sinner); `canReset` then says when it is on. */
  onReset?: () => void; canReset?: boolean
}) {
  const lang = useLocale(), [expanded, setExpanded] = useState(false)
  const clearLabel = useTranslations('globalSearch')('clear')
  const tr = (ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
  const all = tr('전체', 'すべて', 'All')
  // The field sits outside the scrolling part so its suggestion panel can reach over the cards.
  return <div className="character-picker-filters">
    <SearchBox value={query} onChange={onQuery} label={tr('이름으로 검색', '名前で検索', 'Search by name')} clearLabel={clearLabel} groups={groups} />
    <div className="character-picker-filters-body">
    <div className="character-picker-grades" role="group" aria-label={tr('등급', 'ランク', 'Grade')}>
      <button type="button" aria-pressed={!grade} onClick={() => onGrade('')}>{all}</button>
      {grades.map(g => <button key={g.value} type="button" aria-label={g.label} aria-pressed={grade === g.value} onClick={() => onGrade(g.value)}><img src={/^[1-3]$/.test(g.value) ? RARITY_ICON_MAP[Number(g.value)] : getEgoGradeBannerUrl(g.value)} alt={g.label} width={/^[1-3]$/.test(g.value) ? Number(g.value) * 20 : 40} height={20} className={/^[1-3]$/.test(g.value) ? 'character-picker-rarity' : 'character-picker-ego-grade'} /></button>)}
    </div>
    {onSinner && <>
      <button className="character-picker-filter-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={15} />{sinners.find(s => s.id === sinner)?.name ?? tr('수감자 필터', '囚人フィルター', 'Sinner filter')}</button>
      <div className="character-picker-sinners" data-expanded={expanded} role="group" aria-label={tr('수감자', '囚人', 'Sinner')}>
        <button type="button" aria-pressed={!sinner} onClick={() => onSinner('')}>{all}</button>
        {sinners.map(s => <button key={s.id} type="button" aria-pressed={sinner === s.id} onClick={() => onSinner(s.id)}><img src={getSinnerLogoUrl(s.id)} alt="" width={24} height={24} />{s.name}</button>)}
      </div>
    </>}
    <div className="character-picker-result-count"><span role="status" aria-live="polite">{tr(`${count}개`, `${count}件`, `${count} results`)}</span><button type="button" disabled={onReset ? !canReset : !query && !grade && !sinner} onClick={onReset ?? (() => { onQuery(''); onGrade(''); onSinner?.('') })}><RotateCcw size={14} aria-hidden="true" />{tr('초기화', 'リセット', 'Reset')}</button></div>
    </div>
  </div>
}
