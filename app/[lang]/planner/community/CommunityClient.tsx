'use client'

import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel'
import DiscoveryShelf, { type InitialShelf } from '@/features/community/components/DiscoveryShelf'
import BoardBrowseLock from '@/features/community/components/BoardBrowseLock'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { Link2 } from 'lucide-react'
import { type PlanSummary } from '@/components/cards/PlanCard'
import { DIFFICULTY_COLOR, DIFFICULTY_NAME } from '@/components/cards/PlanDifficulty'
import { BoardResults, BrowseBar } from '@/features/community/components/Browse'
import type { RowPost } from '@/features/community/components/BoardParts'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import DeckIdentityFilterModal, { type DeckFilterSinner } from '@/features/decks/components/DeckIdentityFilterModal'
import FormationCountFilter from '@/features/decks/components/FormationCountFilter'
import { FacetPickerModal, FacetSections, type FacetKind } from '@/features/community/components/FacetPicker'
import { FilterChoice, FilterFieldHelp, FilterIconTile, FilterSection, FilterSinnerTiles, FilterTextButton, filterStyles } from '@/components/board/FilterControls'
import { useBoardFacets } from '@/features/community/hooks/useBoardFacets'
import { getActiveTerm } from '@/lib/utils/search'
import { useLocale, useTranslations } from 'next-intl'
import { QUERY_OPTIONS, localizeDeckKeyword, parseCsvParam, serializeCsvParam } from '@/features/decks'
import { useBoardSuggest } from '@/features/decks/hooks/useBoardSuggest'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n'
import Sheet from '@/components/ui/Sheet'
import SearchBox from '@/components/ui/SearchBox'
import { usePlanList } from '@/features/planner/hooks/usePlanList'
import { usePlanCollectionFilter } from '@/features/planner/hooks/usePlanCollectionFilter'
import { PLAN_FILTER_KEYWORDS, PLAN_LIST_PAGE_SIZE as PAGE_SIZE, buildPlanFilterIndexes, filterPlanIndexes, usePlanListFilters } from '@/features/planner/hooks/usePlanListFilters'

type SortKey = 'latest' | 'popular'



type CommunityClientProps = {
  initialPlans?: PlanSummary[]
  initialTotal?: number
  initialShelf?: InitialShelf
}

export default function CommunityClient({ initialPlans, initialTotal, initialShelf }: CommunityClientProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.communityBoard')
  const rootT = useTranslations()
  const { status: authStatus } = useSession()
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const [browse, setBrowse] = useQueryState('browse', parseAsString.withDefault(''))
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const {
    setSort, difficulty, setDifficulty, keywordQuery, setKeywordQuery, identityIdsQuery, setIdentityIdsQuery, setFormationCountQuery, formationCount,
    activeKeywordList, activeKeywords, keywordMode, selectedIdentityIdList, selectedIdentityIds, identityMode,
    allIdentities, ensureIdentities, normalizedSort, serverQueryKey, buildPlannerSearchParams,
    toggleKeyword, toggleKeywordMode, filterIdentities, identityFilterSinners, selectedIdentitiesBySinner, toggleSelectedIdentity, toggleIdentityMode,
  } = usePlanListFilters()
  // 소속·E.G.O·기프트·테마팩: 고른 것을 모두 담은 글만 남긴다
  const [affiliationQuery, setAffiliationQuery] = useQueryState('af', parseAsString.withDefault(''))
  const [egoQuery, setEgoQuery] = useQueryState('eg', parseAsString.withDefault(''))
  const [giftQuery, setGiftQuery] = useQueryState('gf', parseAsString.withDefault(''))
  const [themeQuery, setThemeQuery] = useQueryState('tp', parseAsString.withDefault(''))
  const facetSelections: Record<FacetKind, string[]> = {
    affiliation: parseCsvParam(affiliationQuery), ego: parseCsvParam(egoQuery), gift: parseCsvParam(giftQuery), theme: parseCsvParam(themeQuery),
  }
  const facetSetters = { affiliation: setAffiliationQuery, ego: setEgoQuery, gift: setGiftQuery, theme: setThemeQuery }
  const toggleFacet = (kind: FacetKind, id: string) => {
    const next = new Set(facetSelections[kind])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void facetSetters[kind](serializeCsvParam(next), QUERY_OPTIONS)
  }
  const [facetModal, setFacetModal] = useState<FacetKind | null>(null)
  const facetData = useBoardFacets('planner').data
  // inputValue: local state for immediate input display (avoids IME composition breaks)
  const [inputValue, setInputValue] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    void ensureIdentities()
  }, [ensureIdentities])

  // Suggestions complete the text after the last + or *.
  const { prefix, activeTerm } = getActiveTerm(inputValue)
  const searchGroups = useBoardSuggest({
    term: activeTerm, pick: name => setInputValue(prefix + name), identities: allIdentities,
    titles: { identity: t('search.suggestionIdentity'), keyword: t('search.suggestionKeyword') },
  })

  // 검색 debounce: inputValue → URL(search) + debouncedSearch
  useEffect(() => {
    const t = setTimeout(() => {
      void setSearch(inputValue || null, QUERY_OPTIONS)
      setDebouncedSearch(inputValue)
    }, 300)
    return () => clearTimeout(t)
  }, [inputValue, setSearch])

  // 키워드 필터
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [showFormationFilter, setShowFormationFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)

  // 컬렉션 필터
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)
  const localKeyword = useCallback((keyword: string) => localizeDeckKeyword(keyword, keywords[keyword], locale), [keywords, locale])

  // Only browsing all or searching shows the list; the default view is the discovery shelf, so nothing is loaded for it.
  const listVisible = browse === 'all' || Boolean(search || keywordQuery || identityIdsQuery)

  const { plans, loading, loadingMore, hasMore, total, loadMore } = usePlanList({
    initialPlans, initialTotal, serverQueryKey, listVisible, buildSearchParams: buildPlannerSearchParams, pageSize: PAGE_SIZE, errorMessage: t('loadFailed'),
  })

  const sentinelRef = useLoadMoreSentinel(loadMore, scrollRootRef, serverQueryKey)

  const {
    filterOwnedIdentity, filterOwnedEgo, hasCollection, collectionLoading, codeInput, codeError, effectiveOwned, changeCodeInput,
    applyCollectionCode, toggleFilterOwnedIdentity, toggleFilterOwnedEgo, clearCollectionFilters,
  } = usePlanCollectionFilter(authStatus)

  const localizeSinnerName = useCallback((sinner: DeckFilterSinner) => (
    rootT(`sinner.${sinner.id}` as Parameters<typeof rootT>[0])
  ), [rootT])

  const planIndexes = useMemo(() => buildPlanFilterIndexes(plans, facetData?.identityAffiliations), [plans, facetData])

  // 클라이언트 필터
  const filtered = useMemo(() => filterPlanIndexes(planIndexes, {
    search: debouncedSearch, keywords: activeKeywordList, keywordMode, identityIds: selectedIdentityIdList, identityMode,
    filterOwnedIdentity, filterOwnedEgo, effectiveOwned, facets: facetSelections,
  }), [planIndexes, debouncedSearch, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliationQuery, egoQuery, giftQuery, themeQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const collectionFilterCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const totalActiveCount = (inputValue.trim() ? 1 : 0) + (difficulty ? 1 : 0) + (formationCount !== null ? 1 : 0) + activeKeywords.size + selectedIdentityIds.size + collectionFilterCount + Object.values(facetSelections).reduce((sum, list) => sum + list.length, 0)
  const hasAnyFilter = totalActiveCount > 0

  // The search box stays out of the aside's scrolling list so its suggestion panel can reach over the results.
  const searchSection = (
    <section className={filterStyles.searchHelp}>
      <SearchBox value={inputValue} onChange={setInputValue} label={t('search.placeholder')} clearLabel={t('search.clear')} groups={searchGroups} />
      {!inputValue && <FilterFieldHelp text={t('search.hint')} />}
    </section>
  )

  const filters = (
    <>
      <FilterSection label={t('sort.label')}>
        <div className={filterStyles.choices}>
          {(['latest', 'popular'] as SortKey[]).map(key => (
            <FilterChoice key={key} active={normalizedSort === key} onClick={() => setSort(key)}>{t(`sort.${key}`)}</FilterChoice>
          ))}
        </div>
      </FilterSection>

      <FilterSection label={t('filters.difficulty')}>
        <div className={filterStyles.choices}>
          <FilterChoice active={!difficulty} onClick={() => setDifficulty(null)}>{t('filters.all')}</FilterChoice>
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
            const active = difficulty === key
            return <FilterChoice key={key} active={active} tone={DIFFICULTY_COLOR[key]} onClick={() => setDifficulty(active ? null : key)}><span className="font-[family-name:var(--font-title)] text-[1.0625rem] leading-none tracking-[0.04em]">{DIFFICULTY_NAME[key]}</span></FilterChoice>
          })}
        </div>
      </FilterSection>

      <FilterSection
        label={t('filters.keywords')}
        count={activeKeywords.size}
        open={showKeywordFilter}
        onToggle={() => setShowKeywordFilter(v => !v)}
        end={<>
          {activeKeywords.size >= 2 && <FilterTextButton onClick={toggleKeywordMode} aria-pressed={keywordMode === 'and'} aria-label={t('filters.keywordModeToggle')}>{keywordMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {activeKeywords.size > 0 && <FilterTextButton onClick={() => { void setKeywordQuery(null, QUERY_OPTIONS) }}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <div className={filterStyles.tiles}>
          {PLAN_FILTER_KEYWORDS.map(kw => (
            <FilterIconTile key={kw} active={activeKeywords.has(kw)} label={localKeyword(kw)} iconUrl={getIconUrl(kw)} onClick={() => toggleKeyword(kw)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection
        label={t('filters.identity')}
        count={selectedIdentityIds.size}
        open={showIdentityFilter}
        onToggle={() => setShowIdentityFilter(v => !v)}
        end={<>
          {selectedIdentityIds.size >= 2 && <FilterTextButton onClick={toggleIdentityMode} aria-pressed={identityMode === 'and'} aria-label={t('filters.identityModeToggle')}>{identityMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {selectedIdentityIds.size > 0 && <FilterTextButton onClick={() => { void setIdentityIdsQuery(null, QUERY_OPTIONS) }}>{t('filters.clear')}</FilterTextButton>}
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

      <FacetSections kinds={['affiliation', 'ego', 'gift', 'theme']} facets={facetData} selections={facetSelections}
        onRemove={toggleFacet} onOpen={setFacetModal} />

      <FilterSection
        label={rootT('decks.filters.formationCount')}
        count={formationCount !== null ? 1 : 0}
        open={showFormationFilter}
        onToggle={() => setShowFormationFilter(v => !v)}
      >
        <FormationCountFilter value={formationCount} onChange={value => { void setFormationCountQuery(value, QUERY_OPTIONS) }} />
      </FilterSection>

      <FilterSection
        label={t('filters.collection')}
        count={collectionFilterCount}
        open={showCollectionFilter}
        onToggle={() => setShowCollectionFilter(v => !v)}
        end={(hasCollection || filterOwnedIdentity || filterOwnedEgo || codeInput || codeError || collectionLoading) && <FilterTextButton onClick={clearCollectionFilters}>{t('filters.clear')}</FilterTextButton>}
      >
        <div className={filterStyles.choices}>
          <FilterChoice active={filterOwnedIdentity} onClick={() => { void toggleFilterOwnedIdentity() }}>{t('filters.ownedIdentityPlan')}</FilterChoice>
          <FilterChoice active={filterOwnedEgo} onClick={() => { void toggleFilterOwnedEgo() }}>{t('filters.ownedEgoPlan')}</FilterChoice>
        </div>
        {collectionLoading && <p className={filterStyles.hint} role="status">{t('filters.collectionLoading')}</p>}
        {!hasCollection && (
          <div className="mt-2 flex items-center gap-2">
            <label className={`${filterStyles.field} min-w-0 flex-1`} data-invalid={codeError || undefined}>
              <Link2 size={15} aria-hidden="true" />
              <input
                type="text"
                value={codeInput}
                onChange={e => changeCodeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
                placeholder={t('filters.collectionCodePlaceholder')}
                className={filterStyles.fieldInput}
                aria-label={t('filters.collectionCodeLabel')}
              />
            </label>
            <button type="button" className={filterStyles.action} onClick={() => applyCollectionCode(codeInput)} disabled={collectionLoading}>{t('filters.apply')}</button>
          </div>
        )}
        {codeError && <p className={filterStyles.hint} role="alert" style={{ color: 'var(--error-text)' }}>{t('filters.invalidCode')}</p>}
      </FilterSection>
    </>
  )

  if (!listVisible) return <DiscoveryShelf kind="planner" initialData={initialShelf} onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 px-4 pb-4 md:px-6 lg:overflow-hidden">
      <BoardBrowseLock />
      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        <aside
          className="board-filters hidden h-full shrink-0 lg:block"
          aria-label={t('filters.aside')}
        >
          <div className={`${filterStyles.surface} h-full`}>
            <div className="shrink-0 pr-3">{searchSection}</div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-3">
              <div className="flex flex-col gap-6">{filters}</div>
            </div>
          </div>
        </aside>

        <div ref={scrollRootRef} className="min-h-0 flex-1 pb-16 lg:overflow-y-auto lg:pr-1">
          <BrowseBar
            search={{ value: inputValue, onChange: setInputValue, onClear: () => setInputValue(''), placeholder: t('search.placeholder'), label: t('search.label') }}
            filterCount={totalActiveCount}
            onOpenFilters={() => setMobileFiltersOpen(true)}
            summary={loading ? '' : hasAnyFilter || filtered.length !== total ? t('result.filtered', { filtered: filtered.length, total }) : t('result.total', { count: total })}
          />

          <BoardResults kind="planner" posts={filtered as RowPost[]} loading={loading} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef}
            empty={(
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-[1rem] text-[var(--text-secondary)]">{debouncedSearch.trim() ? t('grid.noSearchResults', { query: debouncedSearch }) : t('grid.empty')}</p>
                {!debouncedSearch.trim() && <Link href="/planner" className="min-h-11 content-center text-[0.9375rem] font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">{t('grid.createFirst')}</Link>}
              </div>
            )} />
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title={t('filters.button')} closeLabel={t('filters.close')}>
        <div className="px-5 py-4">
          <div className={filterStyles.surface}>
            {searchSection}
            {filters}
          </div>
        </div>
      </Sheet>

      <FacetPickerModal kind={facetModal} facets={facetData} selected={facetModal ? facetSelections[facetModal] : []}
        onToggle={id => { if (facetModal) toggleFacet(facetModal, id) }} onClose={() => setFacetModal(null)} />

      <DeckIdentityFilterModal
        open={identityModalSinnerId !== null}
        sinnerId={identityModalSinnerId ?? ''}
        sinners={identityFilterSinners}
        identities={filterIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={toggleSelectedIdentity}
        onClearIdentities={() => { void setIdentityIdsQuery(null, QUERY_OPTIONS) }}
        onSinnerChange={setIdentityModalSinnerId}
        onClose={() => setIdentityModalSinnerId(null)}
      />

    </div>
  )
}
