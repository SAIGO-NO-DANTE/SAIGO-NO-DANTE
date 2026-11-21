'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import SearchBox, { type SuggestGroup } from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import { FilterPicked, FilterSection, FilterTextButton, filterStyles } from '@/components/board/FilterControls'
import ThemePackCard from '@/components/ui/ThemePackCard'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters } from '@/features/mirror-dungeon/components/GiftCatalog'
import type { EgoGift } from '@/features/mirror-dungeon'
import type { GiftData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedAffiliation } from '@/lib/i18n/localize'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { pickerFound } from '@/lib/search/picker-search'
import { themePackEntries } from '@/lib/search/theme-pack-entries'
import { affiliationEntries } from '@/features/community/lib/facet-search'
import { getAffiliationIconUrl } from '@/lib/constants/affiliation-icons'
import { SINNER_SLUGS } from '@/lib/constants/game'
import type { BoardFacets } from '@/features/community/hooks/useBoardFacets'

export type FacetKind = 'affiliation' | 'ego' | 'gift' | 'theme'
type Named = { name: string; name_kr?: string | null; name_en?: string | null; name_jp?: string | null }

const localizedName = (item: Named, lang: SupportedLang) =>
  (lang === 'en' ? item.name_en : lang === 'ja' ? item.name_jp : null) || item.name_kr || item.name

/** Display name and thumbnail of a selected option, for the sidebar list and removable chips. */
function facetOption(kind: FacetKind, id: string, facets: BoardFacets | undefined, lang: SupportedLang): { label: string; image: string | null } {
  if (kind === 'affiliation') return { label: getLocalizedAffiliation(id, lang), image: getAffiliationIconUrl(id) }
  const item = kind === 'ego' ? facets?.egos.find(ego => ego.id === id)
    : kind === 'gift' ? facets?.gifts.find(gift => String(gift.game_id) === id)
      : facets?.themes.find(theme => String(theme.id) === id)
  return { label: item ? localizedName(item, lang) : id, image: item?.image_url ?? null }
}

function Count({ value }: { value: number }) {
  const t = useTranslations('boardFacets')
  return <p className="mt-1 text-center text-[0.75rem] text-[var(--text-muted)]">{t('postCount', { count: value })}</p>
}

function NameSearch({ value, onChange, label, groups }: { value: string; onChange: (value: string) => void; label: string; groups: SuggestGroup[] }) {
  const clearLabel = useTranslations('globalSearch')('clear')
  return <SearchBox value={value} onChange={onChange} label={label} clearLabel={clearLabel} groups={groups} className="mb-4 max-w-[24rem]" />
}

/**
 * A board filter's picker: affiliations, E.G.O cards, the gift catalog or theme pack cards, each with how many posts use
 * it. Opened from the board sidebar like the identity picker; choices apply as they are clicked.
 */
export function FacetPickerModal({ kind, facets, selected, onToggle, onClose }: {
  kind: FacetKind | null
  facets: BoardFacets | undefined
  selected: readonly string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const t = useTranslations('boardFacets')
  const rootT = useTranslations()
  const lang = useLocale() as SupportedLang
  const [query, setQuery] = useState('')
  const [sinner, setSinner] = useState<string | null>(null)
  const giftFilters = useGiftCatalogFilters()
  const catalogGifts = useMemo(() => (facets?.gifts ?? []).map(gift => toCatalogGift(gift as unknown as GiftData)), [facets])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  // Searched by the shared engine; the list keeps what is found, best match first, and picking a row does what pressing its card does.
  const affiliationIndex = useMemo(() => affiliationEntries(facets?.affiliations ?? [], lang), [facets, lang])
  const themeIndex = useMemo(() => themePackEntries(facets?.themes ?? [], lang), [facets, lang])
  const affiliations = pickerFound(affiliationIndex, facets?.affiliations ?? [], item => item.key, query)
  const themes = pickerFound(themeIndex, facets?.themes ?? [], theme => String(theme.id), query)
  const sinnerName = (id: string) => rootT(`sinner.${id}` as Parameters<typeof rootT>[0])

  let body: ReactNode = null
  if (kind === 'affiliation') body = (
    <>
      <NameSearch value={query} onChange={setQuery} label={t('searchAffiliation')}
        groups={[pickGroup(t('affiliation'), affiliations.top, item => onToggle(item.key), item => t('postCount', { count: item.count }))]} />
      <div className={filterStyles.options}>
        {affiliations.list.map(item => (
          <button key={item.key} type="button" aria-pressed={selectedSet.has(item.key)} onClick={() => onToggle(item.key)} className={filterStyles.option} title={getLocalizedAffiliation(item.key, lang)}>
            {/* The icon's place is kept for the few affiliations without one, so every name starts on the same line. */}
            <i>{getAffiliationIconUrl(item.key) && <Image src={getAffiliationIconUrl(item.key)!} alt="" width={28} height={28} />}</i>
            <span>{getLocalizedAffiliation(item.key, lang)}</span>
            <b>{item.count}</b>
          </button>
        ))}
      </div>
    </>
  )
  if (kind === 'ego') {
    const sinners = SINNER_SLUGS.filter(id => (facets?.egos ?? []).some(ego => ego.sinner_id === id))
    body = (
      <>
        <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('sinner')}>
          {sinners.map(id => {
            const active = sinner === id
            return (
              <button key={id} type="button" aria-pressed={active} onClick={() => setSinner(active ? null : id)} title={sinnerName(id)}
                className="grid h-10 w-10 place-items-center rounded transition-colors"
                style={{ background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)' }}>
                <Image src={getSinnerLogoUrl(id)} alt={sinnerName(id)} width={28} height={28} className="h-7 w-7 object-contain" style={{ opacity: active ? 1 : 0.5 }} />
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
          {(facets?.egos ?? []).filter(ego => !sinner || ego.sinner_id === sinner).map(ego => (
            <div key={ego.id} className="min-w-0">
              <EgoDisplayCard ego={ego} name={localizedName(ego, lang)} sinnerId={ego.sinner_id} lang={lang} selected={selectedSet.has(ego.id)} onClick={() => onToggle(ego.id)} />
              <Count value={ego.count} />
            </div>
          ))}
        </div>
      </>
    )
  }
  if (kind === 'gift') body = (
    <div style={{ '--gift-catalog-bg': 'var(--bg-card)', '--gift-catalog-sticky-top': '0px', '--gift-catalog-min-h': '0px' } as React.CSSProperties}>
      <GiftCatalog compact gifts={catalogGifts} getGiftKeywordIcon={giftKeywordIcon} filters={giftFilters} selectedIds={selectedSet}
        onGiftClick={(gift: EgoGift) => onToggle(gift.id)} />
    </div>
  )
  if (kind === 'theme') body = (
    <>
      <NameSearch value={query} onChange={setQuery} label={t('searchTheme')}
        groups={[pickGroup(t('theme'), themes.top, theme => onToggle(String(theme.id)), theme => t('postCount', { count: theme.count }), true)]} />
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5 md:grid-cols-7">
        {themes.list.map(theme => (
          <div key={theme.id} className="min-w-0">
            <ThemePackCard theme={theme} sizes="7rem" isSelected={selectedSet.has(String(theme.id))} onClick={() => onToggle(String(theme.id))} />
            <Count value={theme.count} />
          </div>
        ))}
      </div>
    </>
  )

  return (
    <BaseModal open={kind !== null} onClose={() => { setQuery(''); onClose() }} title={kind ? t(kind) : ''} maxWidth="64rem">
      <div className="flex h-[min(80dvh,56rem)] flex-col rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#2e2417] px-5 py-3">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[var(--text-primary)]">
            {kind && t(kind)}
            {selected.length > 0 && <span className="ml-2 font-[family-name:var(--font-title)] text-[1.125rem] text-[var(--gold-light)]">{selected.length}</span>}
          </h2>
          <button type="button" onClick={() => { setQuery(''); onClose() }} aria-label={t('close')}
            className="grid h-10 w-10 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        {/* 위쪽 여백은 안쪽에: 기프트 목록의 고정 도구줄이 스크롤 상자 맨 위에 붙어 그 위로 내용이 비치지 않는다 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5"><div className="pt-5">{body}</div></div>
      </div>
    </BaseModal>
  )
}

/** The facet sections of a board's filter column: each names its picker at the end of its rule, and lists what is picked (press to take off). */
export function FacetSections({ kinds, facets, selections, onRemove, onOpen }: {
  kinds: readonly FacetKind[]
  facets: BoardFacets | undefined
  selections: Record<FacetKind, string[]>
  onRemove: (kind: FacetKind, id: string) => void
  onOpen: (kind: FacetKind) => void
}) {
  const t = useTranslations('boardFacets')
  const lang = useLocale() as SupportedLang
  return <div className={filterStyles.group}>
    {kinds.map(kind => {
      const selected = selections[kind]
      return (
        <FilterSection key={kind} label={t(kind)} count={selected.length}
          end={<FilterTextButton accent aria-haspopup="dialog" aria-label={`${t(kind)} ${t(selected.length ? 'pickMore' : 'pick')}`} onClick={() => onOpen(kind)}><Plus size={14} aria-hidden="true" /><span>{t(selected.length ? 'pickMore' : 'pick')}</span></FilterTextButton>}>
          {selected.length > 0 && <div className={filterStyles.pickedList}>
            {selected.map(id => {
              const { label, image } = facetOption(kind, id, facets, lang)
              return <FilterPicked key={id} label={label} removeLabel={t('remove', { label })} image={image} onRemove={() => onRemove(kind, id)}
                thumbClassName={kind === 'ego' ? 'rounded-full' : kind === 'theme' ? 'rounded-sm' : ''} imageClassName={kind === 'gift' || kind === 'affiliation' ? 'object-contain' : 'object-cover'} />
            })}
          </div>}
        </FilterSection>
      )
    })}
  </div>
}
