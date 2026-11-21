'use client'

import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel'

import DiscoveryShelf, { type InitialShelf } from '@/features/community/components/DiscoveryShelf'
import BoardBrowseLock from '@/features/community/components/BoardBrowseLock'

import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react'
import { parseAsString, useQueryState } from 'nuqs'
import { useSession } from 'next-auth/react'
import { Link } from '@/lib/i18n/navigation'
import { type DeckSummary } from '@/components/cards/DeckCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { FacetPickerModal, FacetSections, type FacetKind } from '@/features/community/components/FacetPicker'
import { useBoardFacets } from '@/features/community/hooks/useBoardFacets'
import { getActiveTerm } from '@/lib/utils/search'
import DeckListFilters from '@/features/decks/components/DeckListFilters'
import { BoardResults, BrowseBar } from '@/features/community/components/Browse'
import type { RowPost } from '@/features/community/components/BoardParts'
import { QUERY_OPTIONS } from '@/features/decks'
import { useDeckCollectionFilter } from '@/features/decks/hooks/useDeckCollectionFilter'
import { useBoardSuggest } from '@/features/decks/hooks/useBoardSuggest'
import { DECK_LIST_PAGE_SIZE as PAGE_SIZE, deriveDeckListData, filterDeckList, mapDeck, mergeDeckRows, normalizeSortKey, useDeckListFilters, type DeckSortKey as SortKey } from '@/features/decks/hooks/useDeckListFilters'
import { useLocale, useTranslations } from 'next-intl'
import { showError } from '@/lib/toast'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'

interface DecksClientProps {
  initialDecks?: DeckSummary[]
  initialTotal?: number
  initialSort?: SortKey
  initialShelf?: InitialShelf
}

export default function DecksClient({
  initialDecks,
  initialSort = 'latest',
  initialShelf,
}: DecksClientProps = {}) {
  const locale = useLocale()
  const t = useTranslations('decks')
  useRoutePrefetch([`/${locale}/decks/new`])
  const { getIconUrl } = useKeywordData()
  const { status: authStatus } = useSession()

  // ── Deck data state ──
  const hasServerInitialDecks = initialDecks !== undefined
  const [decks, setDecks] = useState<DeckSummary[]>(() => mergeDeckRows([], initialDecks ?? []))
  const [loading, setLoading] = useState(!hasServerInitialDecks)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const initialDataKey = useRef<string | null>(hasServerInitialDecks ? initialSort : null)
  const deckRequestId = useRef(0)
  const [filterSignal, setFilterSignal] = useState(0)
  const loadMoreRequestId = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const loadMoreFailedRef = useRef(false)
  const [, startTransition] = useTransition()

  // ── URL-synced state ──
  const [browse, setBrowse] = useQueryState('browse', parseAsString.withDefault(''))
  const [sortQuery, setSortQuery] = useQueryState('sort', parseAsString.withDefault('latest'))
  const sort = normalizeSortKey(sortQuery)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const latestSortRef = useRef(sort)
  const latestServerQueryRef = useRef('')

  // ── Search UI state ──
  const [inputValue, setInputValue] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  // ── Deck list filters (URL-synced) ──
  const {
    allIdentities, setFilterQuery,
    activeContentType, activeTags, activeMainKeywords, activeKeywordTags, formationCount, minInfoScore, selectedIdentityIds,
    mainKeywordMode, keywordTagMode, identityMode, filterOwnedIdentity, filterOwnedEgo,
    serverQueryKey, hasServerBackedFilters, buildDeckSearchParams, hasAnyFilter: hasAnyBaseFilter, advancedFilterCount: baseFilterCount,
    toggleTag, toggleMainKeyword, toggleKeywordTag, filterIdentities, filterSinners, selectedIdentities, toggleSelectedIdentity,
  } = useDeckListFilters({ sort, debouncedSearch, inputValue })

  // 소속·E.G.O: 고른 것을 모두 담은 덱만 남긴다(플랜 게시판과 같은 선택 창)
  const [affiliationQuery, setAffiliationQuery] = useQueryState('af', parseAsString.withDefault(''))
  const [egoFacetQuery, setEgoFacetQuery] = useQueryState('eg', parseAsString.withDefault(''))
  const csv = (value: string) => value ? value.split(',').map(item => item.trim()).filter(Boolean) : []
  const facetSelections: Record<FacetKind, string[]> = { affiliation: csv(affiliationQuery), ego: csv(egoFacetQuery), gift: [], theme: [] }
  const toggleFacet = (kind: FacetKind, id: string) => {
    const next = new Set(facetSelections[kind])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const value = [...next].join(',') || null
    void (kind === 'affiliation' ? setAffiliationQuery(value, QUERY_OPTIONS) : setEgoFacetQuery(value, QUERY_OPTIONS))
  }
  const [facetModal, setFacetModal] = useState<FacetKind | null>(null)
  const facetData = useBoardFacets('deck').data
  const hasAnyFilter = hasAnyBaseFilter || Boolean(affiliationQuery || egoFacetQuery)
  const advancedFilterCount = baseFilterCount + facetSelections.affiliation.length + facetSelections.ego.length

  // ── Search suggestions ──
  // The term after the last + or * is what a suggestion completes.
  const { prefix, activeTerm } = getActiveTerm(inputValue)
  const searchGroups = useBoardSuggest({
    term: activeTerm, pick: name => setInputValue(prefix + name), identities: allIdentities,
    titles: { identity: t('search.suggestionIdentity'), keyword: t('search.suggestionKeyword') },
  })

  // ── Search debounce ──
  useEffect(() => {
    const t = setTimeout(() => {
      const nextSearch = inputValue.trim()
      if (nextSearch === search.trim()) {
        setDebouncedSearch(inputValue)
        return
      }
      startTransition(() => {
        void setSearch(nextSearch || null, QUERY_OPTIONS)
      })
      setDebouncedSearch(inputValue)
    }, 300)
    return () => clearTimeout(t)
  }, [inputValue, search, setSearch, startTransition])

  const [showAdvancedFilter, setShowAdvancedFilter] = useState(true)
  const [showTagFilter, setShowTagFilter] = useState(true)
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)

  // Only browsing all or filtering shows the list; the default view is the discovery shelf, so nothing is loaded for it.
  const listVisible = browse === 'all' || hasAnyFilter

  // ── Initial deck load (skip if server data present) ──
  useEffect(() => {
    if (!listVisible) return
    if (!hasServerBackedFilters && initialDataKey.current === sort) {
      initialDataKey.current = null
      if (initialDecks && mergeDeckRows([], initialDecks).length < PAGE_SIZE) setHasMore(false)
      setLoading(false)
      setRefreshing(false)
      latestSortRef.current = sort
      latestServerQueryRef.current = serverQueryKey
      return
    }
    latestSortRef.current = sort
    latestServerQueryRef.current = serverQueryKey
    const requestId = deckRequestId.current + 1
    deckRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingDecks = decks.length > 0
    setLoading(!hasExistingDecks)
    setRefreshing(hasExistingDecks)
    setLoadingMore(false)
    setHasMore(true)
    loadMoreFailedRef.current = false
    const params = buildDeckSearchParams(0)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        if (deckRequestId.current !== requestId) return
        if (Array.isArray(data)) {
          const nextDecks = mergeDeckRows([], data.map(mapDeck))
          setDecks(nextDecks)
          if (data.length < PAGE_SIZE || nextDecks.length < PAGE_SIZE) setHasMore(false)
        }
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('덱 목록 로드 실패:', e)
        if (deckRequestId.current === requestId) showError(t('result.loadFailed'))
      })
      .finally(() => {
        if (deckRequestId.current !== requestId) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => controller.abort()
  }, [listVisible, sort, serverQueryKey, hasServerBackedFilters, buildDeckSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ──
  const loadMore = useCallback(() => {
    // A failed page is not retried on its own (the sentinel would re-fire it at once); a new filter or sort clears this.
    if (loading || refreshing || loadingMore || !hasMore || loadMoreFailedRef.current) return
    setLoadingMore(true)
    loadMoreAbortRef.current?.abort()
    const requestId = loadMoreRequestId.current + 1
    loadMoreRequestId.current = requestId
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const requestSort = sort
    const requestQueryKey = serverQueryKey
    const params = buildDeckSearchParams(decks.length)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        if (loadMoreRequestId.current !== requestId || latestSortRef.current !== requestSort || latestServerQueryRef.current !== requestQueryKey) return
        if (!Array.isArray(data) || data.length === 0) { setHasMore(false); return }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => mergeDeckRows(prev, data.map(mapDeck)))
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('덱 추가 로드 실패:', e)
        if (loadMoreRequestId.current === requestId) {
          loadMoreFailedRef.current = true
          showError(t('result.loadFailed'))
        }
      })
      .finally(() => {
        if (loadMoreRequestId.current === requestId) {
          loadMoreAbortRef.current = null
        }
        if (loadMoreRequestId.current === requestId && latestSortRef.current === requestSort && latestServerQueryRef.current === requestQueryKey) setLoadingMore(false)
      })
  }, [sort, serverQueryKey, buildDeckSearchParams, decks.length, loading, refreshing, loadingMore, hasMore])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    setLoadingMore(false)
  }, [serverQueryKey])

  // ── Infinite scroll observer ──
  const sentinelRef = useLoadMoreSentinel(loadMore, scrollRootRef, serverQueryKey)

  const { collectionLoading, hasCollection, codeInput, codeError, effectiveOwned, changeCodeInput, applyCollectionCode, toggleFilterOwnedIdentity, toggleFilterOwnedEgo, clearCollection } = useDeckCollectionFilter({
    authStatus, filterOwnedIdentity, filterOwnedEgo, setFilterQuery,
  })

  // ── Derived filter data ──
  const deckDerived = useMemo(() => deriveDeckListData(decks), [decks])

  const allTags = deckDerived.allTags
  const availableKeywords = deckDerived.availableKeywords
  const keywordCandidates = deckDerived.keywordCandidates

  // ── Filter application ──
  const filtered = useMemo(() => filterDeckList(decks, deckDerived.byId, {
    filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliation: facetSelections.affiliation, ego: facetSelections.ego, identityAffiliations: facetData?.identityAffiliations,
  }), [decks, deckDerived, filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliationQuery, egoFacetQuery, facetData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!listVisible) return <DiscoveryShelf kind="deck" initialData={initialShelf} onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 px-4 pb-4 md:px-6 lg:overflow-hidden">
      <BoardBrowseLock />

      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        {/* ── 필터 패널 ── */}
        <DeckListFilters
          openSignal={filterSignal}
          inputValue={inputValue}
          // Emptying the box (its clear button too) drops the search at once, without the debounce.
          onInputChange={v => { setInputValue(v); if (!v) { void setSearch(null, QUERY_OPTIONS); setDebouncedSearch('') } }}
          searchGroups={searchGroups}
          getIconUrl={getIconUrl}
          sort={sort}
          onSortChange={s => { void setSortQuery(s as SortKey, QUERY_OPTIONS) }}
          activeContentType={activeContentType}
          onContentTypeChange={value => { void setFilterQuery({ contentType: value || null }) }}
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(v => !v)}
          advancedFilterCount={advancedFilterCount}
          allTags={allTags}
          activeTags={activeTags}
          showTagFilter={showTagFilter}
          onToggleTagFilter={() => setShowTagFilter(v => !v)}
          onToggleTag={toggleTag}
          onClearTags={() => { void setFilterQuery({ tags: null }) }}
          keywordCandidates={keywordCandidates}
          availableKeywords={availableKeywords}
          activeKeywordTags={activeKeywordTags}
          keywordTagMode={keywordTagMode}
          showKeywordFilter={showKeywordFilter}
          onToggleKeywordFilter={() => setShowKeywordFilter(v => !v)}
          onToggleKeywordTag={toggleKeywordTag}
          onClearKeywordTags={() => { void setFilterQuery({ keywordTags: null }) }}
          onToggleKeywordTagMode={() => { void setFilterQuery({ keywordTagMode: keywordTagMode === 'or' ? 'and' : 'or' }) }}
          activeMainKeywords={activeMainKeywords}
          mainKeywordMode={mainKeywordMode}
          onToggleMainKeyword={toggleMainKeyword}
          onClearMainKeywords={() => { void setFilterQuery({ mainKeywords: null }) }}
          onToggleMainKeywordMode={() => { void setFilterQuery({ mainKeywordMode: mainKeywordMode === 'or' ? 'and' : 'or' }) }}
          showCollectionFilter={showCollectionFilter}
          onToggleCollectionFilter={() => setShowCollectionFilter(v => !v)}
          collectionLoading={collectionLoading}
          hasCollection={hasCollection}
          filterOwnedIdentity={filterOwnedIdentity}
          filterOwnedEgo={filterOwnedEgo}
          onToggleFilterOwnedIdentity={() => { void toggleFilterOwnedIdentity() }}
          onToggleFilterOwnedEgo={() => { void toggleFilterOwnedEgo() }}
          onClearCollection={clearCollection}
          codeInput={codeInput}
          onCodeInputChange={changeCodeInput}
          onApplyCode={() => applyCollectionCode(codeInput)}
          codeError={codeError}
          formationCount={formationCount}
          onFormationCountChange={value => { void setFilterQuery({ formationCount: value }) }}
          minInfoScore={minInfoScore}
          onMinInfoScoreChange={value => { void setFilterQuery({ minInfoScore: value }) }}
          identityFilterSinners={filterSinners}
          identityFilterIdentities={filterIdentities}
          selectedIdentityIds={selectedIdentityIds}
          selectedIdentities={selectedIdentities}
          identityMode={identityMode}
          onToggleSelectedIdentity={toggleSelectedIdentity}
          onToggleIdentityMode={() => { void setFilterQuery({ identityMode: identityMode === 'or' ? 'and' : 'or' }) }}
          onClearSelectedIdentities={() => { void setFilterQuery({ identityIds: null }) }}
          facetSections={<FacetSections kinds={['affiliation', 'ego']} facets={facetData} selections={facetSelections} onRemove={toggleFacet} onOpen={setFacetModal} />}
        />
        <FacetPickerModal kind={facetModal} facets={facetData} selected={facetModal ? facetSelections[facetModal] : []}
          onToggle={id => { if (facetModal) toggleFacet(facetModal, id) }} onClose={() => setFacetModal(null)} />

        <div ref={scrollRootRef} className="min-h-0 flex-1 pb-16 lg:overflow-y-auto lg:pr-1">
          <BrowseBar
            search={{ value: inputValue, onChange: setInputValue, onClear: () => { setInputValue(''); void setSearch(null, QUERY_OPTIONS); setDebouncedSearch('') }, placeholder: t('search.placeholder'), label: t('search.label') }}
            sort={{ value: sort, options: (['latest', 'popular'] as const).map(key => ({ key, label: t(`sort.${key}`) })), onChange: key => { void setSortQuery(key as SortKey, QUERY_OPTIONS) } }}
            filterCount={advancedFilterCount + (inputValue.trim() ? 1 : 0)}
            onOpenFilters={() => setFilterSignal(value => value + 1)}
            summary={loading ? '' : `${hasMore ? t('result.countMore', { count: filtered.length }) : t('result.countExact', { count: filtered.length })}${refreshing ? t('result.refreshing') : ''}`}
          />

          {/* ── 덱 목록 ── */}
          <BoardResults kind="deck" posts={filtered as RowPost[]} loading={loading} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef}
            empty={(
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-[1rem] text-[var(--text-secondary)]">{hasAnyFilter ? t('grid.noResults') : t('grid.empty')}</p>
                {!hasAnyFilter && <Link href="/decks/new" className="min-h-11 content-center text-[0.9375rem] font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">{t('grid.createFirst')}</Link>}
              </div>
            )} />
        </div>
      </div>
    </div>
  )
}