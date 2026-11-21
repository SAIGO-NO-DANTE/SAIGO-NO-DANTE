'use client'

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import IdentityFrameCard, { getFormationOverlay } from '@/components/cards/IdentityFrameCard'
import type { EgoSlotItem, FormationStripSkill, SkillCountEdit } from '@/components/cards/EgoSlotRows'
import FormationBoard from '@/features/decks/components/FormationBoard'
import Image from 'next/image'
import { ChevronDown, ChevronUp, ClipboardPaste, Download, RotateCcw, X } from 'lucide-react'
import { showSuccess } from '@/lib/toast'
import BaseModal from '@/components/ui/BaseModal'
import SuggestionRibbon from '@/components/ui/SuggestionRibbon'
import { IdentityTileSkeleton, SuggestionTitleSkeleton } from '@/components/ui/SuggestionSkeleton'
import { SkeletonPage } from '@/components/ui/Skeleton'
import SuggestionNote, { useArchetypeLabel } from './SuggestionNote'
import { createLongPress } from '@/lib/utils/long-press'
import type { Archetype, Suggestion } from '@/lib/community/suggestion-types'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import { pickGroup } from '@/components/ui/SearchRows'
import { identityIcon, pickerEntries, pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import { compareReleaseDate } from '@/lib/utils/release-order'
import { localizeIdentityName } from '@/lib/decks/localize'
import { LCB_IDS } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import { getCompactNameStyle } from '@/lib/planner/compact-name-style'
import { useLocale, useTranslations } from 'next-intl'

import { useSinnerName } from '@/features/decks/hooks/useSinnerName'
import { SUGGESTED_LIMIT, type PlannerDeckIdentity, type PlannerDeckSinner, type PlannerIdentityBoardSlot } from '@/features/decks/lib/deck-selection'
import '@/components/ui/character-picker.css'

// 소비처가 한 파일에서 가져오던 이름들. 에고 쪽은 PlannerEgoSelection.tsx, 타입은 lib/deck-selection.ts에 있다.
export type { PlannerDeckEgo, PlannerDeckIdentity, PlannerDeckSinner, PlannerEgoBoardSlot, PlannerIdentityBoardSlot } from '@/features/decks/lib/deck-selection'
export { PLANNER_EGO_GRADE_ORDER } from '@/features/decks/lib/deck-selection'
export { PlannerEgoBoard, PlannerEgoSelectModal } from './PlannerEgoSelection'

const UPTIES = [1, 2, 3, 4] as const
const ROMAN = ['I', 'II', 'III', 'IV']

/**
 * Formation board with a fixed footprint: [bar slot][grid][bar slot].
 * View: the 12 chosen identities, bar in the bottom slot; clicking a card appends/removes
 * it from the formation order. Edit: the bar moves to the top slot and a sheet covers the
 * grid box exactly; clicking a sinner opens the identity picker. Nothing shifts between states.
 */
export function PlannerIdentityBoard({
  sinners,
  slots,
  onOpenIdentityModal,
  onFormationToggle,
  onResetOrder,
  onApplyCode,
  onImport,
  onLongPress,
  getSinnerName,
}: {
  sinners: PlannerDeckSinner[]
  slots: Record<string, PlannerIdentityBoardSlot | undefined>
  onOpenIdentityModal: (sinnerId: string) => void
  onFormationToggle: (sinnerId: string) => void
  /** Clears every formation number (all back to the bench). */
  onResetOrder?: () => void
  /** Loads a pasted formation code; false when it is not a valid code (the field then shows the error). */
  /** Resolves true when the code was read (the reader loads on the first use). */
  onApplyCode?: (code: string) => Promise<boolean>
  /** Opens the picker of my saved decks/plans to take a formation from. */
  onImport?: { label: string; open: () => void }
  /** Hold a view tile (500ms) to open identity details. */
  onLongPress?: (sinnerId: string) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.identity')
  const locale = useLocale() as SupportedLang
  const sinnerNameOf = useSinnerName(locale, getSinnerName)
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [codeInvalid, setCodeInvalid] = useState(false)
  // 평소에는 버튼 하나: 클립보드의 코드를 바로 불러오고, 읽을 수 없거나 코드가 아니면 그때 입력창을 연다.
  const [codeOpen, setCodeOpen] = useState(false)
  const applyCode = async () => {
    if (!onApplyCode || !code.trim()) return
    if (await onApplyCode(code.trim())) { setCode(''); setCodeOpen(false) }
    else setCodeInvalid(true)
  }
  const pasteCode = async () => {
    if (!onApplyCode) return
    const text = await navigator.clipboard?.readText().catch(() => '') ?? ''
    if (text.trim() && await onApplyCode(text.trim())) return
    setCode(text.trim())
    setCodeInvalid(Boolean(text.trim()))
    setCodeOpen(true)
  }
  const [press] = useState(() => createLongPress<string>(sinnerId => latest.current.onLongPress?.(sinnerId), 500))
  // Tiles are memoized; handlers read the latest callbacks through a ref so a formation click
  // re-renders only the tiles whose number changed.
  const latest = useRef({ onFormationToggle, onOpenIdentityModal, onLongPress })
  useLayoutEffect(() => { latest.current = { onFormationToggle, onOpenIdentityModal, onLongPress } })
  const startPress = useCallback((sinnerId: string) => {
    if (latest.current.onLongPress) press.start(sinnerId)
  }, [press])
  const endPress = press.cancel
  const activate = useCallback((sinnerId: string, view: boolean) => {
    if (!view) return latest.current.onOpenIdentityModal(sinnerId)
    if (press.consume()) return
    latest.current.onFormationToggle(sinnerId)
  }, [press])
  const hasOrder = sinners.some(sinner => slots[sinner.id]?.identity && getFormationOverlay(slots[sinner.id]?.slotOrder ?? null))

  const tile = (sinner: PlannerDeckSinner, mode: 'view' | 'edit') => {
    const slot = slots[sinner.id]
    const identity = slot?.identity ?? null
    const sinnerName = sinnerNameOf(sinner)
    const name = slot?.identityName ?? (identity ? localizeIdentityName(identity, locale) : '')
    const order = mode === 'view' ? slot?.slotOrder ?? null : null
    const overlay = getFormationOverlay(order)
    const view = mode === 'view'
    return (
      <BoardTile
        key={sinner.id}
        sinnerId={sinner.id}
        view={view}
        identity={identity}
        uptie={slot?.uptie}
        name={name}
        sinnerName={sinnerName}
        order={order}
        giftBadgeUrls={view ? slot?.giftBadgeUrls : undefined}
        skills={view ? slot?.skills : undefined}
        egos={view ? slot?.egos : undefined}
        ariaLabel={view
          ? sinnerName + ' ' + name + ' ' + (overlay ? t('removeFormation') + ' ' + overlay.order : t('addFormation'))
          : t('change') + ' ' + sinnerName + ' ' + name}
        longPress={view && !!onLongPress}
        onActivate={activate}
        onPressStart={startPress}
        onPressEnd={endPress}
      />
    )
  }

  return (
    <section className="fboard" data-editing={editing}>
      {(onResetOrder || onApplyCode || onImport) && (
        <div className="fboard__tools" inert={editing}>
          {onApplyCode && !codeOpen && (
            <button type="button" className="fboard__paste" onClick={pasteCode} title={t('codePasteHint')}>
              <ClipboardPaste aria-hidden="true" />
              {t('codePlaceholder')}
            </button>
          )}
          {onImport && !codeOpen && (
            <button type="button" className="fboard__paste fboard__import" onClick={onImport.open} aria-label={onImport.label}>
              <Download aria-hidden="true" />
              <span className="max-sm:sr-only">{onImport.label}</span>
            </button>
          )}
          {onApplyCode && codeOpen && (
            <form className="fboard__code" onSubmit={event => { event.preventDefault(); applyCode() }}>
              <input autoFocus value={code} onChange={event => { setCode(event.target.value); setCodeInvalid(false) }} placeholder={t('codePlaceholder')}
                aria-label={t('codeLabel')} aria-invalid={codeInvalid} aria-describedby={codeInvalid ? 'fboard-code-error' : undefined}
                onKeyDown={event => { if (event.key === 'Escape') { setCodeOpen(false); setCodeInvalid(false) } }}
                autoComplete="off" spellCheck={false} />
              <button type="submit" disabled={!code.trim()}>{t('codeApply')}</button>
              <button type="button" className="fboard__code-close" aria-label={t('codeCancel')} onClick={() => { setCodeOpen(false); setCodeInvalid(false) }}><X aria-hidden="true" /></button>
              {codeInvalid && <span id="fboard-code-error" role="alert" className="fboard__code-error">{t('codeInvalid')}</span>}
            </form>
          )}
          {onResetOrder && (
            <button type="button" className="fboard__reset" disabled={!hasOrder} onClick={() => { onResetOrder(); showSuccess(t('resetOrderDone')) }}>
              <RotateCcw aria-hidden="true" />
              {t('resetOrder')}
            </button>
          )}
        </div>
      )}
      <button type="button" className="fboard__bar" aria-expanded={editing} onClick={() => setEditing(open => !open)}>
        {editing ? t('editDone') : t('editOpen')}
        {editing ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
      </button>
      <div className="fboard__stage">
        <ol className="fboard__grid" inert={editing}>{sinners.map(sinner => tile(sinner, 'view'))}</ol>
        <div className="fboard__sheet" inert={!editing}>
          <ol className="fboard__grid">{sinners.map(sinner => tile(sinner, 'edit'))}</ol>
        </div>
      </div>
      <p className="fboard__hint" aria-hidden={!editing}>{t('editHint')}</p>
      <style jsx global>{`
        /* One card width drives the grid and the tools row above it, so both share the same edges. */
        .fboard { --bar: 3rem; --gap: 0.5rem; --fboard-w: 100%; position: relative; width: 100%; min-width: 0; padding-block: calc(var(--bar) + var(--gap)); }
        /* clip, not hidden: the clip margin leaves room for the game's hover frame and focus growth of edge cards. */
        .fboard__stage { position: relative; overflow: clip; overflow-clip-margin: 0.75rem; }
        .fboard__grid {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.625rem 0.375rem;
          width: 100%; max-width: var(--fboard-w); margin: 0 auto; padding: 0.75rem 0; list-style: none;
        }
        .fboard__grid > li { min-width: 0; }
        .fboard__sheet {
          position: absolute; inset: 0; z-index: 10; overflow: clip; overflow-clip-margin: 0.75rem;
          background: #17120c; box-shadow: inset 0 1px #2e2417, inset 0 -1px #2e2417;
          transform: translateY(100%); visibility: hidden;
          transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 280ms;
        }
        .fboard[data-editing='true'] .fboard__sheet { transform: none; visibility: visible; transition-delay: 0s; }
        .fboard__bar {
          position: absolute; left: 0; right: 0; top: calc(100% - var(--bar)); z-index: 11; height: var(--bar);
          display: flex; align-items: center; justify-content: center; gap: 0.375rem;
          border: 1px solid #3a2c18; border-radius: 0.25rem; background: #1d160d; color: #e8b030;
          cursor: pointer; font-family: var(--font-heading), var(--font-sans); font-size: 1rem;
          transition: top 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 0.15s ease, border-color 0.15s ease;
        }
        .fboard[data-editing='true'] .fboard__bar { top: 0; }
        .fboard__hint {
          position: absolute; left: 0; right: 0; bottom: 0; height: var(--bar); display: flex; align-items: center; justify-content: center;
          color: #9c8b73; font-size: 0.9375rem; text-align: center; opacity: 0; transition: opacity 180ms ease;
        }
        .fboard[data-editing='true'] .fboard__hint { opacity: 1; transition-delay: 150ms; }
        .fboard__bar svg { width: 1.125rem; height: 1.125rem; }
        .fboard__tools {
          position: absolute; left: 0; right: 0; top: 0; max-width: var(--fboard-w); height: var(--bar); margin-inline: auto;
          display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;
          transition: opacity 180ms ease, visibility 0s linear 0s;
        }
        .fboard__code { position: relative; display: flex; min-width: 0; flex: 1 1 auto; max-width: 24rem; margin-right: auto; }
        .fboard__paste {
          display: inline-flex; min-height: 2.25rem; align-items: center; gap: 0.4375rem; margin-right: auto; padding: 0 0.875rem;
          border: 1px solid #3a2c18; border-radius: 0.25rem; background: #140f09; color: #cbb994; cursor: pointer; font-size: 0.875rem; white-space: nowrap;
          transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
        }
        .fboard__paste:has(+ .fboard__import) { margin-right: 0.5rem; }
        .fboard__import { margin-right: auto; }
        .fboard__paste svg { width: 0.9375rem; height: 0.9375rem; color: #c8900a; }
        .fboard__paste:hover { border-color: #c8900a; color: #e8b030; background: #1d160d; }
        .fboard__paste:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
        .fboard__code .fboard__code-close { width: 2.25rem; padding: 0; margin-left: 0.375rem; display: grid; place-items: center; border: 1px solid #3a2c18; border-radius: 0.25rem; background: transparent; color: #9c8b73; }
        .fboard__code .fboard__code-close svg { width: 1rem; height: 1rem; }
        .fboard__code input {
          min-width: 0; flex: 1 1 auto; height: 2.25rem; padding: 0 0.625rem; border: 1px solid #3a2c18; border-right: 0;
          border-radius: 0.25rem 0 0 0.25rem; background: #140f09; color: #e8dcc8; font-family: var(--font-mono); font-size: 0.8125rem;
          outline: none; transition: border-color 0.15s ease;
        }
        .fboard__code input::placeholder { color: var(--text-muted); font-family: var(--font-sans); }
        .fboard__code input:focus-visible { border-color: #c8900a; }
        .fboard__code input[aria-invalid='true'] { border-color: #9b2c23; }
        .fboard__code button {
          flex: 0 0 auto; height: 2.25rem; padding: 0 0.875rem; border: 1px solid #c8900a; border-radius: 0 0.25rem 0.25rem 0;
          background: rgba(200, 144, 10, 0.14); color: #e8b030; cursor: pointer; font-size: 0.875rem; white-space: nowrap;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }
        .fboard__code button:hover:not(:disabled) { background: rgba(200, 144, 10, 0.26); }
        .fboard__code button:disabled { cursor: default; opacity: 0.4; }
        .fboard__code button:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
        .fboard__code-error { position: absolute; left: 0; top: calc(100% + 0.125rem); color: #d4675c; font-size: 0.75rem; white-space: nowrap; }
        .fboard[data-editing='true'] .fboard__tools { opacity: 0; visibility: hidden; transition-delay: 0s, 180ms; }
        .fboard__reset {
          display: inline-flex; min-height: 2.75rem; align-items: center; gap: 0.375rem; padding: 0 0.5rem;
          flex: 0 0 auto; border-radius: 0.25rem; color: #9c8b73; cursor: pointer; font-size: 0.875rem; white-space: nowrap; transition: color 0.15s ease;
        }
        .fboard__reset svg { width: 0.875rem; height: 0.875rem; }
        .fboard__reset:hover:not(:disabled) { color: #e8b030; }
        .fboard__reset:disabled { cursor: default; opacity: 0.4; }
        .fboard__reset:focus-visible { outline: 2px solid #e8b030; outline-offset: 0; }
        .fboard__bar:hover { border-color: #c8900a; background: #261c0f; }
        .fboard__bar:focus-visible, .fboard__tile:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
        .fboard__tile {
          position: relative; display: block; width: 100%; padding: 0; border: 0; background: none; cursor: pointer;
          touch-action: manipulation; -webkit-touch-callout: none; user-select: none; transition: filter 0.15s ease;
        }
        .fboard__tile:disabled { cursor: default; }
        .fboard__tile:not(:disabled):hover { filter: brightness(1.12); }
        .fboard__empty {
          display: flex; width: 100%; aspect-ratio: 290 / 428; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
          border: 1px dashed #3a2c18; border-radius: 0.25rem; color: #9c8b73; font-size: 0.8125rem;
        }
        .fboard__empty img { width: 2rem; height: 2rem; opacity: 0.4; }
        /* Six across from tablets up. Half-width windows keep cards small; wide screens match the deck detail board. */
        @media (min-width: 40rem) {
          .fboard { --fboard-card: 7.75rem; --fboard-col-gap: 0.75rem; --fboard-w: calc(6 * var(--fboard-card) + 5 * var(--fboard-col-gap)); }
          .fboard__grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.75rem var(--fboard-col-gap); }
        }
        @media (min-width: 64rem) { .fboard { --fboard-card: 8.75rem; --fboard-col-gap: 1rem; } .fboard__grid { row-gap: 0.875rem; } }
        @media (prefers-reduced-motion: reduce) { .fboard__sheet, .fboard__tile, .fboard__bar, .fboard__hint, .fboard__tools, .fboard__reset { transition: none; } }
      `}</style>
    </section>
  )
}

type BoardTileProps = {
  sinnerId: string
  view: boolean
  identity: PlannerDeckIdentity | null
  uptie?: number
  name: string
  sinnerName: string
  order: number | null
  giftBadgeUrls?: string[]
  /** Under the card (view only): skills 1-3 and this sinner's E.G.O, as on the deck detail board. */
  skills?: (FormationStripSkill | null)[]
  egos?: Record<string, EgoSlotItem | undefined>
  ariaLabel: string
  longPress: boolean
  onActivate: (sinnerId: string, view: boolean) => void
  onPressStart: (sinnerId: string) => void
  onPressEnd: () => void
}

const BoardTile = memo(function BoardTile({ sinnerId, view, identity, uptie, name, sinnerName, order, giftBadgeUrls, ariaLabel, longPress, onActivate, onPressStart, onPressEnd }: BoardTileProps) {
  return (
    <li>
      <button
        type="button"
        className="fboard__tile"
        disabled={view && !identity}
        aria-pressed={view && identity ? !!getFormationOverlay(order) : undefined}
        aria-label={ariaLabel}
        onClick={() => onActivate(sinnerId, view)}
        onPointerDown={view && identity ? () => onPressStart(sinnerId) : undefined}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={longPress ? event => event.preventDefault() : undefined}
      >
        {identity ? (
          <IdentityFrameCard identity={identity} uptie={uptie} name={name} order={order} giftBadgeUrls={giftBadgeUrls} sizes="(max-width: 40rem) 30vw, 9rem" />
        ) : (
          <span className="fboard__empty">
            <Image src={getSinnerLogoUrl(sinnerId)} alt="" width={32} height={32} />
            <span>{sinnerName}</span>
          </span>
        )}
      </button>
      {/* no strip under the card here: the builders keep the board plain (USER 2026-11-13: 만드는 곳에서는 안 보이게) */}
    </li>
  )
}, (a, b) => (Object.keys(a) as (keyof BoardTileProps)[]).every(key => (
  // arrays/objects are rebuilt on every render of the board: compare by content so a formation click still re-renders only the changed tiles
  key === 'giftBadgeUrls' || key === 'skills' || key === 'egos' ? JSON.stringify(a[key]) === JSON.stringify(b[key]) : Object.is(a[key], b[key])
)))

/** The identity board in the skill look (deck detail's skill view): cards darkened, skills 1-3 with ×count over them. `edits` puts − / + and the presets on each card (the skill exchange of the builders). */
export function PlannerSkillBoard({ sinners, slots, getSinnerName, edits }: {
  sinners: PlannerDeckSinner[]
  slots: Record<string, PlannerIdentityBoardSlot | undefined>
  getSinnerName?: (sinner: PlannerDeckSinner) => string
  edits?: Record<string, SkillCountEdit | undefined>
}) {
  const locale = useLocale() as SupportedLang
  const sinnerNameOf = useSinnerName(locale, getSinnerName)
  return (
    <FormationBoard
      view="skill"
      slots={sinners.map(sinner => {
        const slot = slots[sinner.id]
        const identity = slot?.identity ?? null
        const name = slot?.identityName ?? (identity ? localizeIdentityName(identity, locale) : '')
        return {
          key: sinner.id,
          identity: identity && { ...identity, name },
          sinnerId: sinner.id,
          slotOrder: null,
          uptie: slot?.uptie,
          skills: identity ? slot?.skills : undefined,
          skillEdit: identity ? edits?.[sinner.id] : undefined,
          ariaLabel: sinnerNameOf(sinner) + ' ' + name,
        }
      })}
    />
  )
}

export function PlannerIdentitySelectModal({
  open,
  sinner,
  identities,
  selectedIdentityId,
  selectedUptie = 4,
  suggestions,
  archetype,
  suggestionsLoading = false,
  partnerIdentity,
  onClose,
  onSelect,
  getSinnerName,
}: {
  open: boolean
  sinner: PlannerDeckSinner | null
  identities: PlannerDeckIdentity[]
  selectedIdentityId?: string | null
  selectedUptie?: number
  /** Suggested identities, most fitting first, listed under the "추천" ribbon with who they pair with; only while nothing is searched or filtered. */
  suggestions?: readonly Suggestion[] | null
  /** The archetype of the chosen identities, named beside the ribbon when it has keywords. */
  archetype?: Archetype | null
  /** The suggestions are still being read: hold the group's place with its loading shape. */
  suggestionsLoading?: boolean
  /** Looks up a partner's identity (any sinner) for its face. */
  partnerIdentity?: (id: string) => PlannerDeckIdentity | undefined
  onClose: () => void
  /** Plain click applies uptie 4; the picker passes the chosen uptie. "Back to LCB" passes the LCB identity at IV: a sinner is never left empty. */
  onSelect: (identity: PlannerDeckIdentity, uptie: number) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.identity')
  const locale = useLocale() as SupportedLang
  const sinnerNameOf = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)
  const [query, setQuery] = useState(''), [grade, setGrade] = useState('')
  const [picker, setPicker] = useState<string | null>(null)
  const [press] = useState(() => createLongPress<string>(setPicker, 450))
  useEffect(() => { setQuery(''); setGrade(''); setPicker(null) }, [open, sinner?.id])
  const needle = query.trim().toLocaleLowerCase()
  const entries = useMemo(() => pickerEntries('identity', identities, locale, identity => ({
    id: identity.id, label: localizeIdentityName(identity, locale), names: { ko: identity.name_kr || identity.name, en: identity.name_en, ja: identity.name_jp }, icon: identityIcon(identity),
  })), [identities, locale])
  // Newest first; with a query the best match first.
  const { list: filtered, top } = pickerFound(entries, identities.filter(identity => !grade || String(identity.rarity) === grade).sort(compareReleaseDate), identity => identity.id, query)
  const byId = new Map(filtered.map(identity => [identity.id, identity]))
  const suggestionOf = new Map((suggestions ?? []).map(suggestion => [suggestion.id, suggestion]))
  const holdSuggested = suggestionsLoading && !needle && !grade
  const suggested = needle || grade ? [] : (suggestions ?? []).flatMap(suggestion => byId.get(suggestion.id) ?? []).slice(0, SUGGESTED_LIMIT)
  const archetypeLabel = useArchetypeLabel()(archetype)
  const suggestedSet = new Set(suggested.map(identity => identity.id))
  const rest = suggested.length ? filtered.filter(identity => !suggestedSet.has(identity.id)) : filtered
  const lcb = sinner ? identities.find(identity => identity.game_id === LCB_IDS[sinner.id]) : undefined
  const canResetToLcb = lcb && (selectedIdentityId !== lcb.id || selectedUptie !== 4)


  return (
    <BaseModal open={open && !!sinner} onClose={onClose} maxWidth="64rem" title={t('modalTitle')}>
      {sinner && (
        <div className="idpick">
          <div className="idpick__header">
            <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} className="idpick__logo" />
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ ...compactNameStyle, color: 'var(--text-primary)', fontSize: '1.0625rem' }}>{t('modalHeading', { sinner: sinnerNameOf(sinner) })}</p>
              <p className="idpick__hint">{t('uptieHint')}</p>
            </div>
            {canResetToLcb && (
              <button type="button" onClick={() => onSelect(lcb, 4)} className="idpick__clear" aria-label={t('resetLcb')} title={t('resetLcb')}>
                <RotateCcw aria-hidden="true" />
                <span className="idpick__clear-long">{t('resetLcb')}</span>
                <span className="idpick__clear-short" aria-hidden="true">LCB</span>
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t('close')} className="idpick__close">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="character-picker-layout">
            <CharacterPickerFilters query={query} onQuery={setQuery} grade={grade} onGrade={setGrade} grades={[3, 2, 1].map(n => ({ value: String(n), label: '0'.repeat(n) }))} count={filtered.length} groups={[pickGroup(translations['sinners.identities'][locale], top, identity => onSelect(identity, 4))]} />
            <div className="idpick__results">
              {holdSuggested && (
                <SkeletonPage>
                  <div className="idpick__suggest" data-suggestion-skeleton="identity"><SuggestionTitleSkeleton archetype /></div>
                  <ul className="idpick__grid" data-group="suggested">
                    {Array.from({ length: SUGGESTED_LIMIT }, (_, index) => <li key={index} className="idpick__card"><IdentityTileSkeleton /></li>)}
                  </ul>
                </SkeletonPage>
              )}
              {(suggested.length ? [{ items: suggested, ribbon: true }, { items: rest, ribbon: false }] : [{ items: rest, ribbon: false }]).map(group => (
                <Fragment key={group.ribbon ? 'suggested' : 'rest'}>
                  {group.ribbon && <div className="idpick__suggest"><SuggestionRibbon />{archetypeLabel && <span className="idpick__archetype">{archetypeLabel}</span>}</div>}
                  <ul className="idpick__grid" data-group={group.ribbon ? 'suggested' : suggested.length || holdSuggested ? 'after-suggested' : undefined}>
                    {group.items.map(identity => {
                      const selected = selectedIdentityId === identity.id
                      const name = localizeIdentityName(identity, locale)
                      // Hover only reveals the uptie bar; nothing changes until a numeral (or the card, = IV) is clicked.
                      const shownUptie = selected ? selectedUptie : 4
                      return (
                        <li key={identity.id} className="idpick__card" data-picker={picker === identity.id}>
                          <button
                            type="button"
                            className="idpick__main"
                            aria-pressed={selected}
                            aria-label={name + ' ' + t('uptie', { level: ROMAN[3] })}
                            onClick={() => {
                              if (press.consume()) return
                              onSelect(identity, 4)
                            }}
                            onPointerDown={event => {
                              if (event.pointerType !== 'mouse') press.start(identity.id)
                            }}
                            onPointerUp={press.cancel}
                            onPointerLeave={press.cancel}
                            onPointerCancel={press.cancel}
                            onContextMenu={event => event.preventDefault()}
                          >
                            <IdentityFrameCard identity={identity} uptie={shownUptie} name={name} selected={selected} sizes="(max-width: 40rem) 30vw, 10rem" />
                          </button>
                          <div className="idpick__upties" role="group" aria-label={name + ' ' + t('uptieGroup')}>
                            {UPTIES.map(level => (
                              <button
                                key={level}
                                type="button"
                                aria-pressed={selected && selectedUptie === level}
                                data-current={shownUptie === level}
                                aria-label={name + ' ' + t('uptie', { level: ROMAN[level - 1] })}
                                onClick={() => onSelect(identity, level)}
                              >
                                {ROMAN[level - 1]}
                              </button>
                            ))}
                          </div>
                          {group.ribbon && partnerIdentity && suggestionOf.has(identity.id) && <SuggestionNote suggestion={suggestionOf.get(identity.id)!} identityOf={partnerIdentity} />}
                        </li>
                      )
                    })}
                  </ul>
                </Fragment>
              ))}
              {filtered.length === 0 && <p className="py-8 text-center" style={{ color: '#9c8b73', fontSize: '0.9375rem' }}>{t('noResults')}</p>}
            </div>
          </div>
          <style jsx>{`
            .idpick {
              display: flex; flex-direction: column; height: 86dvh; max-height: 52rem; overflow: hidden;
              border: 1px solid #2e2417; border-radius: 0.5rem; background: #17120c; box-shadow: 0 1rem 3rem rgba(0,0,0,0.8);
            }
            .idpick__header { display: flex; flex-shrink: 0; align-items: center; gap: 0.75rem; padding: 0.75rem 0.75rem 0.75rem 1.25rem; border-bottom: 1px solid #2e2417; }
            .idpick__header :global(.idpick__logo) { width: 1.5rem; height: 1.5rem; opacity: 0.75; }
            .idpick__hint { margin-top: 0.125rem; color: #9c8b73; font-size: 0.8125rem; line-height: 1.4; }
            .idpick__clear { display: inline-flex; flex-shrink: 0; min-height: 2.75rem; align-items: center; gap: 0.375rem; padding: 0 0.75rem; border: 1px solid #3a2c18; border-radius: 0.25rem; color: #cbb994; font-size: 0.875rem; cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease; }
            .idpick__clear :global(svg) { width: 0.875rem; height: 0.875rem; }
            .idpick__clear-short { display: none; }
            .idpick__clear:hover { border-color: #8a6010; color: #e8b030; }
            .idpick__clear:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
            .idpick__close { display: inline-flex; flex-shrink: 0; min-width: 2.75rem; min-height: 2.75rem; align-items: center; justify-content: center; color: #9c8b73; cursor: pointer; }
            .idpick__close :global(svg) { width: 1.25rem; height: 1.25rem; }
            .idpick__results { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
            .idpick__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 1.25rem 1rem; padding: 1.25rem; list-style: none; }
            .idpick__suggest { display: flex; align-items: center; gap: 0.625rem; padding: 1.25rem 1.25rem 0; }
            .idpick__archetype { color: #cbb994; font-family: var(--font-heading), var(--font-sans); font-size: 0.9375rem; }
            .idpick__grid[data-group='suggested'] { padding-top: 0.75rem; }
            .idpick__grid[data-group='after-suggested'] { margin-top: 0.25rem; border-top: 1px solid #2e2417; }
            .idpick__card { position: relative; min-width: 0; }
            .idpick__main { display: block; width: 100%; padding: 0; border: 0; background: none; cursor: pointer; -webkit-touch-callout: none; user-select: none; transition: filter 0.15s ease; }
            .idpick__main:hover { filter: brightness(1.1); }
            .idpick__upties {
              position: absolute; left: 12%; right: 12%; top: 15%; z-index: 6; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.125rem;
              padding: 0.1875rem; border-radius: 999px; background: rgba(10,8,6,0.88); box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,0.6);
              opacity: 0; pointer-events: none; transition: opacity 0.15s ease;
            }
            .idpick__card:hover .idpick__upties, .idpick__card:focus-within .idpick__upties, .idpick__card[data-picker='true'] .idpick__upties {
              opacity: 1; pointer-events: auto;
            }
            .idpick__upties button {
              min-height: 1.75rem; border: 1px solid transparent; border-radius: 999px; color: #b8a888; cursor: pointer;
              font-family: var(--font-title), var(--font-sans); font-size: 1.0625rem; line-height: 1;
            }
            .idpick__upties button:hover { color: #fff3d6; }
            .idpick__upties button:focus-visible { outline: 2px solid #e8b030; outline-offset: 1px; }
            .idpick__upties button[data-current='true'] { border-color: #e8b030; color: #ffd76a; background: rgba(200,144,10,0.14); }
            .idpick__main:focus-visible { outline: 2px solid #e8b030; outline-offset: 3px; }
            @media (pointer: coarse) { .idpick__upties button { min-height: 2.75rem; } }
            @media (max-width: 39.9375rem) {
              .idpick__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem 0.5rem; padding: 1rem 0.75rem; }
              .idpick__suggest { padding: 1rem 0.75rem 0; }
              .idpick__grid[data-group='suggested'] { padding-top: 0.75rem; }
              .idpick__upties { left: 3%; right: 3%; }
              .idpick__header { padding-left: 0.875rem; gap: 0.5rem; }
              .idpick__clear { padding: 0 0.625rem; }
              .idpick__clear-long { display: none; }
              .idpick__clear-short { display: inline; }
            }
            @media (prefers-reduced-motion: reduce) { .idpick__upties, .idpick__main { transition: none; } }
          `}</style>
        </div>
      )}
    </BaseModal>
  )
}
