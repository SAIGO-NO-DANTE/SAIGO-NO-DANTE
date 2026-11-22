'use client'

import { useReducedMotion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { localizeDeckKeyword } from '@/features/decks'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { DECK_MAIN_KEYWORDS, MANUAL_ATTACK_MAIN_KEYWORDS, MAX_DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import type { SupportedLang } from '@/lib/i18n/types'
import MainKeywordChip from './MainKeywordChip'

/** The main-keyword chips above the identity board: counts from the formation, picked ones lit, the cap greying the rest. */
export default function DeckMainKeywords({ counts, effectiveKeywords, onToggle, label }: {
  counts: Record<string, number>
  effectiveKeywords: string[]
  onToggle: (keyword: string) => void
  /** The strip's name when the host is not the planner */
  label?: string
}) {
  const tDeck = useTranslations('planner.deckTab')
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const reduceMotion = useReducedMotion()
  return (
    <div className="planner-main-keywords" aria-label={label ?? tDeck('mainKeywords.label')}>
      {DECK_MAIN_KEYWORDS.map(keyword => {
        const iconUrl = getIconUrl(keyword)
        const count = counts[keyword] ?? 0
        const selected = effectiveKeywords.includes(keyword)
        const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
        const disabled = (!isManualAttackKeyword && count <= 0) || (!selected && effectiveKeywords.length >= MAX_DECK_MAIN_KEYWORDS)
        const keywordLabel = localizeDeckKeyword(keyword, keywordInfo[keyword], locale)
        const accessibleName = isManualAttackKeyword ? keywordLabel : tDeck('mainKeywords.keywordCount', { keyword: keywordLabel, count })
        return (
          <MainKeywordChip
            key={keyword}
            keyword={keyword}
            iconUrl={iconUrl}
            label={keywordLabel}
            accessibleName={accessibleName}
            count={isManualAttackKeyword ? null : count}
            selected={selected}
            disabled={disabled}
            reduceMotion={!!reduceMotion}
            onToggle={onToggle}
          />
        )
      })}
      <style jsx global>{`
        .planner-main-keywords { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin: -0.5rem 0 0.75rem; }
        .planner-main-keyword {
          display: inline-flex; flex: 0 0 auto; max-width: 100%; min-height: 2.25rem; align-items: center; gap: 0.3125rem;
          padding: 0 0.625rem; border: 1px solid transparent; border-radius: 999px; background: rgba(232, 220, 200, 0.04);
          color: #9c8b73; cursor: pointer; font-family: var(--font-body), var(--font-sans); font-size: 0.8125rem; line-height: 1;
          transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
        }
        .planner-main-keyword:hover:not(:disabled) { background: rgba(232, 220, 200, 0.08); color: #e8dcc8; }
        .planner-main-keyword:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
        .planner-main-keyword[data-selected="true"] { border-color: rgba(200, 144, 10, 0.45); background: rgba(200, 144, 10, 0.14); color: #e8b030; }
        .planner-main-keyword:disabled { cursor: not-allowed; opacity: 0.38; }
        .planner-main-keyword__icon { flex: 0 0 auto; width: 0.875rem; height: 0.875rem; object-fit: contain; }
        .planner-main-keyword__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .planner-main-keyword__count { color: inherit; font-size: 0.75rem; font-variant-numeric: tabular-nums; opacity: 0.7; }
        @media (pointer: coarse) { .planner-main-keyword { min-height: 2.75rem; } }
        @media (prefers-reduced-motion: reduce) { .planner-main-keyword { transition: none; } }
      `}</style>
    </div>
  )
}
