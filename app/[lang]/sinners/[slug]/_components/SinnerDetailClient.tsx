'use client'

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { Link } from '@/lib/i18n/navigation'
import StaggerReveal, { staggerItem } from '@/features/catalog/components/StaggerReveal'
import { useRouter, usePathname } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import SearchBox from '@/components/ui/SearchBox'

const DROPDOWN_BUTTON_STYLE = { minHeight: '2.5rem', background: '#120e09', borderColor: '#2e2417', fontFamily: 'var(--font-body)', fontSize: '0.8125rem' }
import { Sinner, Identity, EGO, RARITY_ICON_MAP } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'
import IdentityCard from '@/features/catalog/components/IdentityCard'
import { countKeywords, filterSinnerEgos, filterSinnerIdentities, getRepresentativeKeywords, type OwnershipFilter } from '@/features/catalog'
import { useSinnerSearch } from '@/features/catalog/hooks/useSinnerSearch'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { getLocalizedName } from '@/lib/i18n/localize'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import styles from '@/styles/components/SinnerDetail.module.css'
import SinnerHero from '@/features/catalog/components/SinnerHero'
import AdSlot from '@/components/ads/AdSlot'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'

interface Props {
  sinner: Sinner
  identities: Identity[]
  egos: EGO[]
}

type Tab = 'identities' | 'ego'

export default function SinnerDetailClient({ sinner, identities, egos }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  const shouldReduceMotion = useReducedMotion()
  useRoutePrefetch([`/${lang}/sinners/identities`, `/${lang}/sinners/ego`])
  const { iconMap: kwIconMap } = useKeywordData()

  const literarySource = (() => {
    const key = `sinner.source.${sinner.id}` as keyof typeof translations
    const entry = translations[key]
    if (!entry) return sinner.literary_source
    return entry[lang] ?? entry['ko'] ?? sinner.literary_source
  })()
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('identities')
  const [gacksung, setGacksung] = useState(false)
  const [rarityFilter, setRarityFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // null until the person flips the order: a search then lists the best match first
  const [sortPick, setSortPick] = useState<'newest' | 'oldest' | null>(null)
  const sortOrder = sortPick ?? 'newest'
  // A search lists its own order until the toggle is used: the first press then keeps what the button shows (newest).
  const toggleSort = () => setSortPick(sortPick === null && searchQuery.trim() ? 'newest' : sortOrder === 'newest' ? 'oldest' : 'newest')
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all')
  const ownedIds = useOwnedIdentities()

  // 초기 해시 읽기 + 브라우저 뒤로가기/앞으로가기 동기화
  useEffect(() => {
    const readHash = () => setTab(window.location.hash === '#ego' ? 'ego' : 'identities')
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  const changeTab = (t: Tab) => {
    router.push(`${pathname}#${t}`, { scroll: false })
    setTab(t)
  }

  const keywordStats = useMemo(() => countKeywords(identities.map(getRepresentativeKeywords)), [identities])

  // EGO 키워드 빈도 계산
  const egoKeywordStats = useMemo(() => countKeywords(egos.map(e => e.keywords)), [egos])

  const { identityHits, egoHits, groups } = useSinnerSearch({
    identities, egos, tab, query: searchQuery, setQuery: setSearchQuery,
    openIdentity: identity => router.push(`/sinners/${sinner.id}/identities/${identity.id}`),
    openEgo: ego => router.push(`/sinners/${sinner.id}/ego/${ego.id}`),
    keywordStats, egoKeywordStats, keywordIcons: kwIconMap,
  })

  const hasActiveFilters = searchQuery || rarityFilter || ownershipFilter !== 'all'

  const filteredIdentities = useMemo(
    () => filterSinnerIdentities(identities, { rarityFilter, hits: identityHits, sortPicked: sortPick !== null, sortOrder, ownershipFilter, ownedIds }),
    [identities, rarityFilter, identityHits, sortPick, sortOrder, ownershipFilter, ownedIds],
  )
  const filteredEgos = useMemo(
    () => filterSinnerEgos(egos, { hits: egoHits, sortPicked: sortPick !== null, sortOrder, ownershipFilter, ownedIds }),
    [egos, egoHits, sortPick, sortOrder, ownershipFilter, ownedIds],
  )

  return (
    <div className={`${styles.page} min-h-[100dvh] pb-16 relative`}>
      <SinnerHero
        sinner={sinner}
        name={getLocalizedName(sinner, lang)}
        description={(() => {
          const entry = translations[`sinnerDetail.desc.${sinner.id}` as keyof typeof translations]
          return entry ? entry[lang] ?? entry['ko'] ?? sinner.description : sinner.description
        })()}
        source={literarySource}
      />
      {/* the tabs and cards rise from below under the hero */}
      <div className={`${styles.content} max-w-7xl mx-auto mt-6 px-5 sm:mt-8 sm:px-8 relative`} style={{ zIndex: 1 }}>
          {/* the page-start banner, where the side ads do not fit (DESIGN.md "광고") */}
          <AdSlot place="top" />
          {/* 우측: 탭 콘텐츠 */}
          <m.div
            className="min-w-0"
            initial={shouldReduceMotion ? false : { y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.32, delay: shouldReduceMotion ? 0 : 0.04, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* 탭 */}
            <div className={styles.tabs} role="tablist">
              {(['identities', 'ego'] as Tab[]).map(tabKey => (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  aria-selected={tab === tabKey}
                  onClick={() => changeTab(tabKey)}
                >
                  {tabKey === 'identities' ? t('sinners.identities') : 'E.G.O'}
                  <span className={styles.tabCount}>
                    {tabKey === 'identities' ? filteredIdentities.length : filteredEgos.length}
                  </span>
                </button>
              ))}
            </div>

            {/* 검색 바 + 자동완성 (공통) */}
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              label={tab === 'identities' ? t('sinnerDetail.searchIdentity') : t('sinnerDetail.searchEgo')}
              clearLabel={t('globalSearch.clear')}
              groups={groups}
              className={styles.searchWrap}
            />

            {/* 인격 탭 */}
            <AnimatePresence mode="wait" initial={false}>
            {tab === 'identities' && (
              <m.div
                key="identities"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
              >
                {/* 필터 바 */}
                <div className={styles.filters}>
                  {/* 등급 필터 */}
                  <div className={styles.segment} role="group" aria-label={t('sinnerDetail.rarityFilter')}>
                    {[
                      { value: null, label: t('sinnerDetail.allFilter'), icon: null },
                      { value: '1성', label: '1성', icon: RARITY_ICON_MAP[1] },
                      { value: '2성', label: '2성', icon: RARITY_ICON_MAP[2] },
                      { value: '3성', label: '3성', icon: RARITY_ICON_MAP[3] },
                    ].map(({ value, label, icon }, index) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() => setRarityFilter(value)}
                        aria-pressed={rarityFilter === value}
                      >
                        {icon ? (
                          <Image src={icon} alt={(t.raw('identity.rarity') as string[])[index] ?? label} width={index * 24} height={24} unoptimized />
                        ) : (
                          label
                        )}
                      </button>
                    ))}
                  </div>

                  <div className={styles.controls}>
                    {/* 보유 필터 드롭다운: 보유 정보가 늦게 와도 줄이 밀리지 않게 처음부터 둔다(고른 값은 도착하면 적용) */}
                    {(
                      <Dropdown
                        value={ownershipFilter}
                        defaultValue="all"
                        options={[
                          { value: 'all', label: t('sinnerDetail.viewAll') },
                          { value: 'owned', label: t('sinnerDetail.ownedIdentity') },
                          { value: 'unowned', label: t('sinnerDetail.unownedIdentity') },
                        ]}
                        onChange={v => setOwnershipFilter(v as OwnershipFilter)}
                        minWidth={110}
                        buttonStyle={DROPDOWN_BUTTON_STYLE}
                      />
                    )}

                    {/* 정렬 토글 */}
                    <button type="button" className={styles.control} onClick={toggleSort}>
                      {sortOrder === 'newest' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
                      {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
                    </button>

                  {/* 일반/각성 토글 */}
                    <div className={styles.segment} role="group" aria-label={t('sinnerDetail.artFilter')}>
                      <button type="button" aria-pressed={!gacksung} onClick={() => setGacksung(false)}>{t('sinnerDetail.normal')}</button>
                      <button type="button" aria-pressed={gacksung} onClick={() => setGacksung(true)}>{t('sinnerDetail.uptie3')}</button>
                    </div>
                  </div>
                </div>

                {filteredIdentities.length === 0 ? (
                  <div
                    className="text-center py-16"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noIdentities')}
                  </div>
                ) : (
                  <StaggerReveal className={styles.identityGrid} staggerDelay={0.03}>
                    {filteredIdentities.map((identity) => (
                      <m.div
                        key={identity.id}
                        variants={staggerItem}
                        className="w-full"
                      >
                        {/* A real link (crawlers and new-tab clicks follow it); the card keeps its own hover and size. */}
                        <Link
                          href={`/sinners/${sinner.id}/identities/${identity.id}`}
                          aria-label={getLocalizedName(identity, lang)}
                        >
                          <IdentityCard identity={identity} gacksung={gacksung} compact />
                        </Link>
                      </m.div>
                    ))}
                  </StaggerReveal>
                )}
              </m.div>
            )}

            {/* EGO 탭 */}
            {tab === 'ego' && (
              <m.div
                key="ego"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
              >
                {/* 정렬 + 보유 필터 */}
                <div className={styles.filters}>
                  <div className={styles.controls}>
                  <button type="button" className={styles.control} onClick={toggleSort}>
                    {sortOrder === 'newest' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
                    {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
                  </button>

                  {/* 보유 필터 드롭다운 */}
                  {(
                    <Dropdown
                      value={ownershipFilter}
                      defaultValue="all"
                      options={[
                        { value: 'all', label: t('sinnerDetail.viewAll') },
                        { value: 'owned', label: t('sinnerDetail.ownedEgo') },
                        { value: 'unowned', label: t('sinnerDetail.unownedEgo') },
                      ]}
                      onChange={v => setOwnershipFilter(v as OwnershipFilter)}
                      minWidth={110}
                        buttonStyle={DROPDOWN_BUTTON_STYLE}
                    />
                  )}
                  </div>
                </div>

                {filteredEgos.length === 0 ? (
                  <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noEgo')}
                  </div>
                ) : (
                  <StaggerReveal className={styles.egoGrid} staggerDelay={0.03}>
                    {filteredEgos.map((ego) => {
                      const egoName = getLocalizedName(ego, lang)

                      return (
                        <m.div
                          key={ego.id}
                          variants={staggerItem}
                          whileHover={shouldReduceMotion ? undefined : { scale: 1.035 }}
                        >
                          <EgoDisplayCard
                            ego={ego}
                            lang={lang}
                            name={egoName}
                            href={`/sinners/${sinner.id}/ego/${ego.id}`}
                            // A link is as wide as its cell where the button it replaced was as wide as the card.
                            className="w-fit"
                            sinnerId={sinner.id}
                          />
                        </m.div>
                      )
                    })}
                  </StaggerReveal>
                )}
              </m.div>
            )}
            </AnimatePresence>
          </m.div>
      </div>
    </div>
  )
}
