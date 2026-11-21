'use client'

import BaseModal from '@/components/ui/BaseModal'
import DetailBack, { type DetailBackTarget } from '@/components/ui/DetailBack'
import QuietImage from '@/components/ui/QuietImage'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import ThemePackCard from '@/components/ui/ThemePackCard'
import SuggestionRibbon from '@/components/ui/SuggestionRibbon'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { SuggestionTitleSkeleton, ThemeTileSkeleton } from '@/components/ui/SuggestionSkeleton'
import { filterStyles } from '@/components/board/FilterControls'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, type ReactNode } from 'react'
import SearchBox from '@/components/ui/SearchBox'
import { pickGroup } from '@/components/ui/SearchRows'
import { pickerFound } from '@/lib/search/picker-search'
import { themePackEntries } from '@/lib/search/theme-pack-entries'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

interface ThemePackModalShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  imageUrl?: string | null
  eyebrow?: ReactNode
  meta?: ReactNode
  maxWidth?: string
  closeLabel: string
  /** Pack poster shown beside the title; replaces the faded banner image. */
  poster?: ReactNode
  /** The gift this pack was opened from. */
  back?: DetailBackTarget
}

export function ThemePackModalShell({
  title,
  onClose,
  children,
  imageUrl,
  eyebrow,
  meta,
  maxWidth = '52rem',
  closeLabel,
  poster,
  back,
}: ThemePackModalShellProps) {
  return (
    <BaseModal open={true} onClose={onClose} maxWidth={maxWidth} padding="1rem" title={title} sheet>
      <div
        className="relative w-full overflow-hidden rounded-t-xl sm:rounded-xl"
        style={{
          maxHeight: '88dvh',
          background: '#17120c',
          border: '1px solid #2e2417',
          boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ maxHeight: '88dvh', overflowY: 'auto', scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-3 right-3 z-20 rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{
              minWidth: '2.75rem',
              minHeight: '2.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>

          {back && <div className="ml-3 mt-2 flex pr-14"><DetailBack back={back} /></div>}

          {poster ? (
            <div className="flex items-end gap-4 px-5 pb-4 pr-14 pt-5 sm:gap-6">
              <div className="w-[5.5rem] shrink-0 sm:w-[8.5rem]">{poster}</div>
              <div className="min-w-0 flex-1 pb-1">
                {eyebrow && <div className="mb-2">{eyebrow}</div>}
                <h3 className="text-pretty" style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.375rem, 4vw, 1.875rem)', lineHeight: 1.25, color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
              </div>
            </div>
          ) : (
          <div className="relative overflow-hidden" style={{ minHeight: imageUrl ? '11rem' : '7.5rem' }}>
            {imageUrl ? (
              <>
                <QuietImage
                  src={imageUrl}
                  alt=""
                  fill
                  {...blurPlaceholder(imageUrl)}
                  sizes="(max-width: 768px) 100vw, 52rem"
                  className="object-cover object-center"
                  style={{ opacity: 0.42 }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.68) 52%, rgba(19,17,16,0.28) 100%)',
                  }}
                />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.08) 0%, transparent 72%)' }}
              />
            )}

            <div className="relative z-10 flex min-h-[7.5rem] flex-col justify-end px-5 pb-4 pr-16 pt-12 sm:pr-20">
              {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
              <h3
                className="font-serif text-xl font-bold text-pretty md:text-2xl"
                style={{
                  color: '#e8d8c0',
                  lineHeight: 1.32,
                  WebkitTextStroke: 0,
                  textShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.6)',
                }}
              >
                {title}
              </h3>
              {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div>}
            </div>
          </div>
          )}

          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </BaseModal>
  )
}

interface ThemePackModalPillProps {
  children: ReactNode
  tone?: 'gold' | 'red' | 'purple' | 'neutral'
}

export function ThemePackModalPill({ children, tone = 'neutral' }: ThemePackModalPillProps) {
  const styles = {
    gold: {
      background: 'rgba(200,144,10,0.16)',
      border: '1px solid rgba(200,144,10,0.28)',
      color: '#e8b030',
    },
    red: {
      background: 'rgba(224,64,64,0.18)',
      border: '1px solid rgba(224,64,64,0.28)',
      color: 'var(--error-text)',
    },
    purple: {
      background: 'rgba(144,112,176,0.16)',
      border: '1px solid rgba(144,112,176,0.34)',
      color: '#b090d0',
    },
    neutral: {
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#aaa',
    },
  }[tone]

  return (
    <span
      className="inline-flex items-center rounded-sm"
      style={{
        minHeight: '1.75rem',
        padding: '0.125rem 0.5rem',
        fontSize: '0.8125rem',
        ...styles,
      }}
    >
      {children}
    </span>
  )
}

interface ThemePackModalGridProps {
  children: ReactNode
  minColumnWidth?: string
}

export function ThemePackModalGrid({ children, minColumnWidth = '3.75rem' }: ThemePackModalGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`,
        gap: '0.5rem',
        position: 'relative',
        zIndex: 0,
      }}
    >
      {children}
    </div>
  )
}

interface ThemePackModalEmptyProps {
  children: ReactNode
}

function ThemePackModalEmpty({ children }: ThemePackModalEmptyProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        color: 'var(--text-muted)',
        fontSize: '0.9375rem',
        border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: '0.5rem',
        background: 'rgba(255,255,255,0.025)',
      }}
    >
      {children}
    </div>
  )
}

const SUGGESTED_LIMIT = 6

interface ThemePackPickerTheme {
  id: number | string
  name: string
  name_en?: string | null
  name_jp?: string | null
  image_url?: string | null
  ego_gift_ids?: number[] | null
  specific_ego_gift_ids?: number[] | null
  /** 'hard' and 'extreme' are named at the right edge of the pack's suggestion row. */
  difficulty?: string | null
}

interface ThemePackPickerModalProps<TTheme extends ThemePackPickerTheme> {
  title: string
  closeLabel: string
  emptyLabel: string
  searchLabel: string
  noResultsLabel: string
  countLabel: (count: number) => string
  themes: TTheme[]
  selectedThemeId?: string | number | null
  /** Packs already chosen, first choice first: each shows as selected with its place in the order. */
  order?: (string | number)[]
  onClose: () => void
  onSelectTheme: (theme: TTheme) => void
  /** Multi-pick (the window stays open): a line saying how picking works, a button that clears every pick and one that closes. */
  hint?: string
  onClearAll?: () => void
  clearAllLabel?: string
  doneLabel?: string
  lang?: SupportedLang
  meta?: ReactNode
  /** More text the search finds a pack by (the names of its gifts), besides its names. */
  searchText?: (theme: TTheme) => string
  /** Packs to list first under the "추천" ribbon, most picked first, with how many plans picked each (the number on the card's corner). Hidden while searching. */
  suggested?: { id: number | string; count: number }[] | null
  /** The suggestions are still being read: the group's place is held with its loading shape. */
  suggestionsLoading?: boolean
}

/** Picks a theme pack in the shared picker frame (the identity pickers'): header, a search over the packs, the posters. */
export function ThemePackPickerModal<TTheme extends ThemePackPickerTheme>({
  title,
  closeLabel,
  emptyLabel,
  searchLabel,
  noResultsLabel,
  countLabel,
  themes,
  selectedThemeId,
  order,
  onClose,
  onSelectTheme,
  hint,
  onClearAll,
  clearAllLabel,
  doneLabel,
  lang,
  meta,
  searchText,
  suggested,
  suggestionsLoading = false,
}: ThemePackPickerModalProps<TTheme>) {
  const [query, setQuery] = useState('')
  const locale = useLocale() as SupportedLang
  const clearLabel = useTranslations('globalSearch')('clear')
  const needle = query.trim()
  const entries = useMemo(() => themePackEntries(themes, lang ?? locale, searchText), [themes, lang, locale, searchText])
  // The grid keeps the packs found, best match first; a pack found only by the text of its gifts is no name to suggest.
  const { list: shown, top } = pickerFound(entries, themes, theme => String(theme.id), query, (_, hit) => hit.kind !== 'text')
  const hard = (theme: TTheme) => theme.difficulty === 'hard' || theme.difficulty === 'extreme'
  const themeById = new Map(themes.map(theme => [String(theme.id), theme]))
  const picks = needle ? [] : (suggested ?? []).flatMap(row => themeById.has(String(row.id)) ? [{ theme: themeById.get(String(row.id))!, count: row.count }] : []).slice(0, SUGGESTED_LIMIT)
  const holdPicks = suggestionsLoading && !needle
  const picked = new Set(picks.map(row => String(row.theme.id)))
  const rest = picks.length ? shown.filter(theme => !picked.has(String(theme.id))) : shown
  const rank = (theme: TTheme) => (order ?? []).findIndex(id => String(id) === String(theme.id)) + 1
  const card = (theme: TTheme, count?: number) => (
    <>
      <ThemePackCard
        theme={theme}
        onClick={() => onSelectTheme(theme)}
        isSelected={rank(theme) > 0 || (selectedThemeId != null && String(selectedThemeId) === String(theme.id))}
        lang={lang}
      />
      {/* Marks over the card: one layer the size of the art that grows with it on hover (the card scales its art 1.03), so they stay on its corners. */}
      <span className="pointer-events-none absolute inset-0.5 z-30 transition-transform duration-300 motion-safe:group-hover/tile:scale-[1.03]">
        {rank(theme) > 0 && (
          <span data-theme-order={rank(theme)} className="absolute left-1 top-1 rounded bg-[var(--gold)] px-1.5 pt-0.5 font-[family-name:var(--font-title)] text-[1.25rem] leading-none text-[var(--bg-deep)]">{rank(theme)}</span>
        )}
        {count != null && (
          <span className="absolute right-1 top-1 rounded bg-[rgba(13,11,8,0.82)] px-1.5 pt-0.5 font-[family-name:var(--font-title)] text-[1.25rem] leading-none text-[var(--gold-light)]">{count}</span>
        )}
      </span>
    </>
  )

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="60rem" title={title} sheet>
      <div className={filterStyles.picker}>
        <div className={filterStyles.pickerHead}>
          {/* The window's heading is the dialog title BaseModal already gives it; this is its visible copy. */}
          <p>{title}{meta && <span className="ml-2.5 inline-flex align-middle">{meta}</span>}</p>
          <button type="button" onClick={onClose} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {themes.length > 0 && (
          <div className="flex shrink-0 items-center gap-3 px-5 pt-4 max-sm:px-3">
            <SearchBox value={query} onChange={setQuery} label={searchLabel} clearLabel={clearLabel} className="min-w-0 flex-1 sm:max-w-[22rem]"
              groups={[pickGroup(translations['mirrorDungeon.tab.themes'][lang ?? locale], top, onSelectTheme,
                theme => hard(theme) ? <span style={{ color: 'var(--error-text)' }}>{translations[`mirrorDungeon.tier.${theme.difficulty as 'hard' | 'extreme'}`][lang ?? locale]}</span> : undefined, true)]} />
            <span className="shrink-0 text-sm tabular-nums text-[#9c8b73]">{countLabel(shown.length)}</span>
          </div>
        )}
        {onClearAll && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-5 pt-3 max-sm:px-3">
            {hint && <p className="min-w-[12rem] flex-1 text-sm text-[#9c8b73]">{hint}</p>}
            <button type="button" onClick={onClearAll} disabled={!order?.length}
              className="min-h-10 rounded-md border border-[#2e2417] px-3 text-[0.9375rem] text-[#c9b89f] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-45">
              {clearAllLabel}
            </button>
            <button type="button" onClick={onClose}
              className="min-h-10 rounded-md border border-[rgba(200,144,10,0.4)] bg-[rgba(200,144,10,0.12)] px-4 text-[0.9375rem] font-semibold text-[var(--gold-light)] transition-colors hover:bg-[rgba(200,144,10,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]">
              {doneLabel}
            </button>
          </div>
        )}
        <div className={filterStyles.pickerResults}>
          {themes.length === 0 ? (
            <div className="p-5"><ThemePackModalEmpty>{emptyLabel}</ThemePackModalEmpty></div>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-[0.9375rem] text-[#9c8b73]">{noResultsLabel}</p>
          ) : (
            <>
              {holdPicks && (
                <SkeletonPage>
                  <div className="px-5 pt-5 max-sm:px-3 max-sm:pt-4" data-suggestion-skeleton="theme"><SuggestionTitleSkeleton /></div>
                  <ul className={filterStyles.pickerGrid} style={{ paddingTop: '0.75rem' }}>
                    {Array.from({ length: SUGGESTED_LIMIT }, (_, index) => <li key={index}><ThemeTileSkeleton /></li>)}
                  </ul>
                </SkeletonPage>
              )}
              {picks.length > 0 && (
                <>
                  <div className="px-5 pt-5 max-sm:px-3 max-sm:pt-4"><SuggestionRibbon /></div>
                  <ul className={filterStyles.pickerGrid} style={{ paddingTop: '0.75rem' }}>
                    {picks.map(({ theme, count }) => (
                      <li key={String(theme.id)} className="group/tile relative">{card(theme, count)}</li>
                    ))}
                  </ul>
                </>
              )}
              <ul className={filterStyles.pickerGrid} style={picks.length || holdPicks ? { borderTop: '1px solid #2e2417' } : undefined}>
                {rest.map(theme => <li key={String(theme.id)} className="group/tile relative">{card(theme)}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
    </BaseModal>
  )
}
