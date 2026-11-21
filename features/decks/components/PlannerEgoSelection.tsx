'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import SuggestionRibbon from '@/components/ui/SuggestionRibbon'
import { SuggestionGroupSkeleton } from '@/components/ui/SuggestionSkeleton'
import SuggestionNote, { useArchetypeLabel } from './SuggestionNote'
import type { Archetype, Suggestion } from '@/lib/community/suggestion-types'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import { pickGroup } from '@/components/ui/SearchRows'
import { pickerEntries, pickerFound } from '@/lib/search/picker-search'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'
import { localizeEgoName } from '@/lib/decks/localize'
import { GRADE_COLORS } from '@/lib/constants/game'
import { EgoPanelBoard } from '@/features/decks/components/EgoBackPanel'
import { toEgoSlotItems } from '@/features/decks'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import { getCompactNameStyle } from '@/lib/planner/compact-name-style'
import { useLocale, useTranslations } from 'next-intl'
import { useSinnerName } from '@/features/decks/hooks/useSinnerName'
import { PLANNER_EGO_GRADE_ORDER, SUGGESTED_LIMIT, type PlannerDeckEgo, type PlannerDeckIdentity, type PlannerDeckSinner, type PlannerEgoBoardSlot } from '@/features/decks/lib/deck-selection'
import '@/components/ui/character-picker.css'

export function PlannerEgoBoard({
  sinners,
  slots,
  onOpenEgoModal,
  getSinnerName,
}: {
  sinners: PlannerDeckSinner[]
  slots: Record<string, PlannerEgoBoardSlot | undefined>
  onOpenEgoModal: (sinnerId: string) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.ego')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)

  // Same grid and card footprint as the identity board; each sinner is the flat back panel of the deck detail's E.G.O view.
  return (
    <EgoPanelBoard
      items={sinners.map(sinner => {
        const slot = slots[sinner.id]
        const sinnerName = getLocalizedSinnerName(sinner)
        return {
          key: sinner.id,
          sinnerId: sinner.id,
          name: slot?.identityName || sinnerName,
          egos: toEgoSlotItems(slot?.egosByGrade ?? {}, locale),
          disabled: !(slot?.enabled ?? true),
          ariaLabel: `${t('modalTitle')} ${sinnerName}`,
          onClick: () => onOpenEgoModal(sinner.id),
        }
      })}
    />
  )
}

export function PlannerEgoSelectModal({
  open,
  sinner,
  egos,
  selectedEgosByGrade,
  suggestions,
  archetype,
  suggestionsLoading = false,
  partnerIdentity,
  onClose,
  onSelect,
  onDeselect,
  getSinnerName,
}: {
  open: boolean
  sinner: PlannerDeckSinner | null
  egos: PlannerDeckEgo[]
  selectedEgosByGrade: Record<string, PlannerDeckEgo | undefined>
  /** Suggested E.G.O, most equipped first, listed under the "추천" ribbon; only while nothing is searched or filtered. They stay in their grade rows too. */
  suggestions?: readonly Suggestion[] | null
  archetype?: Archetype | null
  /** The suggestions are still being read: hold the group's place with its loading shape. */
  suggestionsLoading?: boolean
  partnerIdentity?: (id: string) => PlannerDeckIdentity | undefined
  onClose: () => void
  onSelect: (ego: PlannerDeckEgo) => void
  onDeselect: (grade: string, ego: PlannerDeckEgo) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.ego')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)
  const [query, setQuery] = useState(''), [gradeFilter, setGradeFilter] = useState('')
  useEffect(() => { setQuery(''); setGradeFilter('') }, [open, sinner?.id])
  const entries = useMemo(() => pickerEntries('ego', egos, locale, ego => ({
    id: ego.id, label: localizeEgoName(ego, locale), names: { ko: ego.name_kr, en: ego.name_en, ja: ego.name_jp }, icon: ego.image_url,
  })), [egos, locale])
  // The order they came in; with a query the best match first.
  const { list: filtered, top } = pickerFound(entries, egos.filter(ego => !gradeFilter || ego.grade === gradeFilter), ego => ego.id, query)
  const egoById = new Map(filtered.map(ego => [ego.id, ego]))
  const suggestionOf = new Map((suggestions ?? []).map(suggestion => [suggestion.id, suggestion]))
  const holdSuggested = suggestionsLoading && !query.trim() && !gradeFilter
  const suggested = query.trim() || gradeFilter ? [] : (suggestions ?? []).flatMap(suggestion => egoById.get(suggestion.id) ?? []).slice(0, SUGGESTED_LIMIT)
  const archetypeLabel = useArchetypeLabel()(archetype)
  const renderEgo = (ego: PlannerDeckEgo, note = false) => (
    <div key={ego.id}>
      <EgoDisplayCard
        onClick={() => onSelect(ego)}
        ego={ego}
        name={localizeEgoName(ego, locale)}
        sinnerId={ego.sinner_id}
        lang={locale}
        selected={selectedEgosByGrade[ego.grade]?.id === ego.id}
        className="character-picker-ego-card"
      />
      {note && partnerIdentity && suggestionOf.has(ego.id) && <SuggestionNote suggestion={suggestionOf.get(ego.id)!} identityOf={partnerIdentity} />}
    </div>
  )
  const egosByGrade = new Map<string, PlannerDeckEgo[]>()
  for (const ego of filtered) egosByGrade.set(ego.grade, [...(egosByGrade.get(ego.grade) ?? []), ego])
  return (
    <BaseModal open={open && !!sinner} onClose={onClose} maxWidth="64rem" title={t('modalTitle')}>
      {sinner && (
        <div className="planner-deck-select-modal">
          <div className="planner-deck-select-modal__header">
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...compactNameStyle, color: 'var(--text-primary)', fontSize: '1rem' }}>
                {t('modalHeading', { sinner: getLocalizedSinnerName(sinner) })}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
            </button>
          </div>

          <div className="character-picker-layout">
          <CharacterPickerFilters query={query} onQuery={setQuery} grade={gradeFilter} onGrade={setGradeFilter} grades={PLANNER_EGO_GRADE_ORDER.map(value => ({ value, label: value }))} count={filtered.length} groups={[pickGroup('E.G.O', top, onSelect)]} />
          <div className="planner-deck-select-modal__results flex flex-col gap-5 p-5">
            {holdSuggested && (
              <SuggestionGroupSkeleton shape="ego" count={SUGGESTED_LIMIT} titleClassName="mb-2" tilesClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" archetype />
            )}
            {suggested.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2.5"><SuggestionRibbon />{archetypeLabel && <span className="font-[family-name:var(--font-heading)] text-[0.9375rem] text-[#cbb994]">{archetypeLabel}</span>}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{suggested.map(ego => renderEgo(ego, true))}</div>
              </div>
            )}
            {!filtered.length && <p className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>{locale === 'ja' ? '結果がありません' : locale === 'en' ? 'No results' : '검색 결과가 없습니다'}</p>}
            {PLANNER_EGO_GRADE_ORDER.filter(grade => (egosByGrade.get(grade)?.length ?? 0) > 0).map(grade => {
              const gradeColor = GRADE_COLORS[grade] ?? '#555'
              const gradeEgos = egosByGrade.get(grade) ?? []
              const selectedForGrade = selectedEgosByGrade[grade]

              return (
                <div key={grade}>
                  <div className="mb-2 flex items-center gap-2">
                    <Image
                      src={getEgoGradeBannerUrl(grade)}
                      alt={grade}
                      width={48}
                      height={22}
                      unoptimized
                      style={{ width: '3rem', height: '1.375rem', objectFit: 'contain' }}
                    />
                    <div style={{ flex: 1, height: '1px', background: `${gradeColor}30` }} />
                    {selectedForGrade && grade !== 'ZAYIN' && (
                      <button
                        type="button"
                        onClick={() => onDeselect(grade, selectedForGrade)}
                        className="min-h-11 rounded px-3"
                        style={{ color: 'var(--error-text)', fontSize: '0.9375rem', cursor: 'pointer', border: '1px solid #3a1515', background: 'rgba(200,48,64,0.08)' }}
                      >
                        {t('remove')}
                      </button>
                    )}
                  </div>

                  {gradeEgos.length === 0 ? (
                    <div className="rounded p-2.5 text-center" style={{ background: 'rgba(10,8,5,0.5)', border: `1px solid ${gradeColor}15` }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('emptyGrade')}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {gradeEgos.map(ego => renderEgo(ego))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>
          <style jsx>{`
            .planner-deck-select-modal {
              display: flex;
              flex-direction: column;
              height: 82dvh;
              max-height: 50rem;
              overflow: hidden;
              border: 1px solid #333;
              border-radius: 0.5rem;
              background: #1a1510;
              box-shadow: 0 1rem 3rem rgba(0,0,0,0.8);
            }
            .planner-deck-select-modal__results { overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
            .planner-deck-select-modal__header {
              flex-shrink: 0;
              position: sticky;
              top: 0;
              z-index: 30;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid #222;
              background: #1a1510;
              padding: 1rem 1.25rem;
            }
          `}</style>
        </div>
      )}
    </BaseModal>
  )
}
