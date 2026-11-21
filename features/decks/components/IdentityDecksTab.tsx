'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import DeckCard, { DeckSummary } from '@/components/cards/DeckCard'
import SearchBox from '@/components/ui/SearchBox'
import { NoteCardPreview } from '@/features/notes/components/NoteChips'
import { useBoardSuggest } from '../hooks/useBoardSuggest'
const PAGE_SIZE = 12

type SortKey = 'latest' | 'popular'

function getDeckAllKeywords(deck: DeckSummary): string[] {
  const kws = new Set<string>()
  for (const slot of deck.deck_identities ?? []) {
    for (const kw of slot?.identities?.keywords ?? []) {
      kws.add(kw)
    }
  }
  return [...kws]
}

function mapDeck(d: { profiles?: { username?: string } } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined }
}

interface Props {
  identityId: string
}

export default function IdentityDecksTab({ identityId }: Props) {
  const t = useTranslations('identityDecks')
  const tSearch = useTranslations('globalSearch')
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sort, setSort] = useState<SortKey>('latest')
  const [search, setSearch] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // This field has no + or *: the whole query is the word a suggestion completes.
  const searchGroups = useBoardSuggest({ term: search.trim(), pick: setSearch, titles: { keyword: t('keyword') } })

  // 덱 목록 로드 (초기)
  useEffect(() => {
    setLoading(true)
    setDecks([])
    setHasMore(true)
    fetch(`/api/decks?identity_id=${identityId}&sort=${sort}&limit=${PAGE_SIZE}&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDecks(data.map(mapDeck))
          if (data.length < PAGE_SIZE) setHasMore(false)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [identityId, sort])

  // 추가 로드
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetch(`/api/decks?identity_id=${identityId}&sort=${sort}&limit=${PAGE_SIZE}&offset=${decks.length}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          setHasMore(false)
          return
        }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => [...prev, ...data.map(mapDeck)])
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [identityId, sort, decks.length, loadingMore, hasMore])

  // IntersectionObserver 무한 스크롤
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // 태그 클릭 → 검색어 반영
  const handleTagClick = useCallback((tag: string) => {
    setSearch(tag)
  }, [])

  // 필터 적용
  const filtered = useMemo(() => {
    if (!search.trim()) return decks
    const q = search.trim().toLowerCase()
    return decks.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q)) ||
      getDeckAllKeywords(d).some(kw => kw.toLowerCase().includes(q))
    )
  }, [decks, search])

  return (
    <div className="space-y-4">
      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 + 자동완성 */}
        <SearchBox className="flex-1 self-center" value={search} onChange={setSearch} label={t('searchPlaceholder')} clearLabel={tSearch('clear')} groups={searchGroups} />

        {/* 정렬 */}
        <div className="flex gap-1.5">
          {(['latest', 'popular'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-4 py-2.5 rounded text-sm font-medium transition duration-200"
              style={{
                background: sort === s ? 'var(--gold)' : 'transparent',
                color: sort === s ? 'var(--bg-deep)' : '#aaaabb',
                border: `1px solid ${sort === s ? 'var(--gold)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
              }}
            >
              {s === 'latest' ? t('latest') : t('popular')}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 수 */}
      {!loading && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {t('count', { count: filtered.length })}{hasMore && '+'}
          {search.trim() && t('filtered')}
        </p>
      )}

      {/* 덱 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: '10rem', opacity: 0.4 + i * 0.1 }}>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ width: '60%', height: '0.875rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.625rem' }} />
                <div style={{ width: '90%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.375rem' }} />
                <div style={{ width: '70%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div style={{ color: '#8a8095', fontSize: '3rem' }}>⊘</div>
          <p className="font-serif text-base" style={{ color: 'var(--text-tertiary)' }}>
            {search.trim() ? t('noResults') : t('empty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(deck => (
            <DeckCard key={deck.id} deck={deck} onTagClick={handleTagClick} NotePreview={NoteCardPreview} />
          ))}
        </div>
      )}

      {/* 무한 스크롤 센티널 */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#999' }}>
              <div
                className="w-4 h-4 rounded-full animate-spin"
                style={{ border: '2px solid var(--border)', borderTopColor: 'var(--gold)' }}
              />
              {t('loading')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
