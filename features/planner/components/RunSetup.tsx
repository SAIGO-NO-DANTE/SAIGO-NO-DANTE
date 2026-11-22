'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Play, X, RotateCcw, ChevronDown } from 'lucide-react'
import SearchBox from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import RunCaptureGuide from './RunCaptureGuide'
import { Link } from '@/lib/i18n/navigation'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { GiftData, IdentityData, SinnerData, EgoData } from '@/lib/planner/types'
import { loadRunDraft } from '@/features/planner/lib/encoder'
import { getLocalizedName } from '@/lib/i18n/localize'
import { pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import { giftEntries } from '@/features/planner/lib/gift-search'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  /** Screen recognition controls owned by the page; shown folded, since the defaults suit a first run. */
  recognition?: ReactNode
  /** Short name of the recognition mode currently chosen, shown on the folded summary. */
  recognitionSummary?: string
}

const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'overlap', 'extreme']
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]'
const fieldHeading = 'mb-2 text-sm font-bold text-[var(--text-primary)]'

export default function RunSetup({ state, dispatch, gifts, giftMap, recognition, recognitionSummary }: Props) {
  const t = useTranslations('planner.run')
  const clearLabel = useTranslations('globalSearch')('clear')
  const locale = useLocale() as SupportedLang
  const giftName = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const [giftSearch, setGiftSearch] = useState('')
  const [draft, setDraft] = useState<ReturnType<typeof loadRunDraft>>(null)
  useEffect(() => { setDraft(loadRunDraft()) }, [])

  const searching = giftSearch.trim() !== ''
  // Built on the first letter: most runs never search here.
  const entries = useMemo(() => searching ? giftEntries(gifts, { locale }) : [], [searching, gifts, locale])
  // A gift found only by its effect is no name to suggest.
  const { top } = pickerFound(entries, gifts, gift => gift.id, giftSearch, (_, hit) => hit.kind !== 'text')

  const inventoryGifts = useMemo(() =>
    state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const plan = state.sourcePlanSnapshot

  return (
    <div className="grid min-w-0 gap-x-10 gap-y-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* The capture button only exists once the run starts, so the game waits before Enter until it is connected. */}
      <div className="min-w-0 lg:min-h-0"><RunCaptureGuide /></div>

      <section aria-labelledby="run-setup" className="min-w-0 self-start border-t-2 border-[var(--gold)] bg-[var(--bg-panel)] p-4 sm:p-6 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain">
        <h2 id="run-setup" className="font-[family-name:var(--font-heading)] text-xl text-[var(--gold-light)]">{t('setupTitle')}</h2>

        <div className="mt-5 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--text-secondary)]">{t(plan ? 'planMode' : 'recordMode')}</p>
              {plan && <p className="truncate font-[family-name:var(--font-heading)] text-base text-[var(--text-primary)]">{plan.title?.trim() || t('setupPlanUntitled')}</p>}
            </div>
            <Link href="/planner/community" className={`inline-flex min-h-10 shrink-0 items-center rounded-md border border-[var(--border-gold)] px-3 text-xs font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] ${focus}`}>{t(plan ? 'setupPlanChange' : 'setupPlanPick')}</Link>
          </div>

          <div role="group" aria-labelledby="run-difficulty">
            <h3 id="run-difficulty" className={fieldHeading}>{t('difficulty')}</h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {DIFFICULTIES.map(d => {
                const active = state.difficulty === d
                const extreme = d === 'extreme'
                return <button key={d} type="button" aria-pressed={active}
                  onClick={() => dispatch({ type: 'INIT', difficulty: d, startFloor: state.startFloor })}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-md border px-2 py-1.5 transition-colors ${focus} ${active
                    ? extreme ? 'border-[#c0473b] bg-[#9b2c23] text-[var(--text-primary)]' : 'border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)]'
                    : 'border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)]'}`}>
                  <span className="text-sm font-bold">{t(`difficulty_${d}`)}</span>
                  <span className={`text-[0.6875rem] ${active ? 'opacity-80' : 'text-[var(--text-muted)]'}`}>{t('floorCount', { count: DIFFICULTY_CONFIG[d].floors })}</span>
                </button>
              })}
            </div>
          </div>

          <div role="group" aria-labelledby="run-start-floor">
            <h3 id="run-start-floor" className={fieldHeading}>{t('startFloor')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: state.maxFloors }, (_, i) => i + 1).map(floor => {
                const active = state.startFloor === floor
                return <button key={floor} type="button" aria-pressed={active} aria-label={t('floorNumber', { floor })}
                  onClick={() => dispatch({ type: 'INIT', difficulty: state.difficulty, startFloor: floor })}
                  className={`grid h-11 w-11 place-items-center rounded-md border font-[family-name:var(--font-title)] text-xl leading-none transition-colors ${focus} ${active
                    ? 'border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg-deep)]'
                    : 'border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)]'}`}>{floor}</button>
              })}
            </div>
            {state.startFloor > 1 && <p role="status" className="mt-2 break-keep text-xs leading-5 text-[var(--gold-light)]">{t('limited')}</p>}
          </div>

          {state.startFloor > 1 && (
            <div>
              <h3 className={fieldHeading}>{t('startingGifts')}</h3>
              <SearchBox value={giftSearch} onChange={setGiftSearch} label={t('searchGifts')} clearLabel={clearLabel}
                groups={[pickGroup(translations['mirrorDungeon.tab.gifts'][locale], top, gift => { dispatch({ type: 'ACQUIRE_GIFT', giftId: String(gift.game_id) }); setGiftSearch('') })]} />
              {inventoryGifts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {inventoryGifts.map((gift, i) => (
                    <span key={`${gift.game_id}-${i}`} className="inline-flex items-center gap-1 rounded bg-[var(--bg-elevated)] py-1 pl-2 pr-1 text-[0.6875rem] text-[var(--text-primary)]">
                      {giftName(gift)}
                      <button type="button" aria-label={t('removeGift', { name: giftName(gift) })} onClick={() => dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) })}
                        className={`grid h-6 w-6 place-items-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] ${focus}`}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {recognition && <details className="group rounded-md border border-[var(--border)] bg-[var(--bg-deep)]">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-bold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden ${focus}`}>
              <span>{t('setupRecognitionTitle')}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-[var(--text-secondary)]">{recognitionSummary}<ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" /></span>
            </summary>
            <div className="space-y-3 border-t border-[var(--border)] p-3">
              {recognition}
            </div>
          </details>}

          {draft && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t('resumeRun')}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{draft.label}</p>
              </div>
              <button type="button" onClick={() => dispatch({ type: 'LOAD_RUN', state: draft.state })}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-gold)] px-3 text-xs text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] ${focus}`}>
                <RotateCcw aria-hidden="true" size={13} /> {t('restore')}
              </button>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-5">
            <button type="button" onClick={() => dispatch({ type: 'START_RUN' })}
              className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-[var(--gold)] px-5 text-lg font-bold text-[var(--bg-deep)] transition-colors hover:bg-[var(--gold-light)] ${focus}`}>
              <Play aria-hidden="true" size={20} fill="currentColor" />
              {t('start')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
