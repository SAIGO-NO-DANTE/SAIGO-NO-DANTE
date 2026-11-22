'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import SearchBox from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { giftEntries } from '@/features/planner/lib/gift-search'
import { localizeRowName } from '@/lib/i18n/localize'
import { pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { runSectionTitle } from './GiftCheckSection'
import InventoryPanel from './InventoryPanel'
const PlannerGiftModal = dynamic(() => import('@/features/planner/components/PlannerGiftModal'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

/**
 * Where the run stands, which the PiP has no room for: the plan's final gifts and how many are in hand (missing ones
 * dimmed; a click opens the gift's details, × takes it off the plan, the search adds one), then the held gifts and the
 * fusions they can make.
 */
export default function RunStatus({ state, dispatch, gifts, giftMap, recipes }: Props) {
  const t = useTranslations('planner.run')
  const clearLabel = useTranslations('globalSearch')('clear')
  const locale = useLocale() as SupportedLang
  const localized = (gift: GiftData) => localizeRowName(gift, locale)
  const ownedIds = useMemo(() => new Set(state.giftInventory.map(String)), [state.giftInventory])
  const targets = useMemo(() => [...new Set((state.targetGifts ?? []).map(id => String(Number(id))))].map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[],
    [state.targetGifts, giftMap])
  const targetIds = useMemo(() => new Set(targets.map(gift => gift.game_id)), [targets])
  const owned = targets.filter(gift => ownedIds.has(String(gift.game_id))).length
  const [search, setSearch] = useState('')
  const [modalGift, setModalGift] = useState<GiftData | null>(null)
  const modalTrigger = useRef<HTMLElement | null>(null)
  const closeModal = () => {
    setModalGift(null)
    const trigger = modalTrigger.current
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus() })
  }
  const searching = search.trim() !== ''
  // Built on the first letter: most runs never search here.
  const entries = useMemo(() => searching ? giftEntries(gifts, { locale }) : [], [searching, gifts, locale])
  // A gift found only by its effect is no name to suggest.
  const { top, total } = pickerFound(entries, gifts, gift => gift.id, search, (_, hit) => hit.kind !== 'text')

  return (
    <div data-run-status role="region" aria-label={t('viewOverview')} className="flex min-w-0 flex-col gap-8 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-[var(--border)] lg:px-6">
      <section className="min-w-0" aria-labelledby="run-target-gifts">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 id="run-target-gifts" className={runSectionTitle}>{t('targetGifts')}</h2>
          {targets.length > 0 && <span className="text-[0.8125rem] tabular-nums text-[var(--text-secondary)]">{t('targetProgress', { acquired: owned, total: targets.length })}</span>}
        </div>
        {targets.length > 0 ? <>
          <div aria-hidden="true" className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div className="h-full origin-left rounded-full bg-[var(--gold)] transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${owned / targets.length})` }} />
          </div>
          <ul className="mb-3 flex flex-wrap gap-2">
            {targets.map(gift => {
              const have = ownedIds.has(String(gift.game_id))
              const label = have ? `${localized(gift)}, ${t('acquired')}` : localized(gift)
              return <li key={gift.game_id} data-owned={have || undefined} className={have ? undefined : 'opacity-40'}>
                <GiftCard gift={gift} size="3.25rem" showName={false} title={label} ariaLabel={label}
                  onClick={() => { modalTrigger.current = document.activeElement as HTMLElement | null; setModalGift(gift) }}
                  onRemove={() => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: String(gift.game_id) })} />
              </li>
            })}
          </ul>
        </> : <p className="mb-3 text-xs leading-5 text-[var(--text-tertiary)]">{t('noTargetsHint')}</p>}
        <SearchBox className="max-w-sm" value={search} onChange={setSearch} label={t('addTargetGift')} clearLabel={clearLabel}
          groups={[pickGroup(translations['mirrorDungeon.tab.gifts'][locale], top,
            // A gift already a target is listed as added; picking it only empties the field.
            gift => { if (!targetIds.has(gift.game_id)) dispatch({ type: 'ADD_TARGET_GIFT', giftId: String(gift.game_id) }); setSearch('') },
            gift => targetIds.has(gift.game_id) ? t('added') : undefined)]} />
        {search.trim() && <p role="status" className="sr-only">{t('giftSearchCount', { count: total })}</p>}
      </section>
      <InventoryPanel state={state} dispatch={dispatch} giftMap={giftMap} recipes={recipes} />
      {modalGift && <PlannerGiftModal gift={modalGift} onClose={closeModal} gifts={gifts} />}
    </div>
  )
}
