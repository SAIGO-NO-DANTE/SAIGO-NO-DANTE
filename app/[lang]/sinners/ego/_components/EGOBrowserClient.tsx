'use client'

// Design Ref: §5.1 — EGO 전체 브라우저 클라이언트
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import SearchBox from '@/components/ui/SearchBox'
import { useRouter } from '@/lib/i18n/navigation'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import type { Sinner } from '@/lib/types'
import type { EGOBrowserItem, SortOption } from '@/lib/types/browser'
import type { DropdownOption } from '@/components/ui/Dropdown'
import { useEGOBrowserFilters } from '@/features/catalog/hooks/useBrowserFilters'
import { useCatalogSearch } from '@/features/catalog/hooks/useCatalogSearch'
import FilterSidebar from '@/features/catalog/components/FilterSidebar'
import SinnerFilter from '@/features/catalog/components/SinnerFilter'
import { filterStyles } from '@/features/catalog/components/FilterToggleGroup'
import GradeFilter from '@/features/catalog/components/GradeFilter'
import SinFilter from '@/features/catalog/components/SinFilter'
import KeywordFilter from '@/features/catalog/components/KeywordFilter'
import ActiveFilterChips from '@/features/catalog/components/ActiveFilterChips'
import BrowserHeader from '@/features/catalog/components/BrowserHeader'
import EGOBrowserCard from '@/features/catalog/components/EGOBrowserCard'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'
import { useProgressiveRender } from '@/hooks/useProgressiveRender'

/** Cards rendered per scroll step (each card draws about eight images), and cards whose artwork loads first. */
const GRID_PAGE = 36
const PRELOADED_CARDS = 6

type Props = {
  egos: EGOBrowserItem[]
  sinners: Sinner[]
}

export default function EGOBrowserClient({ egos, sinners }: Props) {
  const t = useTranslations('browser')
  const tGlobal = useTranslations('globalSearch')
  const router = useRouter()
  const sortOptions: DropdownOption<SortOption>[] = [
    { value: 'default', label: t('sort.default') },
    { value: 'name', label: t('sort.name') },
    { value: 'grade', label: t('sort.grade') },
  ]
  const [nameQuery, setNameQuery] = useState('')
  const shouldReduceMotion = useReducedMotion()

  const {
    filters, sort, setSort,
    items: filterResult,
    totalCount, filteredCount: filterCount, activeCount,
    toggle, resetAll,
  } = useEGOBrowserFilters(egos)

  // The best match first until the person picks a sort
  const { list: filtered, groups } = useCatalogSearch(
    'ego', egos, filterResult, nameQuery, sort !== 'default',
    ego => router.push(`/sinners/${ego.sinner_slug}/ego/${ego.id}`),
  )

  const filteredCount = nameQuery.trim() ? filtered.length : filterCount
  const { visible, sentinelRef } = useProgressiveRender(filtered.length, GRID_PAGE)

  return (
    <div className="min-h-[100dvh] pt-[5.5rem] pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      <m.div
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <BrowserHeader
          title={t('egoTitle')}
          totalCount={totalCount}
          filteredCount={filteredCount}
          sort={sort}
          onSortChange={setSort}
          sortOptions={sortOptions}
        />
      </m.div>

      <div className="flex gap-6">
        {/* 사이드바 */}
        <m.div
          className="relative z-20 shrink-0"
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
        >
          <FilterSidebar
            activeCount={activeCount}
            search={(
              <div>
                <div className={filterStyles.label}>
                  {t('nameSearch')}
                </div>
                <SearchBox value={nameQuery} onChange={setNameQuery} label={t('egoPlaceholder')} clearLabel={tGlobal('clear')} groups={groups} />
              </div>
            )}
          >
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <SinnerFilter
              sinners={sinners}
              selected={filters.sinners}
              onToggle={v => toggle('sinners', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <GradeFilter
              selected={filters.grades}
              onToggle={v => toggle('grades', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <SinFilter
              selected={filters.sins}
              onToggle={v => toggle('sins', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <KeywordFilter
              selected={filters.keywords}
              onToggle={v => toggle('keywords', v)}
            />
            <ActiveFilterChips activeCount={activeCount} onReset={resetAll} />
          </FilterSidebar>
        </m.div>

        {/* 카드 그리드 */}
        <div className="flex-1 min-w-0">
          {filteredCount === 0 ? (
            <m.div
              className="flex items-center justify-center py-20"
              initial={shouldReduceMotion ? false : 'initial'}
              animate="animate"
              variants={shouldReduceMotion ? undefined : workbenchReveal}
            >
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('emptyEgo')}</p>
            </m.div>
          ) : (
            <m.div
              role="list"
              className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-4 gap-y-5 pt-2 max-sm:grid-cols-2 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[9.5rem]"
              initial={shouldReduceMotion ? false : 'initial'}
              whileInView={shouldReduceMotion ? undefined : 'animate'}
              viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
              variants={shouldReduceMotion ? undefined : staggerContainer(0.025)}
            >
              {filtered.slice(0, visible).map((ego, index) => (
                <m.div
                  key={ego.id}
                  role="listitem"
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
                >
                  <EGOBrowserCard ego={ego} preload={index < PRELOADED_CARDS} />
                </m.div>
              ))}
            </m.div>
          )}
          {visible < filtered.length && <div ref={sentinelRef} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}
