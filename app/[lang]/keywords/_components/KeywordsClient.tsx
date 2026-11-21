'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { LayoutList, Grid3X3 } from 'lucide-react'
import { useLocale } from 'next-intl'
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown'
import PageHeader from '@/components/ui/PageHeader'
import SearchBox from '@/components/ui/SearchBox'
import { cutGroup, nameGroup } from '@/components/ui/SearchRows'
import GiftDetailModal from '@/features/mirror-dungeon/components/GiftDetailModal'
import { GiftKeywordTab } from '@/features/mirror-dungeon/components/GiftCatalog'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import KeywordGrid from './KeywordGrid'
import KeywordModal, { type KeywordEgo, type KeywordGift, type KeywordIdentity } from './KeywordModal'
import { keywordDesc, keywordName, kt, type KeywordEntry } from './KeywordCard'
import { keywordEntries, keywordRows } from './keyword-search'
import { search as findHits, type Hit } from '@/lib/search/engine'
import { keepFound } from '@/lib/search/query'
import { gameTextToPlain, refNameLabels } from '@/lib/game-text/rich-text'
import { createGiftMentionMatcher } from '@/lib/keywords/gift-mentions'
import { resolveKeywordIconUrl } from '@/lib/keywords/catalog'
import { giftIdsIn } from '@/lib/game-text/placeholders'
import { useGameTextRefs, wantGameTextRefs } from '@/hooks/useGameTextRefs'

interface Sinner {
  id: string
  name_kr: string
  name_en: string | null
  name_jp: string | null
}

type KeywordCategory = '상태이상' | '버프' | '디버프' | '고유' | '기타'
type SortKey = 'default' | 'name'

const KEYWORD_CATEGORIES: { value: KeywordCategory; key: string }[] = [
  { value: '상태이상', key: 'keyword.category.statusEffect' },
  { value: '버프', key: 'keyword.category.buff' },
  { value: '디버프', key: 'keyword.category.debuff' },
  { value: '고유', key: 'keyword.category.unique' },
  { value: '기타', key: 'keyword.category.other' },
]

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]'

export default function KeywordsClient({
  keywords, identities, sinners, gifts, egos, refKeywords,
}: {
  keywords: KeywordEntry[]
  identities: KeywordIdentity[]
  sinners: Sinner[]
  gifts: KeywordGift[]
  egos: KeywordEgo[]
  /** Game id (`[Id]` of raw game text) → keyword name, for finding the gifts that mention a keyword. */
  refKeywords: Record<string, string>
}) {
  // 키워드 상세는 주소(keyword=이름)로 열고 닫는다: 검색 결과가 바로 그 창으로 온다
  const [keywordParam, setKeywordParam] = useQueryState('keyword', parseAsString.withDefault(''))
  const selected = useMemo(() => keywords.find(k => k.name === keywordParam) ?? null, [keywords, keywordParam])
  const setSelected = useCallback((kw: KeywordEntry | null) => { void setKeywordParam(kw ? kw.name : null) }, [setKeywordParam])
  const [selectedGift, setSelectedGift] = useState<KeywordGift | null>(null)
  const lang = useLocale() as SupportedLang
  const t = (key: string) => kt(key, lang)
  // The gift a gift turns into ({{gift:<game id>}}) shows by name and opens in the same window.
  const giftLinks = (gift: KeywordGift) => {
    const named = giftIdsIn(gift.effect_base, gift.effect_plus, gift.effect_plusplus)
    const targets = named.length ? gifts.filter(g => g.game_id != null && named.includes(g.game_id)).map(g => ({ id: String(g.game_id), gameId: g.game_id, name: g.name, image_url: g.image_url, keyword: g.keyword, onClick: () => setSelectedGift(g) })) : []
    return targets.length ? { targets } : null
  }

  const sortOptions: DropdownOption<SortKey>[] = useMemo(() => [
    { value: 'default', label: kt('keyword.sort.frequency', lang) },
    { value: 'name', label: kt('keyword.sort.name', lang) },
  ], [lang])

  /* ── nuqs URL 상태 ── */
  const [viewMode, setViewMode] = useQueryState('view', parseAsString.withDefault('detail'))
  const [catParam, setCatParam] = useQueryState('cat', parseAsString.withDefault(''))
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [sortParam, setSortParam] = useQueryState('sort', parseAsString.withDefault('default'))

  const selectedCategories = useMemo(
    () => new Set(catParam.split(',').filter(Boolean) as KeywordCategory[]),
    [catParam],
  )
  const sort = (sortParam as SortKey) || 'default'
  const compact = viewMode === 'compact'

  const toggleCategory = useCallback((cat: KeywordCategory) => {
    const next = new Set(selectedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setCatParam(next.size > 0 ? Array.from(next).join(',') : null)
  }, [selectedCategories, setCatParam])

  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    sinners.forEach(s => { map[s.id] = getLocalizedName(s, lang) })
    return map
  }, [sinners, lang])

  /* ── 카운트 맵 ── */
  const identityCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    identities.forEach(id => (id.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 }))
    return map
  }, [identities])

  const egoCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    egos.forEach(ego => (ego.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 }))
    return map
  }, [egos])

  // Descriptions of game text hold [Id]s: the search needs their names, which the reference table gives once it is loaded.
  const { names: refNames } = useGameTextRefs({ lazy: true })
  const refLabels = useMemo(() => (refNames ? refNameLabels(refNames) : undefined), [refNames])
  useEffect(() => { if (search) wantGameTextRefs() }, [search])

  // Keywords each gift's effects mention: by [Id] in game text, by written-out name in the older stored text.
  const giftMentions = useMemo(() => {
    const mentioned = createGiftMentionMatcher(keywords.map(k => k.name), refKeywords)
    return new Map(gifts.map(g => [g, mentioned([g.effect_base, g.effect_plus, g.effect_plusplus])]))
  }, [gifts, keywords, refKeywords])

  const giftCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    gifts.forEach(g => { map[g.keyword] = (map[g.keyword] || 0) + 1 })
    giftMentions.forEach((names, g) => {
      names.forEach(name => { if (name !== g.keyword) map[name] = (map[name] || 0) + 1 })
    })
    return map
  }, [gifts, giftMentions])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    keywords.forEach(kw => { const cat = kw.category || '기타'; map[cat] = (map[cat] || 0) + 1 })
    return map
  }, [keywords])

  /* ── 필터링 + 정렬 ── */
  const listed = useMemo(() => {
    const usage = (name: string) => (identityCountMap[name] || 0) + (egoCountMap[name] || 0) + (giftCountMap[name] || 0)
    return keywords.filter(kw => selectedCategories.size === 0 || selectedCategories.has((kw.category || '기타') as KeywordCategory))
      .sort((a, b) => sort === 'name'
        ? keywordName(a, lang).localeCompare(keywordName(b, lang), lang)
        : usage(b.name) - usage(a.name))
  }, [keywords, selectedCategories, sort, identityCountMap, egoCountMap, giftCountMap, lang])

  // The search: names and plain descriptions. The best match comes first until the person picks a sort (the default one is by use).
  const searching = search.trim() !== ''
  const index = useMemo(() => searching
    ? keywordEntries(keywords, kw => keywordName(kw, lang), kw => gameTextToPlain(keywordDesc(kw, lang), { names: refLabels, locale: lang }), kw => resolveKeywordIconUrl(kw.name, kw.icon_slug))
    : null, [searching, keywords, lang, refLabels])
  const hits = useMemo(() => index ? findHits(index, search) : null, [index, search])
  const filtered = useMemo(() => hits ? keepFound(listed, hits, kw => kw.name, sort !== 'default') : listed, [listed, hits, sort])
  const suggestions = useMemo(() => {
    if (!hits) return []
    const byName = new Map(keywords.map(kw => [kw.name, kw]))
    const open = (hit: Hit) => setSelected(byName.get(hit.entry.href)!)
    const found = keywordRows(hits)
    return [nameGroup(kt('nav.db.keywords', lang), found.names, open), cutGroup(kt('keyword.search.description', lang), found.texts, open)].filter(group => group.rows.length > 0)
  }, [hits, keywords, lang, setSelected])

  /* ── 선택된 키워드의 관련 데이터 ── */
  const related = useMemo(() => {
    if (!selected) return null
    return {
      identities: identities.filter(id => (id.keywords ?? []).includes(selected.name)),
      egos: egos.filter(ego => (ego.keywords ?? []).includes(selected.name)),
      gifts: gifts.filter(g => g.keyword === selected.name || giftMentions.get(g)?.has(selected.name)),
    }
  }, [selected, identities, egos, gifts, giftMentions])

  const closeAll = useCallback(() => { setSelectedGift(null); setSelected(null) }, [])

  return (
    <div className="mx-auto min-h-[100dvh] max-w-7xl px-4 pb-16 pt-[5.5rem] md:px-6">
      <PageHeader title={t('keyword.title')} />

      <div role="search" aria-label={t('keyword.search.aria')} className="sticky-under-nav z-30 -mx-4 mb-4 border-b border-[#2e2417] bg-[var(--bg-deep)] px-4 pb-2 pt-1 md:-mx-6 md:px-6">
        <div role="group" aria-label={t('keyword.filter.categoryAria')} className="-mx-4 flex overflow-x-auto border-b border-[#2e2417] px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <GiftKeywordTab label={t('mirrorDungeon.filter.all')} active={selectedCategories.size === 0} count={keywords.length} onClick={() => setCatParam(null)} />
          {KEYWORD_CATEGORIES.map(cat => (
            <GiftKeywordTab
              key={cat.value}
              label={t(cat.key)}
              active={selectedCategories.has(cat.value)}
              count={categoryCounts[cat.value] || 0}
              onClick={() => toggleCategory(cat.value)}
            />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-x-3">
          <SearchBox
            value={search}
            onChange={value => setSearch(value || null)}
            label={t('keyword.search.placeholder')}
            clearLabel={t('keyword.search.clearAria')}
            groups={suggestions}
            className="min-w-0 basis-full sm:basis-auto sm:w-[16rem]"
          />

          <p aria-live="polite" className="mr-auto text-[0.8125rem] tabular-nums text-[#9c8b73] sm:ml-auto sm:mr-0">
            {filtered.length !== keywords.length
              ? t('keyword.count.filtered').replace('{filtered}', String(filtered.length)).replace('{total}', String(keywords.length))
              : t('keyword.count.total').replace('{count}', String(keywords.length))}
          </p>

          <div role="group" className="flex h-9 overflow-hidden rounded border border-[#2e2417]">
            {([['detail', LayoutList, 'keyword.view.detail'], ['compact', Grid3X3, 'keyword.view.compact']] as const).map(([mode, Icon, label]) => {
              const active = mode === 'compact' ? compact : !compact
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode === 'detail' ? null : mode)}
                  aria-label={t(label)}
                  aria-pressed={active}
                  title={t(label)}
                  className={`flex w-9 items-center justify-center transition-colors hover:text-[var(--text-primary)] ${FOCUS_RING}`}
                  style={{ background: active ? 'rgba(200,144,10,0.14)' : 'transparent', color: active ? 'var(--gold-light)' : '#9c8b73' }}
                >
                  <Icon size={15} aria-hidden />
                </button>
              )
            })}
          </div>

          <Dropdown
            value={sort}
            options={sortOptions}
            onChange={v => setSortParam(v === 'default' ? null : v)}
            prefix={t('keyword.sort.prefix')}
            defaultValue={'default' as SortKey}
            buttonStyle={{ minHeight: '2.25rem', fontSize: '0.8125rem' }}
          />
        </div>
      </div>

      <KeywordGrid
        keywords={filtered}
        countMaps={{ identity: identityCountMap, ego: egoCountMap, gift: giftCountMap }}
        onSelect={setSelected}
        viewMode={compact ? 'compact' : 'detail'}
        lang={lang}
      />

      {selected && related && !selectedGift && (
        <KeywordModal
          keyword={selected}
          categoryLabel={t(KEYWORD_CATEGORIES.find(c => c.value === (selected.category || '기타'))?.key ?? 'keyword.category.other')}
          relatedIdentities={related.identities}
          relatedEgos={related.egos}
          relatedGifts={related.gifts}
          sinnerNameMap={sinnerNameMap}
          onSelectGift={setSelectedGift}
          onClose={closeAll}
          lang={lang}
        />
      )}
      {selected && selectedGift && (
        <GiftDetailModal
          gift={{
            name: selectedGift.name,
            art: selectedGift,
            keyword: selectedGift.keyword,
            effects: [selectedGift.effect_base, selectedGift.effect_plus, selectedGift.effect_plusplus],
            giftLinks: giftLinks(selectedGift),
          }}
          lang={lang}
          onClose={closeAll}
          back={{ name: keywordName(selected, lang), image: resolveKeywordIconUrl(selected.name, selected.icon_slug), onClick: () => setSelectedGift(null) }}
        />
      )}
    </div>
  )
}
