'use client'

import { memo, useState, useMemo, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { GiftData } from '@/lib/planner/types'
import { GRADE_COLORS, GRADE_ROMAN, getKeywordSlug } from '@/lib/planner/gift-plan-constants'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import KeywordSidebar from '@/components/ui/KeywordSidebar'
import SearchBox from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { refNameLabels } from '@/lib/game-text/rich-text'
import { giftEntries, giftGrid } from '@/features/planner/lib/gift-search'
import { useGameTextRefs, wantGameTextRefs } from '@/hooks/useGameTextRefs'

// ── Gift grid with grade groups ──────────────────────────────────────────────
export default memo(function GiftGridPanel({
  gifts,
  selectedIds,
  onToggle,
  maxSelect,
  gradeOrder,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
  readOnly = false,
  maxHeight = '28rem',
  layout = 'default',
}: {
  gifts: GiftData[]
  selectedIds: Set<number>
  onToggle: (gift: GiftData) => void
  maxSelect?: number
  gradeOrder: string[]
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
  readOnly?: boolean
  maxHeight?: string
  layout?: 'default' | 'stacked'
}) {
  const t = useTranslations('planner.giftTab')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const locale = useLocale() as SupportedLang
  const clearLabel = useTranslations('globalSearch')('clear')
  // Effects of raw game text hold [Id]s; the search reads them as the names the screen shows, once the table is loaded.
  const { names } = useGameTextRefs({ lazy: true })
  const labels = useMemo(() => (names ? refNameLabels(names) : undefined), [names])
  useEffect(() => { if (query.trim()) wantGameTextRefs() }, [query])

  const entries = useMemo(() => giftEntries(gifts, { names: labels, locale }), [gifts, labels, locale])
  const atLimit = maxSelect !== undefined && selectedIds.size >= maxSelect
  // The keyword sidebar and the search both narrow the grid; a gift whose card is disabled is not suggested.
  const { byGrade: grouped, shown, top } = useMemo(() => giftGrid(gifts, entries, {
    query,
    gradeOrder,
    inKeyword: g => {
      const slug = getKeywordSlug(g.keyword)
      return !activeSlug || slug === activeSlug || (activeSlug === 'general' && (!g.keyword || g.keyword.includes('범용') || g.keyword.includes('공통')))
    },
    pickable: g => !readOnly && !(atLimit && !selectedIds.has(g.game_id)),
  }), [gifts, entries, query, gradeOrder, activeSlug, readOnly, atLimit, selectedIds])

  const giftCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, gifts.length)
    for (const g of gifts) {
      const slug = getKeywordSlug(g.keyword)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [gifts])

  return (
    <div
      className="planner-gift-grid-panel"
      style={{
        display: 'flex',
        flexDirection: layout === 'stacked' ? 'column' : 'row',
        gap: '0.75rem',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Keyword sidebar */}
      <KeywordSidebar
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        giftCounts={giftCounts}
        orientation={layout === 'stacked' ? 'horizontal' : 'vertical'}
      />

      {/* The search sits outside the scrolling grid so its suggestion panel is not clipped by it. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {searchable && (
          <SearchBox
            value={query}
            onChange={setQuery}
            label={searchPlaceholder ?? t('final.searchPlaceholder')}
            clearLabel={clearLabel}
            groups={[pickGroup(translations['mirrorDungeon.tab.gifts'][locale], top, gift => onToggle(gift))]}
          />
        )}

        {/* Grid area */}
        <div className="planner-gift-grid-scroll" style={{
          flex: 1,
          minWidth: 0,
          maxHeight,
          overflowY: 'auto', scrollbarGutter: 'stable',
          paddingRight: '0.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}>
          {gradeOrder.map(grade => {
            const gradeGifts = grouped.get(grade) ?? []
            if (gradeGifts.length === 0) return null
            const gradeColor = GRADE_COLORS[grade] ?? '#888'

            return (
              <div key={grade}>
                {/* Grade divider header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  paddingBottom: '0.375rem',
                  borderBottom: `1px solid ${gradeColor}22`,
                }}>
                  <span style={{
                    fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: gradeColor,
                    letterSpacing: '0.03em',
                  }}>
                    {t('grid.grade', { grade: GRADE_ROMAN[grade] ?? grade })}
                  </span>
                  <span style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                  }}>
                    {gradeGifts.length}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: `${gradeColor}15` }} />
                </div>

                {/* Gift cards */}
                <div className="planner-gift-card-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                  gap: '0.5rem',
                }}>
                  {gradeGifts.map(gift => {
                    const isSelected = selectedIds.has(gift.game_id)
                    return (
                      <div
                        key={gift.id}
                        style={{
                          contentVisibility: 'auto',
                          contain: 'layout style paint',
                          containIntrinsicSize: '4.5rem',
                          // Paint containment clips to this box: the padding (taken back by the margin) leaves room for the
                          // selected overlay, which reaches 5.6% past the card's sides and its tab 8.3% above the card.
                          padding: '0.75rem 0.5rem 0',
                          margin: '-0.75rem -0.5rem 0',
                        }}
                      >
                        <GiftCard
                          gift={gift}
                          isSelected={isSelected}
                          disabled={readOnly || (atLimit && !isSelected)}
                          onClick={() => {
                            if (!readOnly) onToggle(gift)
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {shown === 0 && (
            <div className="planner-gift-empty" style={{
              padding: '2.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9375rem',
              border: '1px dashed #222',
              borderRadius: '0.5rem',
            }}>
              {emptyLabel ?? t('grid.emptyKeyword')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
