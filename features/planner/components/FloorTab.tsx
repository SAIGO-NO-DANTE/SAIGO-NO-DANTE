'use client'

import FloorConstraints from './FloorConstraints'
import FloorGuidance from './FloorGuidance'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import FloorGiftPickerModal from './FloorGiftPickerModal'
import FloorAcquiredGifts from './FloorAcquiredGifts'
import FloorEditorHeader from './FloorEditorHeader'
import FloorMemoEditor from './FloorMemoEditor'
import FloorThemeSlot from './FloorThemeSlot'
import { Plus } from 'lucide-react'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import ThemePackStack from '@/features/planner/components/ThemePackStack'
import { useSuggestionState } from '@/hooks/useSuggestions'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { previousFloorGifts } from '@/features/planner/lib/floor-copy'
import {
  FLOOR_FOCUS_RING,
  availableThemesByFloor,
  floorDifficultyChange,
  floorGiftToggleActions,
  floorRepairAction,
  getDifficultyTone,
  getMemoPreview,
  ladderSegments,
  normalizeFloorDifficulty,
  pickerThemesFor,
  reachableGiftsFor,
} from '@/features/planner/lib/floor-view'
import { showSuccess } from '@/lib/toast'
import FinalGiftSection from './FinalGiftSection'
import {
  ThemePackModalPill,
  ThemePackPickerModal,
} from '@/components/ui/ThemePackModal'
import type { PlannerState, PlannerAction, ThemeData, GiftData, FloorDifficulty, FloorEntry, RecipeData } from '@/lib/planner/types'
import { floorThemeOrder } from '@/lib/planner/types'
import { getGiftsFromThemes, themeExclusiveGiftIds, withThemeRewards } from '@/lib/planner/fusion'
import { isConfiguredFloor } from '@/lib/planner/strip-plan-for-list'
import { deriveFinalGifts } from '@/features/planner/lib/final-gifts'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { buildKeywordPool, buildEgoGiftPool } from '@/features/notes/components/NoteAutocomplete'
import type { NoteEgoGiftEntry } from '@/features/notes/components/NoteChips'
import type { NoteFormationMember } from '@/features/notes'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface FloorTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
}

export default function FloorTab({ state, dispatch, themes, gifts, recipes, giftMap }: FloorTabProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.floorTab')
  const sinnerT = useTranslations('sinner')
  // 메모 편집기의 스킬·인격 넣기용 편성(편성 순서대로)
  const noteFormation = useMemo<NoteFormationMember[]>(() => [...state.identitySlots]
    .filter(slot => slot.slot_order < 99)
    .sort((a, b) => a.slot_order - b.slot_order)
    .map(slot => ({ identityId: slot.identity_id, sinnerId: slot.sinner_id, name: sinnerT(slot.sinner_id as Parameters<typeof sinnerT>[0]) })), [sinnerT, state.identitySlots])
  const shouldReduceMotion = useReducedMotion()
  const [activeFloor, setActiveFloor] = useState<number | null>(null)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)
  const tCopy = useTranslations('planner.floorCopy')
  const [copyConfirm, setCopyConfirm] = useState<{ floor: number; giftIds: string[] } | null>(null)

  const themeMap = useMemo(() => new Map(themes.map(theme => [String(theme.id), theme])), [themes])
  const activeEntry = activeFloor === null ? undefined : state.floorPlan.find(entry => entry.floor === activeFloor)
  const activeDifficulty = activeEntry
    ? normalizeFloorDifficulty(activeEntry.difficulty, activeEntry.floor)
    : 'hard'
  const selectedTheme = activeEntry?.theme_id ? themeMap.get(activeEntry.theme_id) ?? null : null
  // What plans like this one took on the floor, asked only while one of the pickers is open.
  const fielded = state.identitySlots.filter(slot => slot.slot_order < 99).map(slot => slot.identity_id)
  const { data: floorSuggestions, loading: floorSuggestionsLoading } = useSuggestionState<{ themes: { id: string; count: number }[]; gifts: { id: string }[] }>(
    activeEntry && (themeModalOpen || giftPickerOpen)
      ? `/api/discovery/suggest?type=floor&floor=${activeEntry.floor}&identities=${fielded.join(',')}&keywords=${encodeURIComponent((state.mainKeywords ?? []).join(','))}`
      : null,
  )

  useEffect(() => {
    if (activeFloor !== null && !state.floorPlan.some(entry => entry.floor === activeFloor)) {
      setActiveFloor(null)
    }
  }, [activeFloor, state.floorPlan])

  useEffect(() => {
    const repair = floorRepairAction(state.floorPlan, themes)
    if (repair) dispatch(repair)
  }, [dispatch, state.floorPlan, themes])

  const themesByFloor = useMemo(() => availableThemesByFloor(state.floorPlan, themes), [state.floorPlan, themes])

  const activeAvailableThemes = activeEntry
    ? themesByFloor.get(activeEntry.floor) ?? []
    : []

  const pickerThemes = useMemo(
    () => pickerThemesFor(activeEntry, state.floorPlan, activeAvailableThemes),
    [activeAvailableThemes, activeEntry, state.floorPlan],
  )

  const kwContext = useKeywordData()
  // Stable: the picker indexes this text once per theme list.
  const themeSearchText = useCallback((theme: (typeof themes)[number]) => [theme.name, theme.name_en, theme.name_jp, ...[...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? [])]
    .flatMap(id => { const gift = giftMap.get(id); return gift ? [gift.name, gift.name_en, gift.name_jp] : [] })].join(' '), [giftMap])
  const localizedGift = useCallback((gift: GiftData): GiftData => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale),
  }), [locale])

  const acPool = useMemo(() => {
    const kwPool = buildKeywordPool(kwContext.keywords)
    const giftPool = buildEgoGiftPool(
      gifts.filter(gift => gift.keyword && gift.name).map(gift => ({
        name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale),
        keyword: gift.keyword!,
        image_url: gift.image_url,
      }))
    )
    return [...kwPool, ...giftPool]
  }, [kwContext, gifts, locale])

  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const gift of gifts) {
      if (gift.name && gift.keyword) {
        const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        map[name] = {
          name,
          keyword: gift.keyword,
          grade: gift.grade ?? '1',
          image_url: gift.image_url,
          effect_base: gift.effect_base,
        }
      }
    }
    return map
  }, [gifts, locale])

  // The derived final set (also holds start/observed gifts and drops whatever a fusion result in it consumed); the final-gift section and the floor picks read it.
  const derivedFinal = useMemo(
    () => deriveFinalGifts(state.giftInventory, recipes, giftMap),
    [giftMap, recipes, state.giftInventory],
  )

  const setDifficulty = useCallback((difficulty: FloorDifficulty) => {
    if (!activeEntry || activeEntry.floor > 5) return
    const { action, selectedStillValid } = floorDifficultyChange(activeEntry, difficulty, themes)
    dispatch(action)
    if (!selectedStillValid) setGiftPickerOpen(false)
  }, [activeEntry, dispatch, themes])

  const toggleGiftId = useCallback((giftGameId: string, currentIds: string[]) => {
    if (!activeEntry) return
    for (const action of floorGiftToggleActions(activeEntry.floor, giftGameId, currentIds, state.floorPlan, derivedFinal)) dispatch(action)
  }, [activeEntry, derivedFinal, dispatch, state.floorPlan])

  const copyGifts = (floor: number, giftIds: string[]) => {
    dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds })
    showSuccess(tCopy('copied', { floor: floor - 1 }))
  }
  const copyPreviousFloor = (entry: FloorEntry) => {
    const giftIds = previousFloorGifts(state.floorPlan, entry.floor)
    if (entry.gift_ids.length) setCopyConfirm({ floor: entry.floor, giftIds })
    else copyGifts(entry.floor, giftIds)
  }

  function getThemeAvailableGifts(theme: ThemeData): GiftData[] {
    // 일반 풀 + 전용 풀·보스 보상(어시스트와 같은 규칙). 보스 러시류(1511~1520)는 보상 기프트가 일반 풀에 없어 빠졌었다.
    return getGiftsFromThemes([theme.id], [theme], giftMap).map(localizedGift)
  }

  const shouldReduceScroll = shouldReduceMotion
  const rowRefs = useRef(new Map<number, HTMLLIElement>())
  // Viewport top of the row being opened, so collapsing a row above it doesn't yank it upward.
  const openAnchor = useRef<{ floor: number, top: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = openAnchor.current
    openAnchor.current = null
    const row = anchor && anchor.floor === activeFloor ? rowRefs.current.get(anchor.floor) : null
    if (!anchor || !row) return
    const shift = row.getBoundingClientRect().top - anchor.top
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' })
  }, [activeFloor])

  useEffect(() => {
    if (activeFloor === null) return
    // Collapsing the previous row can move the opened one out of view; measure once layout has settled.
    const frame = requestAnimationFrame(() => {
      const row = rowRefs.current.get(activeFloor)
      if (!row) return
      const { top } = row.getBoundingClientRect()
      if (top < 0 || top > window.innerHeight * 0.6) {
        row.scrollIntoView({ block: 'start', behavior: shouldReduceScroll ? 'auto' : 'smooth' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [activeFloor, shouldReduceScroll])

  function openFloor(floor: number) {
    if (floor === activeFloor) return
    const row = rowRefs.current.get(floor)
    if (row) openAnchor.current = { floor, top: row.getBoundingClientRect().top }
    setActiveFloor(floor)
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }

  function toggleFloor(floor: number) {
    if (floor !== activeFloor) {
      openFloor(floor)
      return
    }
    setActiveFloor(null)
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }

  function getFloorGifts(entry: FloorEntry, theme: ThemeData | null) {
    return withThemeRewards(entry.gift_ids, theme, entry.floor)
      .map(id => giftMap.get(parseInt(id, 10)))
      .filter((gift): gift is GiftData => Boolean(gift))
      .map(localizedGift)
  }

  const activeThemeName = selectedTheme ? getLocalizedName({ name_kr: selectedTheme.name, name_en: selectedTheme.name_en, name_jp: selectedTheme.name_jp }, locale) : null
  // 최종 조합이 소비하는 재료도 층에서 얻는 기프트라 목록에 둔다
  const availableGifts = selectedTheme ? getThemeAvailableGifts(selectedTheme) : []
  // 이 층에서 얻을 수 있는 전체: 다른 테마팩 전용 기프트만 뺀다(합성·조합식 결과는 포함)
  const reachableGifts = useMemo(() => reachableGiftsFor(gifts, themes, selectedTheme), [gifts, selectedTheme, themes])
  const configuredCount = state.floorPlan.filter(isConfiguredFloor).length
  const segments = ladderSegments(state.floorPlan)

  // A hairline rail; the open floor's stretch lights up so the eye finds it.
  const railClass = 'pointer-events-none absolute inset-y-0 left-[0.875rem] w-[0.125rem] sm:left-[1.375rem]'
  const railStyle = (tone: string, lit = false) => ({ background: tone, opacity: lit ? 0.9 : 0.35 })

  // A plain render function, not a component: the closed row and the open editor share one element slot, as before the split.
  function renderSummary(entry: FloorEntry, theme: ThemeData | null, floorGifts: GiftData[]) {
    const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
    const memoPreview = getMemoPreview(entry.memo)
    const alts = (entry.theme_alt_ids ?? []).flatMap(id => themeMap.get(id) ?? [])
    const exclusiveLabel = t('ladder.packExclusive')
    return (
      // The floor number is the keyboard control; clicking anywhere on the row is a pointer shortcut.
      <div
        className="-m-1 flex cursor-pointer gap-3 rounded-sm p-1 transition-colors hover:bg-[rgba(200,144,10,0.05)] sm:gap-4"
        onClick={() => openFloor(entry.floor)}
      >
        <div className="shrink-0 [--w:4rem] sm:[--w:4.75rem]">
          {theme ? (
            <ThemePackStack
              themes={[theme, ...alts]}
              lang={locale}
              sizes="76px"
              ariaLabel={t('ladder.expand', { floor: entry.floor })}
              onClick={() => openFloor(entry.floor)}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-[3rem] w-[var(--w)] items-center justify-center rounded-sm border border-dashed"
              style={{ borderColor: '#3a2f22', color: 'var(--text-muted)' }}
            >
              <Plus size={18} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-sm font-semibold" style={{ color: getDifficultyTone(difficulty) }}>
              {t(`difficulty.${difficulty}`)}
            </span>
            <span
              className={`min-w-0 leading-snug ${theme ? 'text-[1.125rem]' : 'text-[0.9375rem]'}`}
              style={{ fontFamily: theme ? 'var(--font-heading)' : undefined, color: theme ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {theme ? getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale) : t('ladder.emptyHint')}
            </span>
          </p>
          {floorGifts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {floorGifts.map(gift => (
                <GiftCard
                  key={gift.game_id}
                  gift={gift}
                  size="clamp(2.75rem, 2.4rem + 0.6vw, 3.25rem)"
                  showName={false}
                  warning={themeExclusiveGiftIds(theme).includes(gift.game_id) ? exclusiveLabel : undefined}
                  title={entry.gift_ids.includes(String(gift.game_id)) ? gift.name : t('ladder.rewardTitle', { gift: gift.name })}
                  onClick={() => openFloor(entry.floor)}
                />
              ))}
            </div>
          )}
          {memoPreview && (
            <p className="line-clamp-2 max-w-[48rem] text-sm leading-relaxed" style={{ color: '#9c8b73' }}>
              {memoPreview}
            </p>
          )}
        </div>
      </div>
    )
  }

  function renderEditor(entry: FloorEntry, floorGifts: GiftData[]) {
    const plannedIds = new Set(entry.gift_ids)
    return (
      <div
        id={`floor-editor-${entry.floor}`}
        className="rounded-sm border p-3 sm:p-4"
        style={{ background: '#17120c', borderColor: '#2e2417' }}
      >
        {/* 포스터 옆에 테마팩 이름·난이도·접기·버튼과 획득 기프트를 모은다. 모바일에서는 기프트가 전체 폭으로 내려간다. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 [--w:6.5rem] sm:[--w:9rem] sm:grid-rows-[auto_1fr]">
          <FloorThemeSlot
            floor={entry.floor}
            selectedTheme={selectedTheme}
            altThemes={(entry.theme_alt_ids ?? []).flatMap(id => themeMap.get(id) ?? [])}
            themeName={activeThemeName}
            pickerEmpty={pickerThemes.length === 0}
            onOpenPicker={() => setThemeModalOpen(true)}
          />

          <FloorEditorHeader
            floor={entry.floor}
            selectedTheme={selectedTheme}
            themeName={activeThemeName}
            pickerThemeCount={pickerThemes.length}
            difficulty={activeDifficulty}
            canCopyPrevious={Boolean(selectedTheme) && previousFloorGifts(state.floorPlan, entry.floor).length > 0}
            onDifficulty={setDifficulty}
            onCollapse={() => toggleFloor(entry.floor)}
            onCopyPrevious={() => copyPreviousFloor(entry)}
          />

          <FloorAcquiredGifts
            floorGifts={floorGifts}
            plannedIds={plannedIds}
            selectedTheme={selectedTheme}
            onToggle={giftGameId => toggleGiftId(giftGameId, entry.gift_ids)}
            onOpenPicker={() => setGiftPickerOpen(true)}
          />

          <ConfirmModal
            open={copyConfirm !== null}
            title={tCopy('replaceTitle')}
            message={tCopy('copyPrevious')}
            confirmLabel={tCopy('replaceConfirm')}
            variant="warning"
            onConfirm={() => { if (copyConfirm) copyGifts(copyConfirm.floor, copyConfirm.giftIds); setCopyConfirm(null) }}
            onCancel={() => setCopyConfirm(null)}
          />
          <FloorGiftPickerModal
            open={giftPickerOpen}
            title={t('floorGiftPickerTitle', { floor: entry.floor })}
            floorGifts={selectedTheme ? availableGifts : null}
            allGifts={reachableGifts}
            exclusiveIds={selectedTheme ? themeExclusiveGiftIds(selectedTheme) : []}
            showRecent
            suggestedIds={floorSuggestions?.gifts.map(gift => gift.id)}
            suggestionsLoading={floorSuggestionsLoading}
            selectedIds={plannedIds}
            onToggle={gift => toggleGiftId(String(gift.game_id), entry.gift_ids)}
            onClose={() => setGiftPickerOpen(false)}
          />
        </div>

        <FloorConstraints floor={entry.floor} entries={state.floorPlan} onChange={ids => dispatch({ type: 'SET_FLOOR_CONSTRAINTS', floor: entry.floor, ids })} />
        <FloorGuidance entry={entry} entries={state.floorPlan} inventory={state.giftInventory} recipes={recipes} gifts={giftMap} />

        <div className="mt-5">
          <h5 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {t('memo')}
          </h5>
          <FloorMemoEditor
            value={entry.memo}
            onChange={memo => dispatch({ type: 'SET_FLOOR_MEMO', floor: entry.floor, memo })}
            pool={acPool}
            formation={noteFormation}
            allowedKeywords={allowedKeywords}
            egoGiftLookup={egoGiftLookup}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10" data-floor-plan>
      <section aria-label={t('ladder.title')}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[0.9375rem]" style={{ color: '#9c8b73' }}>{t('ladder.hint')}</p>
          <p className="text-[0.9375rem] tabular-nums" style={{ color: '#9c8b73' }}>
            {t('configuredFloorCount', { configured: configuredCount, total: state.floorPlan.length })}
          </p>
        </div>

        {segments.map(segment => (
          <div key={segment.id}>
            <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]">
              <span className="relative" aria-hidden="true">
                <span className={railClass} style={railStyle(segment.rail)} />
              </span>
              <h3
                className="border-b pb-2 pt-5 text-[0.9375rem]"
                style={{ fontFamily: 'var(--font-heading)', color: segment.label, borderColor: '#2e2417' }}
              >
                {t(`ladder.segment.${segment.id}`, { start: segment.entries[0].floor, end: segment.entries[segment.entries.length - 1].floor })}
              </h3>
            </div>
            <ol>
              {segment.entries.map(entry => {
                const isOpen = entry.floor === activeFloor
                const theme = entry.theme_id ? themeMap.get(entry.theme_id) ?? null : null
                const planned = isConfiguredFloor(entry)
                const floorGifts = getFloorGifts(entry, theme)
                return (
                  <li
                    key={entry.floor}
                    ref={element => {
                      if (element) rowRefs.current.set(entry.floor, element)
                      else rowRefs.current.delete(entry.floor)
                    }}
                    data-floor-row={entry.floor}
                    className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]"
                    style={{ scrollMarginTop: '5rem' }}
                  >
                    <div className="relative">
                      <span className={railClass} style={railStyle(segment.rail, isOpen)} aria-hidden="true" />
                      <button
                        type="button"
                        data-floor-toggle
                        onClick={() => toggleFloor(entry.floor)}
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? `floor-editor-${entry.floor}` : undefined}
                        aria-label={t(isOpen ? 'ladder.collapse' : 'ladder.expand', { floor: entry.floor })}
                        className={`relative ml-[1.375rem] mt-2 flex min-h-[2.75rem] min-w-[2.75rem] items-start rounded-sm leading-none tabular-nums sm:ml-[2.125rem] ${FLOOR_FOCUS_RING}`}
                        style={{
                          fontFamily: 'var(--font-title)',
                          fontSize: 'clamp(2.125rem, 1.6rem + 1.6vw, 3.25rem)',
                          color: isOpen ? 'var(--gold-light)' : planned ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {entry.floor}
                      </button>
                    </div>
                    <div className="min-w-0 border-b py-3" style={{ borderColor: '#2e2417' }}>
                      {isOpen ? renderEditor(entry, floorGifts) : renderSummary(entry, theme, floorGifts)}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </section>

      <FinalGiftSection
        giftInventory={state.giftInventory}
        identitySlots={state.identitySlots}
        dispatch={dispatch}
        gifts={gifts}
        recipes={recipes}
        giftMap={giftMap}
        derivedFinal={derivedFinal}
        localizedGift={localizedGift}
      />

      {themeModalOpen && activeEntry && (
        <ThemePackPickerModal
          title={t('themeModalTitle', { floor: activeEntry.floor })}
          closeLabel={t('close')}
          emptyLabel={t('emptyThemes')}
          searchLabel={t('themeSearch')}
          noResultsLabel={t('themeSearchEmpty')}
          countLabel={count => t('themeResultCount', { count })}
          searchText={themeSearchText}
          themes={pickerThemes}
          suggested={floorSuggestions?.themes}
          suggestionsLoading={floorSuggestionsLoading}
          order={floorThemeOrder(activeEntry)}
          lang={locale}
          onClose={() => setThemeModalOpen(false)}
          hint={t('themePickHint')}
          clearAllLabel={t('clearAllThemes')}
          doneLabel={t('themePickDone')}
          onClearAll={() => dispatch({ type: 'REORDER_FLOOR_THEME', floor: activeEntry.floor, themeIds: [] })}
          // The window stays open: a pack goes on the end of the order (the first pick is the first choice), a picked one comes off.
          onSelectTheme={theme => dispatch({ type: floorThemeOrder(activeEntry).includes(String(theme.id)) ? 'REMOVE_FLOOR_THEME_ALT' : 'ADD_FLOOR_THEME_ALT', floor: activeEntry.floor, themeId: String(theme.id) })}
          meta={
            <ThemePackModalPill tone={activeDifficulty === 'extreme' ? 'red' : activeDifficulty === 'overlap' ? 'purple' : activeDifficulty === 'hard' ? 'gold' : 'neutral'}>
              {t(`difficulty.${activeDifficulty}`)}
            </ThemePackModalPill>
          }
        />
      )}
    </div>
  )
}
