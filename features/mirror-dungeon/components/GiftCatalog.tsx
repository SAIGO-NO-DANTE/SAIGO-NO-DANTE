'use client'

import { useMemo, useEffect, useLayoutEffect, useRef, useCallback, useState, useDeferredValue, memo, type ReactNode } from 'react'
import Image from 'next/image'
import { X, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { search as findHits } from '@/lib/search/engine'
import { refNameLabels } from '@/lib/game-text/rich-text'
import { useGameTextRefs, wantGameTextRefs } from '@/hooks/useGameTextRefs'
import Dropdown from '@/components/ui/Dropdown'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { GiftWarningMark } from '@/features/mirror-dungeon/components/GiftCard'
import GiftSearchBox from '@/features/mirror-dungeon/components/GiftSearchBox'
import { giftEntries } from '@/features/mirror-dungeon/lib/search-suggestions'
import type { EgoGift, EgoGiftTheme } from '@/features/mirror-dungeon/types'
import { KEYWORD_COLORS, GRADE_LABELS, GRADES } from '@/features/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import { getGiftKeywordIconUrl, getGiftKeywordSlug } from '@/lib/constants/gift'
import { GIFT_KEYWORD_ORDER } from '@/features/mirror-dungeon/lib/gift-check'
import { PINNED_GROUP, countGiftGroups, filterAndSortGifts, groupGifts } from '@/features/mirror-dungeon/lib/gift-catalog-sort'
import SuggestionRibbon from '@/components/ui/SuggestionRibbon'
import GiftGrade from '@/components/ui/GiftGrade'

const PAGE_SIZE = 40

/** '난이도:' 같은 기존 접두어 번역에서 콜론을 떼어 칩 이름으로 쓴다. */
const filterName = (prefix: string) => prefix.replace(/\s*[:：]\s*$/, '')

const KEYWORD_LABEL_KEYS: Record<string, string> = {
  '전체': 'mirrorDungeon.filter.all', '화상': 'mirrorDungeon.filter.combustion', '출혈': 'mirrorDungeon.filter.laceration',
  '진동': 'mirrorDungeon.filter.vibration', '파열': 'mirrorDungeon.filter.burst', '침잠': 'mirrorDungeon.filter.sinking',
  '호흡': 'mirrorDungeon.filter.breath', '충전': 'mirrorDungeon.filter.charge', '참격': 'mirrorDungeon.filter.slash',
  '관통': 'mirrorDungeon.filter.pierce', '타격': 'mirrorDungeon.filter.blunt', '공통': 'mirrorDungeon.filter.common',
}

/** 기프트 키워드 탭 이름('화상', '공통' …)을 언어에 맞게 돌려준다. */
export function giftKeywordLabel(key: string, lang: SupportedLang): string {
  const entry = translations[KEYWORD_LABEL_KEYS[key] as keyof typeof translations] as Record<string, string> | undefined
  return entry?.[lang] ?? entry?.ko ?? key
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)]'

/** 키워드 밑줄 탭 하나. 미러 던전 기프트 목록과 플래너 최종 기프트가 같이 쓴다. color가 없으면 '전체' 탭. */
export function GiftKeywordTab({ label, iconUrl, color, active, count, onClick }: {
  label: string; iconUrl?: string | null; color?: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[2.5rem] max-sm:min-h-11 shrink-0 items-center gap-1.5 px-2.5 text-[0.8125rem] transition-colors hover:text-[var(--text-primary)] md:px-3 ${FOCUS_RING}`}
      style={{
        cursor: 'pointer',
        color: active ? 'var(--text-primary)' : '#9c8b73',
        fontFamily: 'var(--font-heading)',
        borderBottom: `2px solid ${active ? color ?? 'var(--gold)' : 'transparent'}`,
        marginBottom: '-1px',
        background: active && color ? `${color}1f` : 'transparent',
      }}
    >
      {iconUrl && <KeywordImage src={iconUrl} size={16} dim={!active} />}
      {label}
      {count !== undefined && <span className="tabular-nums" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: active ? '#b9aa98' : 'var(--text-muted)' }}>{count}</span>}
    </button>
  )
}

/** 등급 칩(Ⅰ~EX) 하나. */
export function GiftGradeChip({ grade, ariaLabel, active, count, onClick }: {
  grade: string; ariaLabel: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={count === undefined ? ariaLabel : `${ariaLabel} ${count}`}
      onClick={onClick}
      className={`inline-flex h-9 max-sm:h-11 min-w-[2.125rem] flex-1 items-center justify-center gap-1 rounded px-1.5 text-[1rem] leading-none transition-colors hover:text-[var(--text-primary)] sm:flex-none ${FOCUS_RING}`}
      style={{
        fontFamily: 'var(--font-title)',
        letterSpacing: '0.04em',
        color: active ? 'var(--gold-light)' : '#9c8b73',
        background: active ? 'rgba(200,144,10,0.14)' : 'transparent',
      }}
    >
      <GiftGrade grade={grade} style={{ fontSize: '1.125rem', opacity: active ? 1 : 0.55 }} />
      {count !== undefined && <span className="tabular-nums" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: 0, color: active ? '#b9aa98' : 'var(--text-muted)' }}>{count}</span>}
    </button>
  )
}

/** 키워드 아이콘. 목록이 다시 그려질 때 next/image를 매번 다시 계산하지 않게 memo한다. */
const KeywordImage = memo(function KeywordImage({ src, size, dim = false }: { src: string; size: number; dim?: boolean }) {
  return <Image src={src} alt="" width={size} height={size} style={{ opacity: dim ? 0.55 : 1, width: `${size / 16}rem`, height: `${size / 16}rem` }} />
})

// 목록을 품은 가장 가까운 세로 스크롤 상자(내용이 넘치는 것만). 없으면 null = 창.
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/** 미선택이면 필터 이름만, 선택하면 값과 지우기(×)를 보여 주는 칩. */
export function FilterChip({ label, clearLabel, value, options, onChange, minWidth }: {
  label: string; clearLabel: string; value: string | null; options: { value: string; label: string }[]; onChange: (value: string | null) => void; minWidth: number
}) {
  const set = value !== null
  return (
    <div
      className={`flex min-w-0 max-w-[13rem] shrink-0 items-stretch rounded border ${set ? '[&>div>button>svg]:hidden' : ''}`}
      style={{ borderColor: set ? 'rgba(200,144,10,0.45)' : '#2e2417', background: set ? 'rgba(200,144,10,0.08)' : 'transparent' }}
    >
      <Dropdown
        ariaLabel={label}
        // 옵션에 없는 값(label)을 넘기면 Dropdown이 그 값을 그대로 표시한다 → 미선택 칩은 필터 이름만 보인다.
        value={value ?? label}
        options={options}
        onChange={onChange}
        minWidth={minWidth}
        className="min-w-0"
        buttonStyle={{ minHeight: '2.125rem', maxWidth: '100%', borderWidth: 0, background: 'transparent', padding: set ? '0 0.125rem 0 0.625rem' : '0 0.5rem 0 0.625rem', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: set ? 'var(--gold-light)' : '#9c8b73' }}
      />
      {set && (
        <button
          type="button"
          aria-label={`${label} ${clearLabel}`}
          onClick={() => onChange(null)}
          className="flex w-7 shrink-0 items-center justify-center text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  )
}

type SetFilter = (fn: Set<string> | ((prev: Set<string>) => Set<string>)) => void

/** URL-synced filter state owned by the page. */
export interface GiftCatalogFilters {
  search: string
  keywords: Set<string>
  grades: Set<string>
  tiers: Set<string>
  sortBy: 'default' | 'name' | 'grade'
  sortDesc: boolean
  slotFilter: string
  selectedThemeId: number | null
  themeGiftNames: Set<string> | null
  giftSlotMap: Map<string, Set<number>>
  inputValue: string
  setInputValue: (v: string) => void
  setSearch: (v: string) => void
  setKeywords: SetFilter
  setGrades: SetFilter
  setTiers: SetFilter
  setSortBy: (v: 'default' | 'name' | 'grade') => void
  setSortDesc: (v: boolean | ((prev: boolean) => boolean)) => void
  setSlotFilter: (v: string) => void
  setSelectedThemeId: (v: number | null) => void
}

const noop = () => {}
/** Used when no filters are passed: everything shown, grouped by keyword. */
const NO_FILTERS: GiftCatalogFilters = {
  search: '', keywords: new Set(), grades: new Set(), tiers: new Set(), sortBy: 'default', sortDesc: false, slotFilter: '전체',
  selectedThemeId: null, themeGiftNames: null, giftSlotMap: new Map(), inputValue: '',
  setInputValue: noop, setSearch: noop, setKeywords: noop, setGrades: noop, setTiers: noop, setSortBy: noop, setSortDesc: noop, setSlotFilter: noop, setSelectedThemeId: noop,
}

/** Component-local filter state (keyword, grade, search) for catalogs outside the Mirror Dungeon page. */
export function useGiftCatalogFilters(): GiftCatalogFilters {
  const [search, setSearch] = useState('')
  const [keywords, setKeywords] = useState<Set<string>>(() => new Set())
  const [grades, setGrades] = useState<Set<string>>(() => new Set())
  return useMemo(() => ({
    ...NO_FILTERS, search, keywords, grades, inputValue: search,
    setInputValue: setSearch, setSearch, setKeywords, setGrades,
  }), [search, keywords, grades])
}

/** Planner gift in the catalog's shape. id is the game id as a string. */
export function toCatalogGift(gift: GiftData): EgoGift {
  const keyword = !gift.keyword || gift.keyword.startsWith('공통') ? '공통' : gift.keyword
  return { ...gift, id: String(gift.game_id), keyword, grade: gift.grade ?? '1', is_synthesis: false, difficulty: null } as unknown as EgoGift
}

/** Keyword icon for toCatalogGift gifts. */
export const giftKeywordIcon = (keyword: string) => getGiftKeywordIconUrl(getGiftKeywordSlug(keyword) ?? 'general')

/** Per-card GiftCard options (disabled with a reason, condition overlay, remove button). */
export interface GiftCatalogCardProps {
  disabled?: boolean
  title?: string
  ariaLabel?: string
  conditionStatus?: import('@/lib/planner/gift-condition-status').GiftConditionStatus | null
  conditionDetail?: boolean
  /** Red warning mark with this reason (e.g. only obtainable on this floor). */
  warning?: string
  onRemove?: () => void
}

interface GiftCatalogProps {
  gifts: EgoGift[]
  themes?: EgoGiftTheme[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onGiftClick: (gift: EgoGift) => void
  /** Omit for an unfiltered catalog; the toolbar is hidden too. */
  filters?: GiftCatalogFilters
  hideFilters?: boolean
  /** Smaller cells without names; the toolbar sticks to the nearest scroller's top and keeps only keyword, search and grade. */
  compact?: boolean
  selectedIds?: ReadonlySet<string>
  /** Dimmed with a check (e.g. acquired). */
  markedIds?: ReadonlySet<string>
  /** Screen-reader suffix for marked gifts. */
  markedLabel?: string
  /** Overlay drawn above each card, outside its button (e.g. an info button). */
  renderBadge?: (gift: EgoGift) => ReactNode
  cardProps?: (gift: EgoGift) => GiftCatalogCardProps | undefined
  /** Keyword tab and keyword group order; the default is GIFT_KEYWORD_ORDER. */
  keywordOrder?: readonly string[]
  /** Group by keyword (or by `pinned`, when given) and keep the order of `gifts` inside each group (no grade sorting,
   *  no sort control). */
  keepOrder?: boolean
  /** Control pinned to the end of the keyword tab row (e.g. the keyword order button). */
  keywordsEnd?: ReactNode
  /** Extra controls at the end of the toolbar. On phones a compact catalog gives them a row of their own; otherwise
   *  they share the search row while they fit. */
  toolbarEnd?: ReactNode
  /** For a narrow column: the grades and `moreFilters` stay behind the filter button at every width (not only on phones),
   *  and `toolbarEnd` sits on the search row. */
  collapsed?: boolean
  /** Extra controls inside what the filter button opens (with `collapsed`). */
  moreFilters?: ReactNode
  /** How many of `moreFilters` are on, added to the count on the filter button. */
  moreFiltersActive?: number
  /** Shown instead of the grid until a keyword, grade or search narrows the list. */
  idleHint?: ReactNode
  /** Groups listed first, in this order, each under its own heading; a gift sits in the first group that has it.
   *  `warning` draws the red mark (e.g. gifts only this floor gives); `note` is a line of the user's own under the heading. */
  /** Shown above the groups while a pinned group is still being read (its loading shape). */
  holdPlace?: ReactNode
  pinned?: { ids: ReadonlySet<string>; label: string; warning?: boolean; note?: string; /** Heading as the gold "추천" ribbon instead of the label text. */ ribbon?: boolean }[]
}

type GiftItemProps = {
  gift: EgoGift
  onSelect: (gift: EgoGift) => void
  lang: SupportedLang
  compact?: boolean
  isSelected?: boolean
  isMarked?: boolean
  markedLabel?: string
  badge?: ReactNode
  extra?: GiftCatalogCardProps
}

const shallowEqual = (a?: object, b?: object) => {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}

// cardProps는 칸마다 새 객체를 만든다: 내용이 같으면 다시 그리지 않는다(기프트 하나를 눌러도 448칸이 다시 그려지던 지연)
const sameGiftItem = (prev: GiftItemProps, next: GiftItemProps) =>
  (Object.keys(next) as (keyof GiftItemProps)[]).every(key => key === 'extra' || prev[key] === next[key]) &&
  shallowEqual(prev.extra, next.extra)

const MemoGiftItem = memo(function MemoGiftItem({
  gift,
  onSelect,
  lang,
  compact,
  isSelected,
  isMarked,
  markedLabel,
  badge,
  extra,
}: GiftItemProps) {
  const localizedGift = useMemo(() => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  }), [gift, lang])
  const handleClick = useCallback(() => onSelect(gift), [gift, onSelect])
  const card = <GiftCard gift={localizedGift} giftId={gift.id} onClick={handleClick} showName={!compact} isSelected={isSelected}
    ariaLabel={isMarked && markedLabel ? `${localizedGift.name}, ${markedLabel}` : undefined} {...extra} />
  if (!isMarked && !badge) return card
  return (
    <div className="relative">
      <div style={isMarked ? { opacity: 0.35, filter: 'grayscale(0.7)' } : undefined}>{card}</div>
      {isMarked && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 grid aspect-square place-items-center">
          <svg viewBox="0 0 24 24" className="h-[42%] w-[42%] drop-shadow-[0_0_0.25rem_rgba(0,0,0,0.9)]">
            <circle cx="12" cy="12" r="11" fill="#17120c" stroke="#c8900a" strokeWidth="1.5" />
            <path d="M6.5 12.4 10.2 16 17.5 8.2" fill="none" stroke="#e8b030" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {badge}
    </div>
  )
}, sameGiftItem)
/** One catalog cell, for a list drawn outside the catalog (the check window). */
export { MemoGiftItem as GiftCatalogItem }

type GiftCell = Omit<GiftItemProps, 'onSelect' | 'lang' | 'compact' | 'markedLabel'>
type GiftGridProps = Pick<GiftItemProps, 'onSelect' | 'lang' | 'compact' | 'markedLabel'> & { cells: GiftCell[] }

// 칸 목록을 묶음마다 비교해 누른 기프트가 없는 묶음은 칸 요소도 만들지 않는다
const GiftGrid = memo(function GiftGrid({ cells, onSelect, lang, compact, markedLabel }: GiftGridProps) {
  return cells.map(cell => (
    <MemoGiftItem key={cell.gift.id} {...cell} onSelect={onSelect} lang={lang} compact={compact} markedLabel={markedLabel} />
  ))
}, (prev, next) =>
  prev.onSelect === next.onSelect && prev.lang === next.lang && prev.compact === next.compact && prev.markedLabel === next.markedLabel &&
  prev.cells.length === next.cells.length &&
  prev.cells.every((cell, i) => {
    const other = next.cells[i]
    return cell.gift === other.gift && cell.isSelected === other.isSelected && cell.isMarked === other.isMarked &&
      cell.badge === other.badge && shallowEqual(cell.extra, other.extra)
  }))

/** Keyword tabs, toolbar and grouped gift grid used by the Mirror Dungeon gift list. */
export default function GiftCatalog({
  gifts,
  themes = [],
  getGiftKeywordIcon,
  onGiftClick,
  filters,
  hideFilters = false,
  compact = false,
  selectedIds,
  markedIds,
  markedLabel,
  renderBadge,
  cardProps,
  keywordOrder = GIFT_KEYWORD_ORDER,
  keepOrder = false,
  keywordsEnd,
  toolbarEnd,
  collapsed = false,
  moreFilters,
  moreFiltersActive = 0,
  idleHint,
  pinned,
  holdPlace,
}: GiftCatalogProps) {
  const {
    search, keywords, grades, tiers, sortBy, sortDesc, slotFilter, themeGiftNames, giftSlotMap, inputValue,
    setInputValue, setSearch, setKeywords, setGrades, setTiers, setSortBy, setSortDesc, setSlotFilter, selectedThemeId, setSelectedThemeId,
  } = filters ?? NO_FILTERS
  const showToolbar = !hideFilters && filters != null
  // 부모가 선택 상태마다 새 클릭 함수를 넘겨도 칸들은 같은 함수를 받는다
  const onGiftClickRef = useRef(onGiftClick)
  useLayoutEffect(() => { onGiftClickRef.current = onGiftClick })
  const selectGift = useCallback((gift: EgoGift) => onGiftClickRef.current(gift), [])
  const locale = useLocale()
  const lang = locale as SupportedLang
  const tp = useTranslations('mirrorDungeonPage')
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>)['ko'] ?? key
  }

  const keywordLabels = useMemo(() => Object.fromEntries(['전체', ...GIFT_KEYWORD_ORDER].map(key => [key, giftKeywordLabel(key, lang)])), [lang])

  const toggleKeyword = useCallback(
    (key: string) => {
      setKeywords(prev => {
        if (key === '전체') return new Set()
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [setKeywords]
  )

  const toggleGrade = useCallback(
    (g: string) => {
      setGrades(prev => {
        if (g === '전체') return new Set()
        const next = new Set(prev)
        if (next.has(g)) next.delete(g)
        else next.add(g)
        return next
      })
    },
    [setGrades]
  )

  const query = search.trim().toLocaleLowerCase()
  // The gift index is built once something is typed. Effects of raw game text hold [Id]s: they are read as the names the
  // screen shows, so the index is rebuilt when that table arrives.
  const typed = inputValue.trim() !== '' || query !== ''
  const { names: refNames } = useGameTextRefs({ lazy: true })
  useEffect(() => { if (typed) wantGameTextRefs() }, [typed])
  const entries = useMemo(
    () => typed ? giftEntries(gifts, lang, key => keywordLabels[key] ?? key, refNames ? refNameLabels(refNames) : undefined) : null,
    [typed, gifts, lang, keywordLabels, refNames],
  )
  // Gift id -> place in the engine's order; null when nothing is searched
  const ranks = useMemo(() => query && entries ? new Map(findHits(entries, query).map((hit, i) => [hit.entry.href, i])) : null, [entries, query])
  const filtered = useMemo(() => {
    return filterAndSortGifts(gifts, { keywords, grades, tiers, ranks, sortBy, sortDesc, slotFilter, themeGiftNames, giftSlotMap, pinned, keywordOrder, keepOrder })
  }, [gifts, keywords, grades, tiers, ranks, sortBy, sortDesc, themeGiftNames, slotFilter, giftSlotMap, pinned, keywordOrder, keepOrder])

  const deferredFiltered = useDeferredValue(filtered)
  const isStale = deferredFiltered !== filtered

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Back to the first page only when the user changes a filter. Parents often rebuild the gifts array on every
  // render (picking a gift re-renders them); resetting then shortened the list and threw the scroll back up.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    loadingRef.current = false
  }, [keywords, grades, tiers, query, sortBy, sortDesc, themeGiftNames, slotFilter])

  const visibleGifts = useMemo(() => deferredFiltered.slice(0, visibleCount), [deferredFiltered, visibleCount])

  // 도구줄이 붙어 있을 만큼 내려간 상태에서 필터를 바꾸면 결과 첫 줄을 도구줄 바로 아래에 둔다(목록이 줄며 페이지가 튀지 않게).
  // 따로 스크롤되는 상자 안이면 그 상자를, 아니면 창을 움직인다(compact는 --gift-catalog-sticky-top을 준 페이지 흐름 배치일 때만 창).
  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  // 기프트 선택으로 gifts가 바뀔 때는 움직이지 않도록 필터 값에만 반응한다.
  const filterMountedRef = useRef(false)
  useLayoutEffect(() => {
    if (!filterMountedRef.current) { filterMountedRef.current = true; return }
    const root = rootRef.current
    const toolbar = toolbarRef.current
    if (!root || !toolbar) return
    const scroller = compact ? scrollParent(root) : null
    if (compact && !scroller && !getComputedStyle(root).getPropertyValue('--gift-catalog-sticky-top')) return
    const stuckTop = parseFloat(getComputedStyle(toolbar).top) || 0
    const rootTop = root.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0)
    if (rootTop < stuckTop - 1) (scroller ?? window).scrollBy(0, rootTop - stuckTop)
  }, [compact, keywords, grades, tiers, query, sortBy, sortDesc, slotFilter, themeGiftNames])

  // 기본 정렬 = 키워드별, 등급 정렬 = 등급별 묶음. 이름 정렬은 한 덩어리.
  // A search in the default sort lists the gifts in the engine's order, as one run.
  const groupBy: 'keyword' | 'grade' | null = keepOrder || (!ranks && sortBy === 'default') ? 'keyword' : sortBy === 'grade' ? 'grade' : null
  const groupCounts = useMemo(() => countGiftGroups(deferredFiltered, groupBy, pinned), [deferredFiltered, groupBy, pinned])
  const groups = useMemo(() => groupGifts(visibleGifts, groupBy, pinned), [visibleGifts, groupBy, pinned])

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  // 모바일 '필터' 버튼 숫자: 시트 안에 접힌 등급·난이도·편성·테마팩 중 켜진 수
  const mobileFilterCount = (grades.size > 0 ? 1 : 0) + (tiers.size > 0 ? 1 : 0) + (slotFilter !== '전체' ? 1 : 0) + (selectedThemeId !== null ? 1 : 0) + moreFiltersActive
  const hasActiveFilters = keywords.size > 0 || grades.size > 0 || tiers.size > 0 || slotFilter !== '전체' || selectedThemeId !== null

  const filteredLenRef = useRef(deferredFiltered.length)
  filteredLenRef.current = deferredFiltered.length

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    loadingRef.current = false
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) {
          loadingRef.current = true
          setVisibleCount(prev => {
            const next = Math.min(prev + PAGE_SIZE, filteredLenRef.current)
            setTimeout(() => { loadingRef.current = false }, 100)
            return next
          })
        }
      },
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [deferredFiltered, visibleCount])

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)]'

  return (
    <div ref={rootRef} className={compact ? undefined : 'mb-8'}>
      {/* 필터 — 스크롤해도 상단에 붙어 있음 */}
      {showToolbar && <div
        ref={toolbarRef}
        role="search"
      aria-label={tp('giftFilters')}
        className={compact ? 'sticky z-10 pb-2 nav-slide' : 'sticky-under-nav z-30 -mx-4 px-4 pt-1 pb-2 md:-mx-6 md:px-6'}
        style={{ top: compact ? 'var(--gift-catalog-sticky-top, 0px)' : undefined, background: compact ? 'var(--gift-catalog-bg, var(--bg-deep))' : 'var(--bg-deep)', borderBottom: '1px solid #2e2417' }}
      >
        {/* 키워드 */}
        <div className={`flex ${compact ? '' : '-mx-4 md:mx-0'}`} style={{ borderBottom: '1px solid #2e2417' }}>
          <div className={`flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? '' : 'px-4 md:px-0'}`}>
          {['전체', ...keywordOrder].map(key => {
            const isAll = key === '전체'
            return (
              <GiftKeywordTab
                key={key}
                label={keywordLabels[key] ?? key}
                iconUrl={isAll ? null : getGiftKeywordIcon(key)}
                color={isAll ? undefined : KEYWORD_COLORS[key] ?? '#9c8b73'}
                active={isAll ? keywords.size === 0 : keywords.has(key)}
                onClick={() => toggleKeyword(key)}
              />
            )
          })}
          </div>
          {/* Outside the scrolling tabs, so it stays at the row's right edge. */}
          {keywordsEnd && <div className={`flex shrink-0 items-center ${compact ? '' : 'pr-2 md:pr-0'}`}>{keywordsEnd}</div>}
        </div>

        {/* 검색 · 등급 · 세부 필터 · 결과 수 · 정렬 — 한 줄. 모바일은 검색과 필터 버튼만 두고 나머지는 시트로 */}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-x-3">
          {/* The phone basis is what lets a wide toolbarEnd wrap to its own row instead of squeezing the search box. */}
          <GiftSearchBox
            gifts={gifts}
            entries={entries}
            keywordOrder={keywordOrder}
            keywordLabels={keywordLabels}
            getGiftKeywordIcon={getGiftKeywordIcon}
            usable={gift => !cardProps?.(gift)?.disabled && !selectedIds?.has(gift.id)}
            onPick={selectGift}
            value={inputValue}
            onChange={value => { setInputValue(value); if (!value) setSearch('') }}
            label={t('mirrorDungeon.search.placeholder')}
            clearLabel={t('mirrorDungeon.filter.reset')}
            className={`min-w-0 flex-1 ${collapsed ? 'basis-32' : `${compact ? '' : 'basis-24 '}sm:w-[13rem] sm:flex-none`}`}
          />

          {collapsed && toolbarEnd && <div className="flex shrink-0 items-center gap-x-3">{toolbarEnd}</div>}

          <button
            type="button"
            aria-expanded={mobileFiltersOpen}
            aria-controls="md-gift-more-filters"
            onClick={() => setMobileFiltersOpen(v => !v)}
            className={`flex h-9 max-sm:h-11 shrink-0 items-center gap-1.5 rounded border px-3 text-[0.8125rem] ${collapsed ? '' : 'sm:hidden'} ${focusRing}`}
            style={{
              fontFamily: 'var(--font-heading)',
              color: mobileFilterCount > 0 || mobileFiltersOpen ? 'var(--gold-light)' : '#9c8b73',
              borderColor: mobileFilterCount > 0 ? 'rgba(200,144,10,0.45)' : '#2e2417',
            }}
          >
            <SlidersHorizontal size={14} aria-hidden />
            {tp('moreFilters')}
            {mobileFilterCount > 0 && <span className="tabular-nums">{mobileFilterCount}</span>}
          </button>

          <p className={`shrink-0 text-[0.8125rem] tabular-nums text-[#9c8b73] ${collapsed ? '' : 'sm:order-1 sm:ml-auto'}`} aria-live="polite">
            <span className="text-[var(--text-primary)]">{filtered.length}</span>{lang === 'en' ? ' ' : ''}{tp('giftUnit')}
          </p>

          {/* 모바일에서는 접히는 시트, sm 이상에서는 display:contents로 같은 줄에 풀린다. collapsed면 어느 폭에서나 접힌다. */}
          <div
            id="md-gift-more-filters"
            className={`${mobileFiltersOpen ? 'flex' : 'hidden'} basis-full flex-wrap items-center gap-x-4 gap-y-2 rounded border border-[#2e2417] bg-[#17120c] p-2.5 ${collapsed ? '' : `${compact ? '' : 'max-sm:order-1 '}sm:contents`}`}
          >
            <div role="group" aria-label={t('mirrorDungeon.filter.grade')} className={`flex w-full items-center gap-0.5 ${collapsed ? '' : 'sm:w-auto'}`}>
              {GRADES.filter(g => g !== '전체').map(g => (
                <GiftGradeChip
                  key={g}
                  grade={g}
                  ariaLabel={`${t('mirrorDungeon.filter.grade')} ${GRADE_LABELS[g] ?? g}`}
                  active={grades.has(g)}
                  onClick={() => toggleGrade(g)}
                />
              ))}
            </div>

            {collapsed && moreFilters}

            {!compact && <>
            <span aria-hidden className="hidden h-5 w-px bg-[#2e2417] sm:block" />

            <FilterChip
              label={filterName(t('mirrorDungeon.filter.difficulty'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={tiers.size === 0 ? null : [...tiers][0]}
              options={[
                { value: '노말', label: t('mirrorDungeon.tier.normal') },
                { value: '하드', label: t('mirrorDungeon.tier.hard') },
                { value: '익스트림', label: t('mirrorDungeon.tier.extreme') },
              ]}
              onChange={v => setTiers(v === null ? new Set() : new Set([v]))}
              minWidth={120}
            />
            <FilterChip
              label={filterName(t('mirrorDungeon.filter.slotPrefix'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={slotFilter === '전체' ? null : slotFilter}
              options={Array.from({ length: 8 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}${t('mirrorDungeon.filter.slot')}` }))}
              onChange={v => setSlotFilter(v ?? '전체')}
              minWidth={120}
            />
            <FilterChip
              label={filterName(t('mirrorDungeon.filter.themePrefix'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={selectedThemeId === null ? null : String(selectedThemeId)}
              options={themes.map(theme => ({ value: String(theme.id), label: getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang) }))}
              onChange={v => setSelectedThemeId(v === null ? null : Number(v))}
              minWidth={200}
            />
            </>}

            {(hasActiveFilters || inputValue || search) && (
              <button
                type="button"
                onClick={() => {
                  setKeywords(new Set())
                  setGrades(new Set())
                  setTiers(new Set())
                  setSlotFilter('전체')
                  setSelectedThemeId(null)
                  setInputValue('')
                  setSearch('')
                }}
                className={`h-9 max-sm:h-11 shrink-0 px-1 text-[0.8125rem] text-[#9c8b73] underline-offset-2 hover:text-[var(--text-primary)] hover:underline ${focusRing}`}
              >
                {t('mirrorDungeon.filter.reset')}
              </button>
            )}

            {/* 정렬: 조용한 드롭다운. 이름·등급 정렬만 방향을 뒤집을 수 있다. */}
            {!compact && !keepOrder && <div className="ml-auto flex items-center sm:order-2 sm:ml-0">
              <Dropdown
                ariaLabel={tp('sort')}
                value={sortBy}
                options={[
                  { value: 'default', label: tp('sortKeyword') },
                  { value: 'name', label: t('mirrorDungeon.sort.name') },
                  { value: 'grade', label: t('mirrorDungeon.sort.grade') },
                ]}
                onChange={v => {
                  if (v === sortBy) return
                  setSortBy(v)
                  setSortDesc(false)
                }}
                minWidth={120}
                buttonStyle={{ minHeight: '2.25rem', borderWidth: 0, background: 'transparent', padding: '0 0.375rem', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#9c8b73' }}
              />
              {sortBy !== 'default' && (
                <button
                  type="button"
                  aria-label={tp('sortReverse')}
                  aria-pressed={sortDesc}
                  onClick={() => setSortDesc(v => !v)}
                  className={`flex h-9 max-sm:h-11 w-7 items-center justify-center rounded text-[#9c8b73] hover:text-[var(--text-primary)] ${focusRing}`}
                >
                  {sortDesc ? <ArrowDown size={13} aria-hidden /> : <ArrowUp size={13} aria-hidden />}
                </button>
              )}
            </div>}
          </div>
          {!collapsed && toolbarEnd && <div className={`flex ${compact ? 'basis-full' : 'ml-auto'} flex-wrap items-center gap-x-3 gap-y-1 sm:order-3 sm:ml-0 sm:basis-auto`}>{toolbarEnd}</div>}
        </div>
      </div>}

      {/* 그리드 */}
      {idleHint && !keywords.size && !grades.size && !query ? (
        <div className="py-6 text-center text-[0.8125rem]" style={{ color: '#9c8b73' }}>{idleHint}</div>
      ) : deferredFiltered.length === 0 ? (
        <div className={`${compact ? 'py-8' : 'py-20'} text-center`} style={{ minHeight: compact ? 'var(--gift-catalog-min-h)' : undefined }}>
          <p className="mb-2 text-lg" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>{t('mirrorDungeon.empty.title')}</p>
          <p className="text-sm" style={{ color: '#9c8b73' }}>{t('mirrorDungeon.empty.description')}</p>
        </div>
      ) : (
        // isolate: cards raise themselves on hover (z-index 10) and carry marks up to z-30; kept inside this stacking
        // context they scroll under the sticky filter row whatever its z-index is.
        <div className="mt-4 isolate" style={{ minHeight: compact ? 'var(--gift-catalog-min-h)' : undefined, opacity: isStale ? 0.7 : 1, transition: 'opacity 0.1s ease' }}>
          {holdPlace}
          {groups.map((group, gi) => {
            const iconUrl = groupBy === 'keyword' ? getGiftKeywordIcon(group.key) : null
            const pin = group.key.startsWith(PINNED_GROUP) ? pinned?.[Number(group.key.slice(PINNED_GROUP.length))] : undefined
            const isPinned = pin !== undefined
            return (
              <section key={`${group.key}-${gi}`} className="mb-5" aria-label={pin ? pin.label : groupBy ? (groupBy === 'keyword' ? keywordLabels[group.key] ?? group.key : `${t('mirrorDungeon.filter.grade')} ${GRADE_LABELS[group.key] ?? group.key}`) : undefined}>
                {(groupBy || isPinned) && (
                  <h2 className="mb-2 flex items-center gap-2" style={{ borderBottom: pin?.warning ? '1px solid rgba(189,36,48,0.45)' : pin ? '1px solid rgba(200,144,10,0.35)' : '1px solid #2e2417', paddingBottom: '0.375rem' }}>
                    {pin ? (
                      <>
                        {pin.warning && <span className="relative inline-block h-[1.125rem] w-[1.125rem] shrink-0"><GiftWarningMark label={pin.label} className="inset-0 h-full w-full" /></span>}
                        {pin.ribbon ? <SuggestionRibbon /> : <span style={{ color: pin.warning ? '#ff9c9c' : 'var(--gold-light)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{pin.label}</span>}
                      </>
                    ) : groupBy === 'keyword' ? (
                      <>
                        {iconUrl && <KeywordImage src={iconUrl} size={18} />}
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{keywordLabels[group.key] ?? group.key}</span>
                      </>
                    ) : (
                      <>
                        <GiftGrade grade={group.key} style={{ fontSize: '1.5rem' }} />
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{t('mirrorDungeon.filter.grade')}</span>
                      </>
                    )}
                    <span className="tabular-nums" style={{ color: '#9c8b73', fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>{groupCounts.get(group.key) ?? group.gifts.length}</span>
                  </h2>
                )}
                {pin?.note && <p className="mb-2 whitespace-pre-wrap break-words text-[0.8125rem] leading-[1.5] text-[var(--text-secondary)]">{pin.note}</p>}
                <div
                  className={compact ? 'gift-grid [&_.gift-card:hover]:[transform:none]!' : 'gift-grid gift-catalog-grid'}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 'var(--gift-catalog-cell, 4.5rem)' : 'var(--gift-catalog-min, 3.625rem)'}, 1fr))`,
                    gap: '0.5rem 0.375rem',
                  }}
                >
                  <GiftGrid onSelect={selectGift} lang={lang} compact={compact} markedLabel={markedLabel}
                    cells={group.gifts.map(gift => ({ gift, isSelected: selectedIds?.has(gift.id), isMarked: markedIds?.has(gift.id), badge: renderBadge?.(gift), extra: cardProps?.(gift) }))} />
                </div>
              </section>
            )
          })}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <span className="motion-safe:animate-pulse" style={{ color: '#9c8b73', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
                {t('mirrorDungeon.filter.loading')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
