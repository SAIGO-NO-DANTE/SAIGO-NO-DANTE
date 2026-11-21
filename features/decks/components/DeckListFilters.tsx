'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { Link2, Search } from 'lucide-react'
import { CONTENT_TYPES, CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import { useKeywords } from '@/components/providers/KeywordProvider'
import type { SupportedLang } from '@/lib/i18n'
import { contentTypeMessageKey, localizeDeckKeyword } from '@/lib/decks/decks-types'
import type { DeckFilterIdentity, DeckFilterSinner } from './DeckIdentityFilterModal'
import FormationCountFilter from './FormationCountFilter'
import InfoScoreLabel from './InfoScoreLabel'
import Sheet from '@/components/ui/Sheet'
import SearchBox, { type SuggestGroup } from '@/components/ui/SearchBox'
import { FilterChoice, FilterFieldHelp, FilterIconTile, FilterPicked, FilterSection, FilterSinnerTiles, FilterTextButton, filterStyles } from '@/components/board/FilterControls'

// The closed BaseModal is SSR-safe; opting out here aborts the whole list's Suspense boundary.
const DeckIdentityFilterModal = dynamic(() => import('./DeckIdentityFilterModal'), {
  loading: () => null,
})

interface DeckListFiltersProps {
  /** Counts up each time the list's own filters button asks for the filter drawer to open. */
  openSignal?: number
  inputValue: string
  /** Also what the box's clear button calls, with an empty value. */
  onInputChange: (value: string) => void
  searchGroups: SuggestGroup[]
  getIconUrl: (kw: string) => string | null
  sort: string
  onSortChange: (s: string) => void
  activeContentType: string
  onContentTypeChange: (ct: string) => void
  showAdvancedFilter: boolean
  onToggleAdvancedFilter: () => void
  advancedFilterCount: number
  allTags: string[]
  activeTags: Set<string>
  showTagFilter: boolean
  onToggleTagFilter: () => void
  onToggleTag: (tag: string) => void
  onClearTags: () => void
  keywordCandidates: string[]
  availableKeywords: string[]
  activeKeywordTags: Set<string>
  keywordTagMode: 'or' | 'and'
  showKeywordFilter: boolean
  onToggleKeywordFilter: () => void
  onToggleKeywordTag: (kw: string) => void
  onClearKeywordTags: () => void
  onToggleKeywordTagMode: () => void
  activeMainKeywords: Set<string>
  mainKeywordMode: 'or' | 'and'
  onToggleMainKeyword: (kw: string) => void
  onClearMainKeywords: () => void
  onToggleMainKeywordMode: () => void
  showCollectionFilter: boolean
  onToggleCollectionFilter: () => void
  collectionLoading: boolean
  hasCollection: boolean
  filterOwnedIdentity: boolean
  filterOwnedEgo: boolean
  onToggleFilterOwnedIdentity: () => void
  onToggleFilterOwnedEgo: () => void
  onClearCollection: () => void
  codeInput: string
  onCodeInputChange: (v: string) => void
  onApplyCode: () => void
  codeError: boolean
  formationCount: number | null
  onFormationCountChange: (count: number | null) => void
  minInfoScore: number | null
  onMinInfoScoreChange: (score: number | null) => void
  identityFilterSinners: DeckFilterSinner[]
  identityFilterIdentities: DeckFilterIdentity[]
  selectedIdentityIds: Set<string>
  selectedIdentities: DeckFilterIdentity[]
  identityMode: 'or' | 'and'
  onToggleSelectedIdentity: (identityId: string) => void
  onToggleIdentityMode: () => void
  onClearSelectedIdentities: () => void
  /** Board facet sections (affiliation, E.G.O), placed before the collection filter. */
  facetSections?: React.ReactNode
}

type SortKey = 'latest' | 'popular'
const INFO_SCORE_OPTIONS = [1, 2, 3] as const


export default function DeckListFilters({
  inputValue, onInputChange, searchGroups, getIconUrl,
  sort, onSortChange,
  activeContentType, onContentTypeChange,
  allTags, activeTags, showTagFilter, onToggleTagFilter, onToggleTag, onClearTags,
  keywordCandidates, availableKeywords, activeKeywordTags, keywordTagMode,
  onToggleKeywordTag, onClearKeywordTags, onToggleKeywordTagMode,
  activeMainKeywords, mainKeywordMode, onToggleMainKeyword, onClearMainKeywords, onToggleMainKeywordMode,
  showCollectionFilter, onToggleCollectionFilter,
  collectionLoading, hasCollection,
  filterOwnedIdentity, filterOwnedEgo,
  onToggleFilterOwnedIdentity, onToggleFilterOwnedEgo, onClearCollection,
  codeInput, onCodeInputChange, onApplyCode, codeError,
  formationCount, onFormationCountChange,
  minInfoScore, onMinInfoScoreChange,
  identityFilterSinners, identityFilterIdentities,
  selectedIdentityIds, selectedIdentities,
  identityMode,
  onToggleSelectedIdentity, onToggleIdentityMode, onClearSelectedIdentities,
  facetSections,
  openSignal,
}: DeckListFiltersProps) {
  const t = useTranslations('decks')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const localKeyword = (keyword: string) => localizeDeckKeyword(keyword, keywords[keyword], locale)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { if (openSignal) setMobileOpen(true) }, [openSignal])
  const [showKeywordTagFilter, setShowKeywordTagFilter] = useState(true)
  const [showFormationFilter, setShowFormationFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)
  const [keywordTagInput, setKeywordTagInput] = useState('')
  const collectionCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const selectedIdentitiesBySinner = useMemo(() => {
    const grouped = new Map<string, DeckFilterIdentity[]>()
    for (const identity of selectedIdentities) {
      const group = grouped.get(identity.sinner_id) ?? []
      group.push(identity)
      grouped.set(identity.sinner_id, group)
    }
    return grouped
  }, [selectedIdentities])

  const keywordTagSuggestions = useMemo(() => {
    const q = keywordTagInput.trim().toLowerCase()
    if (!q) return []
    return keywordCandidates
      .filter(kw => {
        if (activeKeywordTags.has(kw)) return false
        const localized = localKeyword(kw).toLowerCase()
        return kw.toLowerCase().includes(q) || localized.includes(q)
      })
      .sort((a, b) => {
        const aLow = localKeyword(a).toLowerCase()
        const bLow = localKeyword(b).toLowerCase()
        const aStarts = aLow.startsWith(q) ? 0 : 1
        const bStarts = bLow.startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return aLow.localeCompare(bLow, locale)
      })
      .slice(0, 8)
  }, [activeKeywordTags, keywordCandidates, keywordTagInput, localKeyword, locale])

  const addKeywordTag = (rawKeyword?: string) => {
    const value = (rawKeyword ?? keywordTagInput).trim()
    if (!value) return
    const matchedKeyword = keywordCandidates.find(kw => kw.toLowerCase() === value.toLowerCase()) ?? keywordTagSuggestions[0]
    if (!matchedKeyword || activeKeywordTags.has(matchedKeyword)) return
    onToggleKeywordTag(matchedKeyword)
    setKeywordTagInput('')
  }

  const localizeSinnerName = (sinner: DeckFilterSinner) => (
    rootT(`sinner.${sinner.id}` as Parameters<typeof rootT>[0])
  )

  // The search box stays out of the aside's scrolling list so its suggestion panel can reach over the results.
  const searchSection = (
    <section className={filterStyles.searchHelp}>
      <SearchBox value={inputValue} onChange={onInputChange} label={t('search.placeholder')} clearLabel={t('search.clear')} groups={searchGroups} />
      {!inputValue && <FilterFieldHelp text={t('search.hint')} />}
    </section>
  )

  const filters = (
    <>
      <FilterSection label={t('sort.label')}>
        <div className={filterStyles.choices}>
          {(['latest', 'popular'] as SortKey[]).map(key => <FilterChoice key={key} active={sort === key} onClick={() => onSortChange(key)}>{t(`sort.${key}`)}</FilterChoice>)}
        </div>
      </FilterSection>

      <FilterSection label={t('filters.contentType')}>
        <div className={filterStyles.choices}>
          {CONTENT_TYPES.map(ct => {
            const active = activeContentType === ct
            const tone = CONTENT_TYPE_COLORS[ct]
            return <FilterChoice key={ct} active={active} tone={tone?.color} onClick={() => onContentTypeChange(active ? '' : ct)}>{t(`contentTypes.${contentTypeMessageKey(ct)}`)}</FilterChoice>
          })}
        </div>
      </FilterSection>

      {availableKeywords.length > 0 && (
        <FilterSection
          label={t('filters.alwaysKeywords')}
          count={activeMainKeywords.size}
          end={<>
            {activeMainKeywords.size >= 2 && <FilterTextButton onClick={onToggleMainKeywordMode} aria-pressed={mainKeywordMode === 'and'} aria-label={t('filters.mainKeywordModeToggle')}>{mainKeywordMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
            {activeMainKeywords.size > 0 && <FilterTextButton onClick={onClearMainKeywords}>{t('filters.clear')}</FilterTextButton>}
          </>}
        >
          <div className={filterStyles.tiles}>
            {availableKeywords.map(kw => <FilterIconTile key={kw} active={activeMainKeywords.has(kw)} label={localKeyword(kw)} iconUrl={getIconUrl(kw)} onClick={() => onToggleMainKeyword(kw)} />)}
          </div>
        </FilterSection>
      )}

      <FilterSection
        label={t('filters.identity')}
        count={selectedIdentityIds.size}
        open={showIdentityFilter}
        onToggle={() => setShowIdentityFilter(v => !v)}
        end={<>
          {selectedIdentityIds.size >= 2 && <FilterTextButton onClick={onToggleIdentityMode} aria-pressed={identityMode === 'and'} aria-label={t('filters.identityModeToggle')}>{identityMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {selectedIdentityIds.size > 0 && <FilterTextButton onClick={onClearSelectedIdentities}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <FilterSinnerTiles
          sinners={identityFilterSinners}
          picked={selectedIdentitiesBySinner}
          image={getIdentityInfoUrl}
          groupLabel={t('filters.identity')}
          label={(sinner, count) => `${localizeSinnerName(sinner)} ${t('identityFilter.fallbackTitle')}${count > 0 ? `, ${count} ${t('filters.identitySelected')}` : ''}`}
          onOpen={setIdentityModalSinnerId}
        />
      </FilterSection>

      {facetSections}

      <FilterSection
        label={t('filters.keywordTags')}
        count={activeKeywordTags.size}
        open={showKeywordTagFilter}
        onToggle={() => setShowKeywordTagFilter(v => !v)}
        end={<>
          {activeKeywordTags.size >= 2 && <FilterTextButton onClick={onToggleKeywordTagMode} aria-pressed={keywordTagMode === 'and'} aria-label={t('filters.keywordTagModeToggle')}>{keywordTagMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {activeKeywordTags.size > 0 && <FilterTextButton onClick={onClearKeywordTags}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <div className="flex flex-col gap-2">
          <label className={filterStyles.field}>
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              name="deck-keyword-tag"
              value={keywordTagInput}
              onChange={e => setKeywordTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeywordTag()
                } else if (e.key === 'Escape') {
                  setKeywordTagInput('')
                }
              }}
              placeholder={t('filters.keywordTagPlaceholder')}
              className={filterStyles.fieldInput}
              role="combobox"
              aria-expanded={keywordTagSuggestions.length > 0}
              aria-label={t('filters.keywordTagInput')}
              autoComplete="off"
            />
          </label>
            {keywordTagSuggestions.length > 0 && (
              <div
                className="pop-in max-h-56 overflow-y-auto rounded"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                role="listbox"
                aria-label={t('filters.keywordTagSuggestions')}
              >
                {keywordTagSuggestions.map((kw, i) => {
                  const iconUrl = getIconUrl(kw)
                  return (
                    <button
                      key={kw}
                      onClick={() => addKeywordTag(kw)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                      style={{
                        minHeight: '2.25rem',
                        color: i === 0 ? 'var(--gold)' : '#ccc',
                        background: i === 0 ? 'rgba(200,144,10,0.1)' : undefined,
                        borderLeft: i === 0 ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                      role="option"
                      aria-selected={i === 0}
                    >
                      {iconUrl && (
                        <Image
                          src={iconUrl}
                          alt=""
                          width={16}
                          height={16}
                          style={{ width: '1rem', height: '1rem', flexShrink: 0, objectFit: 'contain' }}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{localKeyword(kw)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          {activeKeywordTags.size > 0 && <div className={filterStyles.pickedList}>
            {[...activeKeywordTags].map(kw => {
              const label = localKeyword(kw)
              return <FilterPicked key={kw} label={label} removeLabel={t('filters.removeKeywordTag', { keyword: label })} image={getIconUrl(kw)} imageClassName="object-contain" onRemove={() => onToggleKeywordTag(kw)} />
            })}
          </div>}
        </div>
      </FilterSection>

      {allTags.length > 0 && (
        <FilterSection label={t('filters.tags')} count={activeTags.size} open={showTagFilter} onToggle={onToggleTagFilter}
          end={activeTags.size > 0 && <FilterTextButton onClick={onClearTags}>{t('filters.clear')}</FilterTextButton>}>
          <div className={filterStyles.choices}>
            {allTags.map(tag => <FilterChoice key={tag} active={activeTags.has(tag)} onClick={() => onToggleTag(tag)}>#{tag}</FilterChoice>)}
          </div>
        </FilterSection>
      )}

      <FilterSection label={<InfoScoreLabel />} count={minInfoScore !== null ? 1 : 0}
        end={minInfoScore !== null && <FilterTextButton onClick={() => onMinInfoScoreChange(null)}>{t('filters.clear')}</FilterTextButton>}>
        <div className={filterStyles.choices} role="group" aria-label={t('filters.infoScoreMin')}>
          {INFO_SCORE_OPTIONS.map(score => {
            const active = minInfoScore === score
            return <FilterChoice key={score} active={active} onClick={() => onMinInfoScoreChange(active ? null : score)}>{score === 3 ? '3' : `${score}+`}</FilterChoice>
          })}
        </div>
        <p className={`${filterStyles.hint} flex flex-wrap gap-x-3`}>
          {[t('filters.infoScoreFormation'), t('filters.infoScoreEgo'), t('filters.infoScoreMemo')].map(label => <span key={label}>{label}</span>)}
        </p>
      </FilterSection>

      <FilterSection label={t('filters.formationCount')} count={formationCount !== null ? 1 : 0} open={showFormationFilter} onToggle={() => setShowFormationFilter(v => !v)}>
        <FormationCountFilter value={formationCount} onChange={onFormationCountChange} />
      </FilterSection>

      <FilterSection label={t('filters.collection')} count={collectionCount} open={showCollectionFilter} onToggle={onToggleCollectionFilter}
        end={hasCollection && !collectionLoading && <FilterTextButton onClick={onClearCollection}>{t('filters.clear')}</FilterTextButton>}>
        {collectionLoading ? (
          <p className={filterStyles.hint} role="status" style={{ marginTop: 0 }}>{t('filters.collectionLoading')}</p>
        ) : hasCollection ? (
          <div className={filterStyles.choices}>
            <FilterChoice active={filterOwnedIdentity} aria-label={t('filters.ownedIdentityDeck')} onClick={onToggleFilterOwnedIdentity}>{t('filters.collectionIdentity')}</FilterChoice>
            <FilterChoice active={filterOwnedEgo} aria-label={t('filters.ownedEgoDeck')} onClick={onToggleFilterOwnedEgo}>{t('filters.collectionEgo')}</FilterChoice>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className={`${filterStyles.field} min-w-0 flex-1`} data-invalid={codeError || undefined}>
                <Link2 size={15} aria-hidden="true" />
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => { onCodeInputChange(e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Enter') onApplyCode() }}
                  placeholder={t('filters.collectionCodePlaceholder')}
                  className={filterStyles.fieldInput}
                  aria-label={t('filters.collectionCodeLabel')}
                />
              </label>
              <button type="button" className={filterStyles.action} onClick={onApplyCode}>{t('filters.apply')}</button>
            </div>
            {codeError && <p className={filterStyles.hint} role="alert" style={{ color: 'var(--error-text)' }}>{t('filters.invalidCode')}</p>}
          </>
        )}
      </FilterSection>
    </>
  )

  return (
    <>
      <aside
        className="decks-filters board-filters hidden h-full shrink-0 lg:block"
        aria-label={t('filters.aside')}
      >
        <div className={`${filterStyles.surface} h-full`}>
          <div className="shrink-0 pr-3">{searchSection}</div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-3">
            <div className="flex flex-col gap-6">{filters}</div>
          </div>
        </div>
      </aside>

      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('filters.button')} closeLabel={t('filters.close')}>
        <div className="px-5 py-4">
          <div className={filterStyles.surface}>
            {searchSection}
            {filters}
          </div>
        </div>
      </Sheet>

      <DeckIdentityFilterModal
        open={identityModalSinnerId !== null}
        sinnerId={identityModalSinnerId ?? ''}
        sinners={identityFilterSinners}
        identities={identityFilterIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={onToggleSelectedIdentity}
        onClearIdentities={onClearSelectedIdentities}
        onSinnerChange={setIdentityModalSinnerId}
        onClose={() => setIdentityModalSinnerId(null)}
      />
    </>
  )
}
