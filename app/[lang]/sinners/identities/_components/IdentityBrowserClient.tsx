'use client'

// Design Ref: §5.1 — 인격 전체 브라우저 클라이언트
import { useEffect, useMemo, useRef, useState } from 'react'
import IntentLink from '@/components/ui/IntentLink'
import SearchBox from '@/components/ui/SearchBox'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import type { Sinner } from '@/lib/types'
import type { IdentityBrowserItem, SortOption } from '@/lib/types/browser'
import type { DropdownOption } from '@/components/ui/Dropdown'
import { useIdentityBrowserFilters } from '@/features/catalog/hooks/useBrowserFilters'
import { useCatalogSearch } from '@/features/catalog/hooks/useCatalogSearch'
import FilterSidebar from '@/features/catalog/components/FilterSidebar'
import SinnerFilter from '@/features/catalog/components/SinnerFilter'
import RarityFilter from '@/features/catalog/components/RarityFilter'
import SinFilter from '@/features/catalog/components/SinFilter'
import AtkTypeFilter from '@/features/catalog/components/AtkTypeFilter'
import KeywordFilter from '@/features/catalog/components/KeywordFilter'
import FilterToggleGroup, { filterStyles } from '@/features/catalog/components/FilterToggleGroup'
import NumericFilter from '@/features/catalog/components/NumericFilter'
import ActiveFilterChips from '@/features/catalog/components/ActiveFilterChips'
import BrowserHeader from '@/features/catalog/components/BrowserHeader'
import IdentityCard from '@/features/catalog/components/IdentityCard'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

const GRID_PAGE = 36
/** Cards whose portrait loads first: the first row at the widest layout. */
const PRELOADED_CARDS = 6

type Props = {
  identities: IdentityBrowserItem[]
  sinners: Sinner[]
}

type IdentityBrowserItemWithRepresentativeKeywords = IdentityBrowserItem & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

export default function IdentityBrowserClient({ identities, sinners }: Props) {
  const t = useTranslations('browser')
  const lang = useLocale() as SupportedLang
  const tGlobal = useTranslations('globalSearch')
  const router = useRouter()
  const sortOptions: DropdownOption<SortOption>[] = [
    { value: 'default', label: t('sort.default') },
    { value: 'name', label: t('sort.name') },
    { value: 'rarity', label: t('sort.rarity') },
  ]
  const [nameQuery, setNameQuery] = useState('')
  const shouldReduceMotion = useReducedMotion()
  const representativeKeywordIdentities = useMemo<IdentityBrowserItem[]>(() => (
    (identities as IdentityBrowserItemWithRepresentativeKeywords[]).map(identity => ({
      ...identity,
      keywords: identity.skill_keyword_list && identity.skill_keyword_list.length > 0
        ? identity.skill_keyword_list
        : (identity.keywords ?? []),
    }))
  ), [identities])

  const {
    filters, sort, setSort,
    items: filterResult,
    totalCount, filteredCount: filterCount, activeCount,
    toggle, resetAll,
  } = useIdentityBrowserFilters(representativeKeywordIdentities)

  // 이름 검색: the best match first until the person picks a sort
  const { list: filtered, groups } = useCatalogSearch(
    'identity', representativeKeywordIdentities, filterResult, nameQuery, sort !== 'default',
    id => router.push(`/sinners/${id.sinner_slug}/identities/${id.id}`),
  )

  const filteredCount = nameQuery.trim() ? filtered.length : filterCount

  // Render the grid in pages as the reader scrolls: 188 cards at once is ~5k DOM nodes.
  const [shown, setShown] = useState(GRID_PAGE)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = moreRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setShown(n => n + GRID_PAGE) }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, filtered.length])

  // 숫자 필터용 가능한 값 추출
  const availableWeights = useMemo(() => {
    const ws = new Set<number>()
    representativeKeywordIdentities.forEach(id => id.atk_weights.forEach(w => ws.add(w)))
    return [...ws].sort((a, b) => a - b)
  }, [representativeKeywordIdentities])

  const availableCoins = useMemo(() => {
    const cs = new Set<number>()
    representativeKeywordIdentities.forEach(id => id.coin_counts.forEach(c => cs.add(c)))
    return [...cs].sort((a, b) => a - b)
  }, [representativeKeywordIdentities])

  return (
    <div className="min-h-[100dvh] pt-[5.5rem] pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      <m.div
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <BrowserHeader
          title={t('identitiesTitle')}
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
                <SearchBox value={nameQuery} onChange={setNameQuery} label={t('identityPlaceholder')} clearLabel={tGlobal('clear')} groups={groups} />
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
            <RarityFilter
              selected={filters.rarities}
              onToggle={v => toggle('rarities', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <FilterToggleGroup
              sectionLabel={t('season')}
              items={[0,1,2,3,4,5,6,7].map(s => ({ value: s, label: s === 0 ? t('seasonBase') : `S${s}` }))}
              selected={filters.seasons}
              onToggle={(v: number) => toggle('seasons', v)}
              columns={4}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <SinFilter
              selected={filters.sins}
              onToggle={v => toggle('sins', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <AtkTypeFilter
              selected={filters.atkTypes}
              onToggle={v => toggle('atkTypes', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <KeywordFilter
              selected={filters.keywords}
              onToggle={v => toggle('keywords', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <NumericFilter
              sectionLabel={t('weight')}
              values={availableWeights}
              selected={filters.atkWeights}
              onToggle={v => toggle('atkWeights', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <NumericFilter
              sectionLabel={t('coins')}
              values={availableCoins}
              selected={filters.coinCounts}
              onToggle={v => toggle('coinCounts', v)}
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('emptyIdentity')}</p>
            </m.div>
          ) : (
            <m.div
              role="list"
              className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-5 pt-2 max-sm:grid-cols-3 max-sm:gap-x-3"
              initial={shouldReduceMotion ? false : 'initial'}
              whileInView={shouldReduceMotion ? undefined : 'animate'}
              viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
              variants={shouldReduceMotion ? undefined : staggerContainer(0.025)}
            >
              {filtered.slice(0, shown).map((id, index) => (
                <m.div
                  key={id.id}
                  role="listitem"
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                >
                  <IntentLink
                    href={`/sinners/${id.sinner_slug}/identities/${id.id}`}
                    aria-label={getLocalizedName({ name_kr: id.name_kr || id.name, name_en: id.name_en, name_jp: id.name_jp }, lang)}
                  >
                    <IdentityCard
                      identity={{
                        ...id,
                        tier: 0,
                      }}
                      preload={index < PRELOADED_CARDS}
                    />
                  </IntentLink>
                </m.div>
              ))}
            </m.div>
          )}
          {shown < filtered.length && <div ref={moreRef} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}
